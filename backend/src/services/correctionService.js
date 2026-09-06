const { pool } = require('../config/db');
const eventService = require('./eventService');

const VALID_STATUSES = ['present', 'absent', 'late', 'half_day'];

/**
 * Submit an attendance correction request (Employee).
 */
async function createCorrectionRequest({
  employee_id,
  attendance_id,
  requested_date,
  requested_check_in,
  requested_check_out,
  requested_status,
  reason,
}) {
  if (!employee_id) {
    const err = new Error('Employee ID is required');
    err.statusCode = 400;
    throw err;
  }

  if (!requested_date) {
    const err = new Error('requested_date (YYYY-MM-DD) is required');
    err.statusCode = 400;
    throw err;
  }

  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    const err = new Error('Reason for attendance correction is required');
    err.statusCode = 400;
    throw err;
  }

  const targetStatus = (requested_status || 'present').toLowerCase();
  if (!VALID_STATUSES.includes(targetStatus)) {
    const err = new Error(`Invalid requested_status: ${requested_status}`);
    err.statusCode = 400;
    throw err;
  }

  const [result] = await pool.query(
    `INSERT INTO attendance_correction_requests 
     (employee_id, attendance_id, requested_date, requested_check_in, requested_check_out, requested_status, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')`,
    [
      employee_id,
      attendance_id || null,
      requested_date,
      requested_check_in || null,
      requested_check_out || null,
      targetStatus,
      trimmedReason,
    ]
  );

  const [rows] = await pool.query(
    `SELECT ac.*, e.name AS employee_name, e.employee_id AS employee_code
     FROM attendance_correction_requests ac
     JOIN employees e ON ac.employee_id = e.id
     WHERE ac.id = ?`,
    [result.insertId]
  );

  return rows[0];
}

/**
 * Get correction requests submitted by a specific employee.
 */
async function getEmployeeCorrections(employee_id) {
  const [rows] = await pool.query(
    `SELECT ac.*, u.username AS reviewer_name
     FROM attendance_correction_requests ac
     LEFT JOIN users u ON ac.reviewed_by = u.id
     WHERE ac.employee_id = ?
     ORDER BY ac.created_at DESC`,
    [employee_id]
  );

  return rows;
}

/**
 * Get all correction requests (Admin portal).
 */
async function getAllCorrections({ status } = {}) {
  let query = `
    SELECT ac.*, e.name AS employee_name, e.employee_id AS employee_code, e.department, u.username AS reviewer_name
    FROM attendance_correction_requests ac
    JOIN employees e ON ac.employee_id = e.id
    LEFT JOIN users u ON ac.reviewed_by = u.id
  `;
  const params = [];

  if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
    query += ` WHERE ac.status = ?`;
    params.push(status.toUpperCase());
  }

  query += ` ORDER BY ac.created_at DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Get single correction request by ID.
 */
async function getCorrectionById(id) {
  const [rows] = await pool.query(
    `SELECT ac.*, e.name AS employee_name, e.employee_id AS employee_code, e.department, u.username AS reviewer_name
     FROM attendance_correction_requests ac
     JOIN employees e ON ac.employee_id = e.id
     LEFT JOIN users u ON ac.reviewed_by = u.id
     WHERE ac.id = ?`,
    [id]
  );

  if (rows.length === 0) {
    const err = new Error('Correction request not found');
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
}

/**
 * Approve attendance correction request transactionally (Admin only).
 */
async function approveCorrectionRequest(id, admin_user_id, admin_comment = '') {
  const connection = await pool.getConnection();
  await connection.beginTransaction();

  try {
    const [rows] = await connection.query(
      `SELECT * FROM attendance_correction_requests WHERE id = ? FOR UPDATE`,
      [id]
    );

    if (rows.length === 0) {
      const err = new Error('Correction request not found');
      err.statusCode = 404;
      throw err;
    }

    const corr = rows[0];
    if (corr.status !== 'PENDING') {
      const err = new Error(`Correction request is already ${corr.status.toLowerCase()}`);
      err.statusCode = 400;
      throw err;
    }

    const comment = (admin_comment || '').trim();

    // 1. Update correction request status to APPROVED
    await connection.query(
      `UPDATE attendance_correction_requests
       SET status = 'APPROVED', admin_comment = ?, reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ?`,
      [comment, admin_user_id, id]
    );

    // 2. Transactionally update or insert attendance record
    const [existingAtt] = await connection.query(
      `SELECT id, remarks FROM attendance WHERE employee_id = ? AND attendance_date = ? LIMIT 1`,
      [corr.employee_id, corr.requested_date]
    );

    const appendRemark = ` [Correction Approved: ${corr.reason}]`;

    if (existingAtt.length > 0) {
      const existingId = existingAtt[0].id;
      const updatedRemarks = ((existingAtt[0].remarks || '') + appendRemark).trim();

      await connection.query(
        `UPDATE attendance
         SET check_in = ?, check_out = ?, status = ?, verification_method = 'ADMIN', remarks = ?
         WHERE id = ?`,
        [corr.requested_check_in, corr.requested_check_out, corr.requested_status, updatedRemarks, existingId]
      );
    } else {
      await connection.query(
        `INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, status, verification_method, remarks)
         VALUES (?, ?, ?, ?, ?, 'ADMIN', ?)`,
        [corr.employee_id, corr.requested_date, corr.requested_check_in, corr.requested_check_out, corr.requested_status, appendRemark.trim()]
      );
    }

    // 3. Log audit event
    await eventService.logAttendanceEvent({
      employee_id: corr.employee_id,
      event_type: 'ADMIN_ATTENDANCE_UPDATE',
      verification_method: 'ADMIN',
      metadata: {
        correction_request_id: id,
        requested_date: corr.requested_date,
        requested_status: corr.requested_status,
        approved_by_user_id: admin_user_id,
      },
    });

    await connection.commit();
    return await getCorrectionById(id);
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Reject attendance correction request (Admin only).
 */
async function rejectCorrectionRequest(id, admin_user_id, admin_comment = '') {
  const corr = await getCorrectionById(id);
  if (corr.status !== 'PENDING') {
    const err = new Error(`Correction request is already ${corr.status.toLowerCase()}`);
    err.statusCode = 400;
    throw err;
  }

  const comment = (admin_comment || '').trim();

  await pool.query(
    `UPDATE attendance_correction_requests
     SET status = 'REJECTED', admin_comment = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [comment, admin_user_id, id]
  );

  return await getCorrectionById(id);
}

/**
 * Get count of pending correction requests for notification badge.
 */
async function getPendingCorrectionCount() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS pending_count FROM attendance_correction_requests WHERE status = 'PENDING'`
  );
  return rows[0].pending_count;
}

module.exports = {
  createCorrectionRequest,
  getEmployeeCorrections,
  getAllCorrections,
  getCorrectionById,
  approveCorrectionRequest,
  rejectCorrectionRequest,
  getPendingCorrectionCount,
};
