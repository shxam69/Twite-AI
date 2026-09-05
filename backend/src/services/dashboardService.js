const { pool } = require('../config/db');

/**
 * Helper to get current server date formatted YYYY-MM-DD
 */
function getCurrentDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Retrieve aggregated dashboard statistics for today
 */
async function getDashboardStats() {
  const today = getCurrentDate();

  // Execute efficient queries concurrently via connection pool
  const [
    [empRows],
    [presentRows],
    [absentRows],
    [deptRows],
  ] = await Promise.all([
    // 1 & 2: Total employees and active employees
    pool.query(`
      SELECT 
        COUNT(*) AS total_employees,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active_employees
      FROM employees
    `),

    // 3: Present today (status in present, late, half_day)
    pool.query(
      `
      SELECT COUNT(DISTINCT a.employee_id) AS present_today
      FROM attendance a
      WHERE a.attendance_date = ?
        AND a.status IN ('present', 'late', 'half_day')
      `,
      [today]
    ),

    // 4: Absent today (ACTIVE employees with no attendance record today or marked absent)
    // Inactive employees are strictly excluded
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

    // 5: Active employees grouped by department
    pool.query(`
      SELECT department, COUNT(*) AS count
      FROM employees
      WHERE status = 'active'
      GROUP BY department
      ORDER BY count DESC, department ASC
    `),
  ]);

  const total_employees = Number(empRows[0]?.total_employees) || 0;
  const active_employees = Number(empRows[0]?.active_employees) || 0;
  const present_today = Number(presentRows[0]?.present_today) || 0;
  const absent_today = Number(absentRows[0]?.absent_today) || 0;

  const department_wise_count = deptRows.map((row) => ({
    department: row.department,
    count: Number(row.count),
  }));

  return {
    date: today,
    total_employees,
    active_employees,
    present_today,
    absent_today,
    department_wise_count,
  };
}

module.exports = {
  getCurrentDate,
  getDashboardStats,
};
