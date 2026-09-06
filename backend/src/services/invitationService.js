const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

/**
 * Hash raw token using SHA-256 for secure database storage
 */
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generate cryptographic random 32-byte hexadecimal token
 */
function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Admin: Create an employee invitation link
 */
async function createInvitation(employeeId, adminUserId, appBaseUrl = '') {
  const empId = parseInt(employeeId, 10);

  // 1. Verify employee exists and is active
  const [empRows] = await pool.query(
    'SELECT id, employee_id, name, email, status FROM employees WHERE id = ? LIMIT 1',
    [empId]
  );

  if (empRows.length === 0) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  const employee = empRows[0];
  if (employee.status === 'inactive') {
    const error = new Error('Cannot generate invitation for an inactive employee.');
    error.status = 400;
    throw error;
  }

  // 2. Verify employee does not already have a user account
  const [userRows] = await pool.query(
    'SELECT id FROM users WHERE employee_id = ? LIMIT 1',
    [empId]
  );

  if (userRows.length > 0) {
    const error = new Error('Employee already has an active user account.');
    error.status = 409;
    throw error;
  }

  // 3. Revoke any existing active unused invitations for this employee
  await pool.query(
    'UPDATE employee_invitations SET used_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND used_at IS NULL AND expires_at > NOW()',
    [empId]
  );

  // 4. Generate random token and hash
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours expiry

  // 5. Insert invitation record
  const [result] = await pool.query(
    `INSERT INTO employee_invitations (employee_id, token_hash, expires_at, created_by)
     VALUES (?, ?, ?, ?)`,
    [empId, tokenHash, expiresAt, adminUserId]
  );

  const baseUrl = appBaseUrl.replace(/\/+$/, '') || process.env.FRONTEND_URL || 'http://localhost:5173';
  const registrationUrl = `${baseUrl}/register/employee/${rawToken}`;

  return {
    invitation_id: result.insertId,
    employee_id: employee.id,
    employee_code: employee.employee_id,
    employee_name: employee.name,
    raw_token: rawToken,
    registration_url: registrationUrl,
    expires_at: expiresAt,
  };
}

/**
 * Admin: Get invitation & account status for an employee
 */
async function getInvitationStatus(employeeId) {
  const empId = parseInt(employeeId, 10);

  // 1. Check if employee exists
  const [empRows] = await pool.query(
    'SELECT id, employee_id, name, status FROM employees WHERE id = ? LIMIT 1',
    [empId]
  );

  if (empRows.length === 0) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  // 2. Check if user account already exists
  const [userRows] = await pool.query(
    'SELECT id, username, created_at FROM users WHERE employee_id = ? LIMIT 1',
    [empId]
  );

  if (userRows.length > 0) {
    return {
      has_account: true,
      pending_invitation: false,
      user: {
        id: userRows[0].id,
        username: userRows[0].username,
        created_at: userRows[0].created_at,
      },
    };
  }

  // 3. Check for active pending invitation
  const [invRows] = await pool.query(
    `SELECT id, expires_at, created_at 
     FROM employee_invitations 
     WHERE employee_id = ? AND used_at IS NULL AND expires_at > NOW() 
     ORDER BY created_at DESC LIMIT 1`,
    [empId]
  );

  const pendingInvitation = invRows.length > 0;

  return {
    has_account: false,
    pending_invitation: pendingInvitation,
    invitation: pendingInvitation
      ? {
          id: invRows[0].id,
          expires_at: invRows[0].expires_at,
          created_at: invRows[0].created_at,
        }
      : null,
  };
}

/**
 * Admin: Revoke active invitation for an employee
 */
async function revokeInvitation(employeeId) {
  const empId = parseInt(employeeId, 10);

  const [result] = await pool.query(
    'UPDATE employee_invitations SET used_at = CURRENT_TIMESTAMP WHERE employee_id = ? AND used_at IS NULL AND expires_at > NOW()',
    [empId]
  );

  return {
    success: true,
    message: 'Invitation revoked successfully.',
    affected_rows: result.affectedRows,
  };
}

/**
 * Public: Validate invitation token and return safe employee details for registration display
 */
