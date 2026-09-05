const { pool } = require('../config/db');

/**
 * Standard office start time configuration
 * Check-in after this threshold is marked as 'late'
 */
const OFFICE_START_TIME = '09:00:00';

/**
 * Valid attendance status values
 */
const VALID_STATUSES = ['present', 'absent', 'late', 'half_day'];

/**
 * Whitelist for sortable columns
 */
const ALLOWED_SORT_COLUMNS = {
  id: 'a.id',
  attendance_date: 'a.attendance_date',
  check_in: 'a.check_in',
  check_out: 'a.check_out',
  status: 'a.status',
  created_at: 'a.created_at',
  employee_name: 'e.name',
  employee_code: 'e.employee_id',
  department: 'e.department',
};

/**
 * Helper to get current server date in YYYY-MM-DD
 */
function getCurrentDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Helper to get current server time in HH:MM:SS
 */
function getCurrentTime() {
  const d = new Date();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Helper to verify an employee exists and return their record
 */
async function findEmployee(employeeId) {
  const [rows] = await pool.query(
    'SELECT id, employee_id, name, department, designation, status FROM employees WHERE id = ? LIMIT 1',
    [employeeId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Helper to find employee by ID or employee_id string
 */
async function findEmployeeByIdOrCode(identifier) {
  const [rows] = await pool.query(
    'SELECT id, employee_id, name, department, designation, status FROM employees WHERE id = ? OR employee_id = ? LIMIT 1',
    [identifier, identifier]
  );
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Manually mark/create an attendance record (Admin)
 */
async function markAttendance(data) {
  const { employee_id, attendance_date, check_in, check_out, status = 'present' } = data;

  // 1. Verify employee exists
  const employee = await findEmployee(employee_id);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  // 2. Check for duplicate attendance on the same date
  const [existing] = await pool.query(
    'SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ? LIMIT 1',
    [employee_id, attendance_date]
  );

  if (existing.length > 0) {
    const error = new Error('Attendance record already exists for this employee on this date.');
    error.status = 409;
    throw error;
  }

  // 3. Insert record
  const [result] = await pool.query(
    `INSERT INTO attendance (employee_id, attendance_date, check_in, check_out, status)
     VALUES (?, ?, ?, ?, ?)`,
    [
      employee_id,
      attendance_date,
      check_in || null,
      check_out || null,
      status,
    ]
  );

  return getAttendanceById(result.insertId);
}

/**
 * Check-in for today's date
 */
async function checkIn(employeeId) {
  // 1. Verify employee exists
  const employee = await findEmployee(employeeId);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  // 2. Inactive employees cannot check in
  if (employee.status === 'inactive') {
    const error = new Error('Cannot check in inactive employee.');
    error.status = 400;
    throw error;
  }

  const today = getCurrentDate();
  const currentTime = getCurrentTime();

  // 3. Check duplicate check-in today
  const [existing] = await pool.query(
    'SELECT id FROM attendance WHERE employee_id = ? AND attendance_date = ? LIMIT 1',
    [employeeId, today]
  );

  if (existing.length > 0) {
    const error = new Error('Attendance record already exists for this employee on this date.');
    error.status = 409;
    throw error;
  }

  // 4. Determine status based on office start time
  // If check-in time is strictly after 09:00:00 -> late, else present
  const initialStatus = currentTime > OFFICE_START_TIME ? 'late' : 'present';

  // 5. Insert check-in record
  const [result] = await pool.query(
    `INSERT INTO attendance (employee_id, attendance_date, check_in, status)
     VALUES (?, ?, ?, ?)`,
    [employeeId, today, currentTime, initialStatus]
  );

  return getAttendanceById(result.insertId);
}

/**
 * Check-out for today's date
 */
async function checkOut(employeeId) {
  // 1. Verify employee exists
  const employee = await findEmployee(employeeId);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  const today = getCurrentDate();
  const currentTime = getCurrentTime();

  // 2. Find today's attendance record
  const [existing] = await pool.query(
    `SELECT id, employee_id, attendance_date, check_in, check_out, status 
     FROM attendance 
     WHERE employee_id = ? AND attendance_date = ? 
     LIMIT 1`,
    [employeeId, today]
  );

  if (existing.length === 0) {
    const error = new Error('No check-in record found for today. Please check in first.');
    error.status = 404;
    throw error;
  }

  const attendanceRecord = existing[0];

  // 3. Check if already checked out
  if (attendanceRecord.check_out) {
    const error = new Error('Employee has already checked out for today.');
    error.status = 409;
    throw error;
  }

  // 4. Update check_out time while preserving existing check_in and status
  await pool.query(
    'UPDATE attendance SET check_out = ? WHERE id = ?',
    [currentTime, attendanceRecord.id]
  );

  return getAttendanceById(attendanceRecord.id);
}

/**
 * Get paginated and filtered attendance records with employee details
 */
async function getAttendanceRecords(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  const { employee_id, status, start_date, end_date, sortBy, sortOrder } = query;

  const conditions = [];
  const params = [];

  if (employee_id) {
    conditions.push('a.employee_id = ?');
    params.push(employee_id);
  }

  if (status && status.trim()) {
    conditions.push('a.status = ?');
    params.push(status.trim().toLowerCase());
  }

  if (start_date && start_date.trim()) {
    conditions.push('a.attendance_date >= ?');
    params.push(start_date.trim());
  }

  if (end_date && end_date.trim()) {
    conditions.push('a.attendance_date <= ?');
    params.push(end_date.trim());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Safe sorting
  const safeSortBy = ALLOWED_SORT_COLUMNS[sortBy] || 'a.attendance_date';
  const safeSortOrder = sortOrder && sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Count total records
  const countSql = `
    SELECT COUNT(*) AS total 
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    ${whereClause}
  `;
  const [countResult] = await pool.query(countSql, params);
  const total = countResult[0].total;
  const totalPages = Math.ceil(total / limit) || 1;

  // Retrieve paginated records
  const dataSql = `
    SELECT 
      a.id,
      a.employee_id,
      e.employee_id AS employee_code,
      e.name AS employee_name,
      e.department,
      e.designation,
      e.status AS employee_status,
      DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
      a.check_in,
      a.check_out,
      a.status,
      a.created_at,
      a.updated_at
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    ${whereClause}
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT ? OFFSET ?
  `;

  const [records] = await pool.query(dataSql, [...params, limit, offset]);

  return {
    records,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Get a single attendance record by ID with employee details
 */
async function getAttendanceById(id) {
  const [rows] = await pool.query(
    `SELECT 
      a.id,
      a.employee_id,
      e.employee_id AS employee_code,
      e.name AS employee_name,
      e.department,
      e.designation,
      e.status AS employee_status,
      DATE_FORMAT(a.attendance_date, '%Y-%m-%d') AS attendance_date,
      a.check_in,
      a.check_out,
      a.status,
      a.created_at,
      a.updated_at
    FROM attendance a
    JOIN employees e ON a.employee_id = e.id
    WHERE a.id = ?
    LIMIT 1`,
    [id]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Get attendance history for a specific employee
 */
async function getEmployeeAttendanceHistory(employeeId, query) {
  // 1. Verify employee exists (supports ID or employee_id string)
  const employee = await findEmployeeByIdOrCode(employeeId);
  if (!employee) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  // 2. Delegate to getAttendanceRecords with fixed employee_id
  return getAttendanceRecords({
    ...query,
    employee_id: employee.id,
  });
}

/**
 * Calculate attendance summary statistics
 */
async function getAttendanceSummary(query) {
  const { start_date, end_date, employee_id } = query;

  const conditions = [];
  const params = [];

  if (employee_id) {
    const employee = await findEmployeeByIdOrCode(employee_id);
    if (!employee) {
      const error = new Error('Employee not found.');
      error.status = 404;
      throw error;
    }
    conditions.push('employee_id = ?');
    params.push(employee.id);
  }

  if (start_date && start_date.trim()) {
    conditions.push('attendance_date >= ?');
    params.push(start_date.trim());
  }

  if (end_date && end_date.trim()) {
    conditions.push('attendance_date <= ?');
    params.push(end_date.trim());
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      COUNT(*) AS total_records,
      SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count,
      SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) AS half_day_count
    FROM attendance
    ${whereClause}
  `;

  const [rows] = await pool.query(sql, params);
  const row = rows[0] || {};

  const total_records = Number(row.total_records) || 0;
  const present_count = Number(row.present_count) || 0;
  const absent_count = Number(row.absent_count) || 0;
  const late_count = Number(row.late_count) || 0;
  const half_day_count = Number(row.half_day_count) || 0;

  // Calculate attendance percentage: (present + late + half_day) / total_records * 100
  let attendance_percentage = 0;
  if (total_records > 0) {
    const attendedDays = present_count + late_count + half_day_count;
    attendance_percentage = Number(((attendedDays / total_records) * 100).toFixed(2));
  }

  return {
    total_records,
    present_count,
    absent_count,
    late_count,
    half_day_count,
    attendance_percentage,
  };
}

module.exports = {
  OFFICE_START_TIME,
  VALID_STATUSES,
  markAttendance,
  checkIn,
  checkOut,
  getAttendanceRecords,
  getAttendanceById,
  getEmployeeAttendanceHistory,
  getAttendanceSummary,
};
