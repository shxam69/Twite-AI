const { pool } = require('../config/db');

async function check() {
  const [employees] = await pool.query('SELECT id, employee_id, name FROM employees');
  console.log('EMPLOYEES:', employees);
  await pool.end();
}

check();
