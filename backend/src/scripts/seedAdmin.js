require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function seedAdmin() {
  const adminUsername = process.env.ADMIN_DEFAULT_USER || 'admin';
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123';

  console.log('🌱 Starting admin & test user seed process...');

  try {
    // 1. Seed Admin User
    const [adminCheck] = await pool.query(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [adminUsername]
    );

    if (adminCheck.length === 0) {
      const hashedAdminPass = await bcrypt.hash(adminPassword, 10);
      const [res] = await pool.query(
        "INSERT INTO users (username, password, role) VALUES (?, ?, 'admin')",
        [adminUsername, hashedAdminPass]
      );
      console.log(`✅ Created Admin user "${adminUsername}" (User ID: ${res.insertId}).`);
    } else {
      console.log(`ℹ️  Admin user "${adminUsername}" already exists.`);
    }

    // 2. Seed Test Employee Records (EMP-001 & EMP-002)
    await pool.query(`
      INSERT INTO employees (employee_id, name, email, mobile, department, designation, status)
      VALUES 
      ('EMP-001', 'Alice Johnson', 'alice@company.com', '+1234567890', 'Engineering', 'Senior Software Engineer', 'active'),
      ('EMP-002', 'Bob Smith', 'bob@company.com', '+1234567891', 'Marketing', 'Product Manager', 'active')
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `);

    const [empRows] = await pool.query(
      "SELECT id, employee_id FROM employees WHERE employee_id IN ('EMP-001', 'EMP-002') ORDER BY id ASC"
    );

    const emp1 = empRows.find((r) => r.employee_id === 'EMP-001');
    const emp2 = empRows.find((r) => r.employee_id === 'EMP-002');

    const hashedEmpPass = await bcrypt.hash('EmpPass@123', 10);

    if (emp1) {
      await pool.query(
        `INSERT INTO users (username, password, role, employee_id)
         VALUES ('emp_user1', ?, 'employee', ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password), employee_id = VALUES(employee_id)`,
        [hashedEmpPass, emp1.id]
      );
      console.log(`✅ Seeded employee user "emp_user1" linked to Employee ID ${emp1.id}.`);
    }

    if (emp2) {
      await pool.query(
        `INSERT INTO users (username, password, role, employee_id)
         VALUES ('emp_user2', ?, 'employee', ?)
         ON DUPLICATE KEY UPDATE password = VALUES(password), employee_id = VALUES(employee_id)`,
        [hashedEmpPass, emp2.id]
      );
      console.log(`✅ Seeded employee user "emp_user2" linked to Employee ID ${emp2.id}.`);
    }

    console.log('🎉 Seed process completed successfully.');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to seed database:', error.message);
    await pool.end();
    process.exit(1);
  }
}

seedAdmin();
