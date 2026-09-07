/**
 * Helper script to create an employee login account and link it to an employee record.
 * 
 * Usage:
 * node src/scripts/linkEmployeeUser.js <username> <password> <employee_pk_or_employee_code>
 * 
 * Example:
 * node src/scripts/linkEmployeeUser.js emp1 Emp@123 1
 * node src/scripts/linkEmployeeUser.js emp1 Emp@123 EMP001
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.log('Usage: node src/scripts/linkEmployeeUser.js <username> <password> <employee_id_or_code>');
    process.exit(1);
  }

  const [username, password, empIdentifier] = args;

  try {
    // Resolve employee by primary key (id) or employee_id string code
    let employee = null;
    if (/^\d+$/.test(empIdentifier)) {
      const [rows] = await pool.query('SELECT id, employee_id, name FROM employees WHERE id = ? LIMIT 1', [parseInt(empIdentifier, 10)]);
      if (rows.length > 0) employee = rows[0];
    }
    
    if (!employee) {
      const [rows] = await pool.query('SELECT id, employee_id, name FROM employees WHERE employee_id = ? LIMIT 1', [empIdentifier.trim()]);
      if (rows.length > 0) employee = rows[0];
    }

    if (!employee) {
      console.error(`Error: Employee "${empIdentifier}" not found.`);
      process.exit(1);
    }

    // Check if user account already exists
    const [userRows] = await pool.query('SELECT id, username, role, employee_id FROM users WHERE username = ? LIMIT 1', [username.trim()]);
    const hashedPassword = await bcrypt.hash(password, 10);

    if (userRows.length > 0) {
      // Update existing user
      await pool.query(
        "UPDATE users SET password = ?, role = 'employee', employee_id = ? WHERE id = ?",
        [hashedPassword, employee.id, userRows[0].id]
      );
      console.log(`Updated user "${username}" (ID: ${userRows[0].id}): linked to Employee "${employee.name}" (${employee.employee_id}, PK: ${employee.id}).`);
    } else {
      // Create new employee user
      const [result] = await pool.query(
        "INSERT INTO users (username, password, role, employee_id) VALUES (?, ?, 'employee', ?)",
        [username.trim(), hashedPassword, employee.id]
      );
      console.log(`Created employee user "${username}" (User ID: ${result.insertId}): linked to Employee "${employee.name}" (${employee.employee_id}, PK: ${employee.id}).`);
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      console.error(`Error: Employee ID ${empIdentifier} is already linked to another user account.`);
    } else {
      console.error('Error linking user:', error);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
