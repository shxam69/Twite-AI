const { pool } = require('../config/db');
const policyService = require('./policyService');

/**
 * Award reward points for extra hours worked during checkout (Idempotent inside transaction)
 */
async function awardExtraHoursPoints(employeeId, attendanceId, workedSeconds, connection) {
  const db = connection || pool;

  if (!employeeId || !attendanceId || workedSeconds <= 0) {
    return { pointsAwarded: 0, extraHours: 0 };
  }

  // 1. Fetch policies
  const standardHoursStr = await policyService.getPolicy('standard_work_hours');
  const rewardRateStr = await policyService.getPolicy('reward_points_per_extra_hour');

  const standardHours = Math.max(1, parseInt(standardHoursStr, 10) || 8);
  const rewardRate = Math.max(0, parseInt(rewardRateStr, 10) || 100);

  const workedHours = workedSeconds / 3600;
  const extraHours = Math.max(0, Math.floor(workedHours - standardHours));

  if (extraHours <= 0 || rewardRate <= 0) {
    return { pointsAwarded: 0, extraHours: 0 };
  }

  // 2. Idempotency Check: Verify if points were already awarded for this attendance record
  const [existingTx] = await db.query(
    `SELECT id FROM employee_reward_transactions 
     WHERE employee_id = ? AND type = 'EXTRA_HOURS_EARNED' AND reference_id = ? 
     LIMIT 1`,
    [employeeId, attendanceId]
  );

  if (existingTx.length > 0) {
    return { pointsAwarded: 0, extraHours, message: 'Points already awarded for this attendance session.' };
  }

  const pointsAwarded = extraHours * rewardRate;
  const description = `Earned ${pointsAwarded} reward points for ${extraHours} extra hour(s) worked`;

  // 3. Upsert employee_reward_account
  await db.query(
    `INSERT INTO employee_reward_accounts (employee_id, balance, total_earned)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       balance = balance + VALUES(balance),
       total_earned = total_earned + VALUES(total_earned)`,
    [employeeId, pointsAwarded, pointsAwarded]
  );

  // 4. Record transaction in ledger
  await db.query(
    `INSERT INTO employee_reward_transactions (employee_id, amount, type, reference_id, description)
     VALUES (?, ?, 'EXTRA_HOURS_EARNED', ?, ?)`,
    [employeeId, pointsAwarded, attendanceId, description]
  );

  return { pointsAwarded, extraHours };
}

/**
 * Get employee reward account summary & recent transactions
 */
async function getEmployeeRewardAccount(employeeId) {
  const [accRows] = await pool.query(
    `SELECT balance, total_earned, updated_at 
     FROM employee_reward_accounts 
     WHERE employee_id = ? 
     LIMIT 1`,
    [employeeId]
  );

  const account = accRows.length > 0 ? accRows[0] : { balance: 0, total_earned: 0 };

  const [transactions] = await pool.query(
    `SELECT id, amount, type, reference_id, description, created_at 
     FROM employee_reward_transactions 
     WHERE employee_id = ? 
     ORDER BY id DESC 
     LIMIT 15`,
    [employeeId]
  );

  const [redemptions] = await pool.query(
    `SELECT r.id, r.points_spent, r.status, r.created_at, w.name AS reward_name
     FROM reward_redemptions r
     JOIN rewards w ON w.id = r.reward_id
     WHERE r.employee_id = ?
     ORDER BY r.id DESC
     LIMIT 10`,
    [employeeId]
  );

  return {
    account,
    points_balance: account.balance,
    total_earned: account.total_earned,
    transactions,
    redemptions,
  };
}

/**
 * Get rewards catalog
 */
async function getRewardsCatalog(includeInactive = false) {
  const sql = includeInactive
    ? `SELECT id, name, name AS title, description, points_cost, status, created_at FROM rewards ORDER BY points_cost ASC`
    : `SELECT id, name, name AS title, description, points_cost, status, created_at FROM rewards WHERE status = 'active' ORDER BY points_cost ASC`;
  const [rows] = await pool.query(sql);
  return rows;
}

/**
 * Create reward item (Admin)
 */
async function createReward(data) {
  const name = (data.name || data.title || '').trim();
  const description = data.description ? data.description.trim() : '';
  const points_cost = data.points_cost !== undefined ? parseInt(data.points_cost, 10) : 0;
  const status = data.status || 'active';

  if (!name || isNaN(points_cost) || points_cost < 0) {
    const error = new Error('Reward title/name and non-negative points_cost are required.');
    error.status = 400;
    throw error;
  }

  const [result] = await pool.query(
    `INSERT INTO rewards (name, description, points_cost, status) VALUES (?, ?, ?, ?)`,
    [name, description, points_cost, status]
  );

  return {
    id: result.insertId,
    name,
    title: name,
    description,
    points_cost,
    status,
  };
}

/**
 * Update reward item (Admin)
 */