async function validateToken(rawToken) {
  if (!rawToken || !rawToken.trim()) {
    const error = new Error('Invitation token is required.');
    error.status = 400;
    throw error;
  }

  const tokenHash = hashToken(rawToken.trim());

  const [rows] = await pool.query(
    `SELECT 
       i.id AS invitation_id, 
       i.employee_id, 
       i.expires_at, 
       i.used_at,
       e.employee_id AS employee_code,
       e.name AS employee_name,
       e.email AS employee_email,
       e.status AS employee_status
     FROM employee_invitations i
     JOIN employees e ON i.employee_id = e.id
     WHERE i.token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  if (rows.length === 0) {
    const error = new Error('Invalid or unknown invitation token.');
    error.status = 404;
    throw error;
  }

  const inv = rows[0];

  if (inv.used_at !== null) {
    const error = new Error('This invitation link has already been used.');
    error.status = 400;
    throw error;
  }

  if (new Date(inv.expires_at) <= new Date()) {
    const error = new Error('This invitation link has expired.');
    error.status = 400;
    throw error;
  }

  if (inv.employee_status === 'inactive') {
    const error = new Error('The associated employee record is inactive.');
    error.status = 400;
    throw error;
  }

  // Check if account was already created for this employee
  const [userRows] = await pool.query(
    'SELECT id FROM users WHERE employee_id = ? LIMIT 1',
    [inv.employee_id]
  );

  if (userRows.length > 0) {
    const error = new Error('An account has already been registered for this employee.');
    error.status = 409;
    throw error;
  }

  return {
    valid: true,
    employee_id: inv.employee_code,
    name: inv.employee_name,
    email: inv.employee_email,
  };
}

/**
 * Public: Register employee account using valid invitation token
 */
async function registerEmployee(rawToken, password) {
  if (!rawToken || !rawToken.trim()) {
    const error = new Error('Invitation token is required.');
    error.status = 400;
    throw error;
  }

  if (!password || password.length < 6) {
    const error = new Error('Password must be at least 6 characters long.');
    error.status = 400;
    throw error;
  }

  const tokenHash = hashToken(rawToken.trim());

  // 1. Fetch invitation and employee record
  const [rows] = await pool.query(
    `SELECT 
       i.id AS invitation_id, 
       i.employee_id, 
       i.expires_at, 
       i.used_at,
       e.employee_id AS employee_code,
       e.name AS employee_name,
       e.email AS employee_email,
       e.status AS employee_status
     FROM employee_invitations i
     JOIN employees e ON i.employee_id = e.id
     WHERE i.token_hash = ?
     LIMIT 1`,
    [tokenHash]
  );

  if (rows.length === 0) {
    const error = new Error('Invalid or unknown invitation token.');
    error.status = 404;
    throw error;
  }

  const inv = rows[0];

  if (inv.used_at !== null) {
    const error = new Error('This invitation link has already been used.');
    error.status = 400;
    throw error;
  }

  if (new Date(inv.expires_at) <= new Date()) {
    const error = new Error('This invitation link has expired.');
    error.status = 400;
    throw error;
  }

  if (inv.employee_status === 'inactive') {
    const error = new Error('The associated employee record is inactive.');
    error.status = 400;
    throw error;
  }

  // 2. Check duplicate account
  const [userRows] = await pool.query(
    'SELECT id FROM users WHERE employee_id = ? LIMIT 1',
    [inv.employee_id]
  );

  if (userRows.length > 0) {
    const error = new Error('An account has already been registered for this employee.');
    error.status = 409;
    throw error;
  }

  // 3. Check duplicate username (employee.employee_code)
  const [dupUser] = await pool.query(
    'SELECT id FROM users WHERE username = ? LIMIT 1',
    [inv.employee_code]
  );

  if (dupUser.length > 0) {
    const error = new Error(`Username "${inv.employee_code}" already exists in the system.`);
    error.status = 409;
    throw error;
  }

  // 4. Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // 5. Execute registration inside database transaction
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Create user account: username = employee code, role = employee, employee_id = employee primary key
    const [userResult] = await connection.query(
      `INSERT INTO users (username, password, role, employee_id)
       VALUES (?, ?, 'employee', ?)`,
      [inv.employee_code, hashedPassword, inv.employee_id]
    );

    // Mark invitation as used
    await connection.query(
      'UPDATE employee_invitations SET used_at = CURRENT_TIMESTAMP WHERE id = ?',
      [inv.invitation_id]
    );

    await connection.commit();

    return {
      success: true,
      message: 'Employee account registered successfully.',
      username: inv.employee_code,
      user_id: userResult.insertId,
    };
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      const error = new Error('Account already exists for this employee or username.');
      error.status = 409;
      throw error;
    }
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  hashToken,
  generateRawToken,
  createInvitation,
  getInvitationStatus,
  revokeInvitation,
  validateToken,
  registerEmployee,
};
