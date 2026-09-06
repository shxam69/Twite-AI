const { pool } = require('../config/db');

const VALID_LEAVE_TYPES = ['CASUAL', 'SICK', 'ANNUAL', 'UNPAID'];

/**
 * Submit a new leave request for an employee.
 */
async function createLeaveRequest({ employee_id, leave_type, start_date, end_date, reason }) {
  if (!employee_id) {
    const err = new Error('Employee ID is required');
    err.statusCode = 400;
    throw err;
  }

  const typeUpper = (leave_type || 'CASUAL').toUpperCase();
  if (!VALID_LEAVE_TYPES.includes(typeUpper)) {
    const err = new Error(`Invalid leave_type: ${leave_type}`);
    err.statusCode = 400;
    throw err;
  }

  if (!start_date || !end_date) {
    const err = new Error('Start date and end date are required');
    err.statusCode = 400;
    throw err;
  }

  const startMs = new Date(start_date).getTime();
  const endMs = new Date(end_date).getTime();

  if (isNaN(startMs) || isNaN(endMs)) {
    const err = new Error('Invalid start_date or end_date format');
    err.statusCode = 400;
    throw err;
  }

  if (startMs > endMs) {
    const err = new Error('start_date cannot be after end_date');
    err.statusCode = 400;
    throw err;
  }

  const trimmedReason = (reason || '').trim();
  if (!trimmedReason) {
    const err = new Error('Reason for leave is required');
    err.statusCode = 400;
    throw err;
  }

  const [result] = await pool.query(
    `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, reason, status)
     VALUES (?, ?, ?, ?, ?, 'PENDING')`,
    [employee_id, typeUpper, start_date, end_date, trimmedReason]
  );

  const [rows] = await pool.query(
    `SELECT lr.*, e.name AS employee_name, e.employee_id AS employee_code
     FROM leave_requests lr
     JOIN employees e ON lr.employee_id = e.id
     WHERE lr.id = ?`,
    [result.insertId]
  );

  return rows[0];
}

/**
 * Get leave requests submitted by a specific employee.
 */
async function getEmployeeLeaveRequests(employee_id) {
  const [rows] = await pool.query(
    `SELECT lr.*, u.username AS reviewer_name
     FROM leave_requests lr
     LEFT JOIN users u ON lr.reviewed_by = u.id
     WHERE lr.employee_id = ?
     ORDER BY lr.created_at DESC`,
    [employee_id]
  );

  return rows;
}

/**
 * Get all leave requests (Admin portal).
 */
async function getAllLeaveRequests({ status } = {}) {
  let query = `
    SELECT lr.*, e.name AS employee_name, e.employee_id AS employee_code, e.department, u.username AS reviewer_name
    FROM leave_requests lr
    JOIN employees e ON lr.employee_id = e.id
    LEFT JOIN users u ON lr.reviewed_by = u.id
  `;
  const params = [];

  if (status && ['PENDING', 'APPROVED', 'REJECTED'].includes(status.toUpperCase())) {
    query += ` WHERE lr.status = ?`;
    params.push(status.toUpperCase());
  }

  query += ` ORDER BY lr.created_at DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Get a single leave request by ID.
 */
async function getLeaveRequestById(id) {
  const [rows] = await pool.query(
    `SELECT lr.*, e.name AS employee_name, e.employee_id AS employee_code, e.department, u.username AS reviewer_name
     FROM leave_requests lr
     JOIN employees e ON lr.employee_id = e.id
     LEFT JOIN users u ON lr.reviewed_by = u.id
     WHERE lr.id = ?`,
    [id]
  );

  if (rows.length === 0) {
    const err = new Error('Leave request not found');
    err.statusCode = 404;
    throw err;
  }

  return rows[0];
}

/**
 * Approve a leave request (Admin only).
 */
async function approveLeaveRequest(id, admin_user_id, admin_comment = '') {
  const existing = await getLeaveRequestById(id);

  await pool.query(
    `UPDATE leave_requests
     SET status = 'APPROVED', admin_comment = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [(admin_comment || '').trim(), admin_user_id, id]
  );

  return await getLeaveRequestById(id);
}

/**
 * Reject a leave request (Admin only).
 */
async function rejectLeaveRequest(id, admin_user_id, admin_comment = '') {
  const existing = await getLeaveRequestById(id);

  await pool.query(
    `UPDATE leave_requests
     SET status = 'REJECTED', admin_comment = ?, reviewed_by = ?, reviewed_at = NOW()
     WHERE id = ?`,
    [(admin_comment || '').trim(), admin_user_id, id]
  );

  return await getLeaveRequestById(id);
}

/**
 * Get count of pending leave requests for notification badge.
 */
async function getPendingLeaveCount() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS pending_count FROM leave_requests WHERE status = 'PENDING'`
  );
  return rows[0].pending_count;
}

module.exports = {
  createLeaveRequest,
  getEmployeeLeaveRequests,
  getAllLeaveRequests,
  getLeaveRequestById,
  approveLeaveRequest,
  rejectLeaveRequest,
  getPendingLeaveCount,
};
