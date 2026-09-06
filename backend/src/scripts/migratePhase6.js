require('dotenv').config();
const { pool } = require('../config/db');

async function migrate() {
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM users LIKE 'employee_id'");
    if (cols.length === 0) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN employee_id INT NULL UNIQUE AFTER role,
        ADD CONSTRAINT fk_users_employee 
          FOREIGN KEY (employee_id) REFERENCES employees(id) 
          ON DELETE SET NULL 
          ON UPDATE CASCADE
      `);
      console.log('Successfully added employee_id column and fk_users_employee constraint to users table.');
    } else {
      console.log('employee_id column already exists in users table.');
    }
  } catch (error) {
    console.error('Error migrating users table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
