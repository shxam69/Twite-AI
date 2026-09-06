const { pool } = require('../config/db');

const VALID_REQUEST_TYPES = [
  'QR_SCAN',
  'LOCATION_FAILED',
  'CHECKIN_FAILED',
  'CHECKOUT_FAILED',
  'OTHER',
];

/**
 * Create a new help request from an employee.
 */
async function createHelpRequest({ employee_id, request_type, message }) {
  if (!employee_id) {
    const err = new Error('Employee ID is required');
    err.statusCode = 400;
    throw err;
  }

  const upperType = (request_type || 'OTHER').toUpperCase();
  if (!VALID_REQUEST_TYPES.includes(upperType)) {
    const err = new Error(`Invalid request_type: ${request_type}`);
    err.statusCode = 400;
    throw err;
  }

  const trimmedMessage = (message || '').trim();

  const [result] = await pool.query(
    `INSERT INTO help_requests (employee_id, request_type, message, status)
     VALUES (?, ?, ?, 'OPEN')`,
    [employee_id, upperType, trimmedMessage]
  );

  const [rows] = await pool.query(
    `SELECT hr.*, e.name AS employee_name, e.employee_id AS employee_code
     FROM help_requests hr
     JOIN employees e ON hr.employee_id = e.id
     WHERE hr.id = ?`,
    [result.insertId]
  );

  return rows[0];
}

/**
 * Get help requests submitted by a specific employee.
 */
async function getEmployeeHelpRequests(employee_id) {
  const [rows] = await pool.query(
    `SELECT hr.*, u.username AS resolved_by_name
     FROM help_requests hr
     LEFT JOIN users u ON hr.resolved_by = u.id
     WHERE hr.employee_id = ?
     ORDER BY hr.created_at DESC`,
    [employee_id]
  );

  return rows;
}

/**
 * Get all help requests for Admin dashboard.
 */
async function getAllHelpRequests({ status } = {}) {
  let query = `
    SELECT hr.*, e.name AS employee_name, e.employee_id AS employee_code, e.department, u.username AS resolved_by_name
    FROM help_requests hr
    JOIN employees e ON hr.employee_id = e.id
    LEFT JOIN users u ON hr.resolved_by = u.id
  `;
  const params = [];

  if (status && ['OPEN', 'RESOLVED'].includes(status.toUpperCase())) {
    query += ` WHERE hr.status = ?`;
    params.push(status.toUpperCase());
  }

  query += ` ORDER BY hr.created_at DESC`;

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Get count of open help requests for notification badge.
 */
async function getOpenCount() {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS open_count FROM help_requests WHERE status = 'OPEN'`
  );
  return rows[0].open_count;
}

/**
 * Resolve a help request.
 */
async function resolveHelpRequest(id, admin_user_id) {
  const [existing] = await pool.query(
    `SELECT * FROM help_requests WHERE id = ?`,
    [id]
  );

  if (existing.length === 0) {
    const err = new Error('Help request not found');
    err.statusCode = 404;
    throw err;
  }

  await pool.query(
    `UPDATE help_requests
     SET status = 'RESOLVED', resolved_at = NOW(), resolved_by = ?
     WHERE id = ?`,
    [admin_user_id, id]
  );

  const [rows] = await pool.query(
    `SELECT hr.*, e.name AS employee_name, e.employee_id AS employee_code, u.username AS resolved_by_name
     FROM help_requests hr
     JOIN employees e ON hr.employee_id = e.id
     LEFT JOIN users u ON hr.resolved_by = u.id
     WHERE hr.id = ?`,
    [id]
  );

  return rows[0];
}

module.exports = {
  createHelpRequest,
  getEmployeeHelpRequests,
  getAllHelpRequests,
  getOpenCount,
  resolveHelpRequest,
};
