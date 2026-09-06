const { pool } = require('../config/db');

/**
 * Helper to get current server date formatted YYYY-MM-DD (Asia/Kolkata IST)
 */
function getCurrentDate() {
  const d = new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

/**
 * Helper to calculate working duration between check-in and check-out (or current time if checked in)
 */
function calculateWorkingDuration(checkInTime, checkOutTime) {
  if (!checkInTime) return null;

  const dateStr = getCurrentDate();
  const start = new Date(`${dateStr}T${checkInTime}`);
  const end = checkOutTime ? new Date(`${dateStr}T${checkOutTime}`) : new Date();

  let diffMs = end - start;
  if (diffMs < 0) diffMs = 0;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

/**
 * Retrieve aggregated dashboard statistics & analytics for today (ADMIN ONLY)
 */
async function getDashboardStats() {
  const today = getCurrentDate();

  // Execute efficient queries concurrently via connection pool
  const [
    [empRows],
    [todayAttRows],
    [absentRows],
    [currentlyInOfficeRows],
    [trendRows],
    [deptRows],
  ] = await Promise.all([
    // 1: Total employees and active employees
    pool.query(`
      SELECT 
        COUNT(*) AS total_employees,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_employees
      FROM employees
    `),

    // 2: Today's attendance status counts
    pool.query(
      `
      SELECT 
        COUNT(*) AS total_today_records,
        SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count,
        SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) AS half_day_count,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS explicit_absent_count
      FROM attendance
      WHERE attendance_date = ?
      `,
      [today]
    ),

    // 3: Absent today (ACTIVE employees with no attendance record today or marked absent)
    pool.query(
      `
      SELECT COUNT(*) AS absent_today
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id AND a.attendance_date = ?
      WHERE e.status = 'active'
        AND (a.id IS NULL OR a.status = 'absent')
      `,
      [today]
    ),

    // 4: Currently in office (Checked in AND no checkout recorded today)
    pool.query(
      `
      SELECT 
        a.id AS attendance_id,
        a.check_in,
        a.status,
        e.id AS employee_id,
        e.employee_id AS employee_code,
        e.name AS employee_name,
        e.department,
        e.designation
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.attendance_date = ?
        AND a.check_in IS NOT NULL
        AND a.check_out IS NULL
        AND e.status = 'active'
      ORDER BY a.check_in ASC
      `,
      [today]
    ),

    // 5: Past 7 days attendance trend
    pool.query(`
      SELECT 
        DATE_FORMAT(attendance_date, '%Y-%m-%d') AS date,
        SUM(CASE WHEN status IN ('present', 'late', 'half_day') THEN 1 ELSE 0 END) AS present,
        SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent,
        SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late
      FROM attendance
      WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY attendance_date
      ORDER BY attendance_date ASC
    `),

    // 6: Department-wise active employee and present counts
    pool.query(
      `
      SELECT 
        e.department,
        COUNT(DISTINCT e.id) AS total_employees,
        COUNT(DISTINCT CASE WHEN a.status IN ('present', 'late', 'half_day') THEN e.id END) AS present_today
      FROM employees e
      LEFT JOIN attendance a ON e.id = a.employee_id AND a.attendance_date = ?
      WHERE e.status = 'active'
      GROUP BY e.department
      ORDER BY total_employees DESC, e.department ASC
      `,
      [today]
    ),
  ]);

  const total_employees = Number(empRows[0]?.total_employees) || 0;
  const active_employees = Number(empRows[0]?.active_employees) || 0;

  const present_count = Number(todayAttRows[0]?.present_count) || 0;
  const late_count = Number(todayAttRows[0]?.late_count) || 0;
  const half_day_count = Number(todayAttRows[0]?.half_day_count) || 0;
  const present_today = present_count + late_count + half_day_count;

  const absent_today = Number(absentRows[0]?.absent_today) || 0;

  // Formula: (Present + Late + Half Day) / Total Active Employees * 100
  const attendance_percentage = active_employees > 0
    ? Number(((present_today / active_employees) * 100).toFixed(2))
    : 0;

  const currently_in_office = currentlyInOfficeRows.map((row) => ({
    ...row,
    working_duration: calculateWorkingDuration(row.check_in, null),
  }));

  const department_breakdown = deptRows.map((row) => ({
    department: row.department,
    total_employees: Number(row.total_employees),
    present_today: Number(row.present_today),
    percentage: Number(row.total_employees) > 0
      ? Number(((Number(row.present_today) / Number(row.total_employees)) * 100).toFixed(2))
      : 0,
  }));

  return {
    date: today,
    total_employees,
    active_employees,
    present_today,
    present_count,
    late_count,
    half_day_count,
    absent_today,
    attendance_rate: attendance_percentage,
    attendance_percentage,
    currently_in_office,
    currently_in_office_list: currently_in_office,
    currently_in_office_count: currently_in_office.length,
    trend_last_7_days: trendRows,
    seven_day_trend: trendRows,
    department_breakdown,
    department_wise_count: department_breakdown.map((d) => ({ department: d.department, count: d.total_employees })),
  };
}

/**
 * Retrieve personal dashboard statistics for a single employee (EMPLOYEE ONLY)
 */
async function getEmployeeStats(employeeId) {
  const today = getCurrentDate();

  // 1. Fetch employee details
  const [empRows] = await pool.query(
    'SELECT id, employee_id, name, email, department, designation, status FROM employees WHERE id = ? LIMIT 1',
    [employeeId]
  );

  if (empRows.length === 0) {
    const error = new Error('Employee record not found.');
    error.status = 404;
    throw error;
  }

  const employee = empRows[0];

  // 2. Fetch today's attendance record
  const [todayRows] = await pool.query(
    `SELECT id, check_in, check_out, status, remarks, created_at, updated_at
     FROM attendance
     WHERE employee_id = ? AND attendance_date = ?
     LIMIT 1`,
    [employeeId, today]
  );

  const todayRecord = todayRows[0] || null;
  const working_duration = todayRecord ? calculateWorkingDuration(todayRecord.check_in, todayRecord.check_out) : null;

  // 3. Fetch personal summary counts
  const [summaryRows] = await pool.query(
    `SELECT 
       COUNT(*) AS total_records,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) AS present_count,
       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_count,
       SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_count,
       SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) AS half_day_count
     FROM attendance
     WHERE employee_id = ?`,
    [employeeId]
  );

  const total_records = Number(summaryRows[0]?.total_records) || 0;
  const present_count = Number(summaryRows[0]?.present_count) || 0;
  const absent_count = Number(summaryRows[0]?.absent_count) || 0;
  const late_count = Number(summaryRows[0]?.late_count) || 0;
  const half_day_count = Number(summaryRows[0]?.half_day_count) || 0;

  const attendedDays = present_count + late_count + half_day_count;
  const attendance_percentage = total_records > 0 ? Number(((attendedDays / total_records) * 100).toFixed(2)) : 0;

  // 4. Fetch recent personal attendance history (last 10 records)
  const [recentRows] = await pool.query(
    `SELECT 
       id,
       DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
       check_in,
       check_out,
       status,
       remarks
     FROM attendance
     WHERE employee_id = ?
     ORDER BY attendance_date DESC, id DESC
     LIMIT 10`,
    [employeeId]
  );

  return {
    employee: {
      id: employee.id,
      employee_id: employee.employee_id,
      name: employee.name,
      email: employee.email,
      department: employee.department,
      designation: employee.designation,
      status: employee.status,
    },
    today: {
      date: today,
      status: todayRecord ? todayRecord.status : 'not_marked',
      check_in: todayRecord ? todayRecord.check_in : null,
      check_out: todayRecord ? todayRecord.check_out : null,
      remarks: todayRecord ? todayRecord.remarks : null,
      working_duration,
    },
    summary: {
      total_records,
      present_count,
      absent_count,
      late_count,
      half_day_count,
      attendance_percentage,
    },
    recent_history: recentRows,
  };
}

/**
 * Retrieve aggregated notification counts for Admin header badge
 */
async function getAdminNotificationCounts() {
  const [
    [helpRows],
    [leaveRows],
    [corrRows],
  ] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS count FROM help_requests WHERE status = 'OPEN'`),
    pool.query(`SELECT COUNT(*) AS count FROM leave_requests WHERE status = 'PENDING'`),
    pool.query(`SELECT COUNT(*) AS count FROM attendance_correction_requests WHERE status = 'PENDING'`),
  ]);

  const help_requests = Number(helpRows[0]?.count) || 0;
  const leave_requests = Number(leaveRows[0]?.count) || 0;
  const correction_requests = Number(corrRows[0]?.count) || 0;

  return {
    help_requests,
    leave_requests,
    correction_requests,
    total: help_requests + leave_requests + correction_requests,
  };
}

module.exports = {
  getCurrentDate,
  calculateWorkingDuration,
  getDashboardStats,
  getEmployeeStats,
  getAdminNotificationCounts,
};
