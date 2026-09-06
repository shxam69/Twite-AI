const { pool } = require('../config/db');

/**
 * Helper to escape CSV cell values safely
 */
function escapeCsvCell(value) {
  if (value === null || value === undefined) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Generate CSV report for attendance records based on filters
 */
async function generateAttendanceCsv({ start_date, end_date, department, employee_id, status } = {}) {
  const conditions = [];
  const params = [];

  if (start_date && start_date.trim()) {
    conditions.push('a.attendance_date >= ?');
    params.push(start_date.trim());
  }

  if (end_date && end_date.trim()) {
    conditions.push('a.attendance_date <= ?');
    params.push(end_date.trim());
  }

  if (department && department.trim()) {
    conditions.push('e.department = ?');
    params.push(department.trim());
  }

  if (employee_id) {
    conditions.push('a.employee_id = ?');
    params.push(employee_id);
  }

  if (status && status.trim()) {
    conditions.push('a.status = ?');
    params.push(status.trim().toLowerCase());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
      e.employee_id AS employee_code,
      e.name AS employee_name,
      e.department,
      e.designation,
      IFNULL(a.check_in, '--') AS check_in,
      IFNULL(a.check_out, '--') AS check_out,
      a.status,
      a.verification_method,
      IFNULL(a.remarks, '') AS remarks
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    ${whereClause}
    ORDER BY a.attendance_date DESC, e.name ASC
  `;

  const [rows] = await pool.query(sql, params);

  // CSV Headers
  const headers = [
    'Attendance Date',
    'Employee Code',
    'Employee Name',
    'Department',
    'Designation',
    'Check In',
    'Check Out',
    'Status',
    'Verification Method',
    'Remarks',
  ];

  const csvLines = [headers.map(escapeCsvCell).join(',')];

  for (const r of rows) {
    const rowValues = [
      r.attendance_date,
      r.employee_code,
      r.employee_name,
      r.department,
      r.designation,
      r.check_in,
      r.check_out,
      r.status,
      r.verification_method,
      r.remarks,
    ];
    csvLines.push(rowValues.map(escapeCsvCell).join(','));
  }

  return csvLines.join('\n');
}

module.exports = {
  generateAttendanceCsv,
};