async function updateReward(id, data) {
  const { name, description, points_cost, status } = data;

  const [existing] = await pool.query(`SELECT id FROM rewards WHERE id = ? LIMIT 1`, [id]);
  if (existing.length === 0) {
    const error = new Error('Reward item not found.');
    error.status = 404;
    throw error;
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description.trim());
  }
  if (points_cost !== undefined) {
    updates.push('points_cost = ?');
    params.push(parseInt(points_cost, 10));
  }
  if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }

  if (updates.length > 0) {
    params.push(id);
    await pool.query(`UPDATE rewards SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  const [updated] = await pool.query(`SELECT id, name, description, points_cost, status FROM rewards WHERE id = ?`, [id]);
  return updated[0];
}

/**
 * Redeem reward item atomically (Employee)
 */
async function redeemReward(employeeId, rewardId) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // 1. Lock reward account row
    const [accounts] = await connection.query(
      `SELECT balance, total_earned FROM employee_reward_accounts WHERE employee_id = ? FOR UPDATE`,
      [employeeId]
    );

    const balance = accounts.length > 0 ? accounts[0].balance : 0;

    // 2. Lock & validate reward item
    const [rewards] = await connection.query(
      `SELECT id, name, points_cost, status FROM rewards WHERE id = ? FOR UPDATE`,
      [rewardId]
    );

    if (rewards.length === 0) {
      const error = new Error('Reward item not found.');
      error.status = 404;
      throw error;
    }

    const reward = rewards[0];
    if (reward.status !== 'active') {
      const error = new Error('This reward is currently inactive.');
      error.status = 400;
      throw error;
    }

    if (balance < reward.points_cost) {
      const error = new Error(`Insufficient reward points. You have ${balance} points, but this reward requires ${reward.points_cost} points.`);
      error.status = 400;
      throw error;
    }

    // 3. Deduct points from account
    const newBalance = balance - reward.points_cost;
    await connection.query(
      `UPDATE employee_reward_accounts SET balance = ? WHERE employee_id = ?`,
      [newBalance, employeeId]
    );

    // 4. Create REWARD_REDEEMED transaction
    await connection.query(
      `INSERT INTO employee_reward_transactions (employee_id, amount, type, reference_id, description)
       VALUES (?, ?, 'REWARD_REDEEMED', ?, ?)`,
      [employeeId, -reward.points_cost, reward.id, `Redeemed reward: ${reward.name}`]
    );

    // 5. Create redemption record
    const [redemptionResult] = await connection.query(
      `INSERT INTO reward_redemptions (employee_id, reward_id, points_spent, status)
       VALUES (?, ?, ?, 'PENDING')`,
      [employeeId, reward.id, reward.points_cost]
    );

    await connection.commit();

    return {
      id: redemptionResult.insertId,
      reward_name: reward.name,
      points_spent: reward.points_cost,
      remaining_balance: newBalance,
      status: 'PENDING',
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * List all redemption requests (Admin)
 */
async function getRedemptions(statusFilter) {
  const params = [];
  let where = '';
  if (statusFilter && statusFilter.trim()) {
    where = 'WHERE r.status = ?';
    params.push(statusFilter.trim());
  }

  const [rows] = await pool.query(
    `SELECT 
       r.id, 
       r.employee_id, 
       e.name AS employee_name, 
       e.employee_id AS employee_code,
       r.reward_id, 
       w.name AS reward_name, 
       r.points_spent, 
       r.status, 
       r.created_at
     FROM reward_redemptions r
     JOIN employees e ON e.id = r.employee_id
     JOIN rewards w ON w.id = r.reward_id
     ${where}
     ORDER BY r.id DESC`,
    params
  );

  return rows;
}

/**
 * Update redemption status (Admin)
 */
async function updateRedemptionStatus(id, newStatus) {
  const validStatuses = ['PENDING', 'APPROVED', 'FULFILLED', 'CANCELLED'];
  if (!validStatuses.includes(newStatus)) {
    const error = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    error.status = 400;
    throw error;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [rows] = await connection.query(
      `SELECT id, employee_id, reward_id, points_spent, status FROM reward_redemptions WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      const error = new Error('Redemption request not found.');
      error.status = 404;
      throw error;
    }

    const redemption = rows[0];

    // Refund points if cancelling a non-cancelled redemption
    if (newStatus === 'CANCELLED' && redemption.status !== 'CANCELLED') {
      await connection.query(
        `UPDATE employee_reward_accounts SET balance = balance + ? WHERE employee_id = ?`,
        [redemption.points_spent, redemption.employee_id]
      );

      await connection.query(
        `INSERT INTO employee_reward_transactions (employee_id, amount, type, reference_id, description)
         VALUES (?, ?, 'REFUND', ?, ?)`,
        [redemption.employee_id, redemption.points_spent, redemption.id, `Refund for cancelled redemption #${redemption.id}`]
      );
    }

    await connection.query(
      `UPDATE reward_redemptions SET status = ? WHERE id = ?`,
      [newStatus, id]
    );

    await connection.commit();

    return {
      id: redemption.id,
      status: newStatus,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  awardExtraHoursPoints,
  getEmployeeRewardAccount,
  getRewardsCatalog,
  createReward,
  updateReward,
  redeemReward,
  getRedemptions,
  updateRedemptionStatus,
};
