require('dotenv').config();
const { pool } = require('../config/db');

async function migrate() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_invitations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP NULL DEFAULT NULL,
        created_by INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_invitations_employee_id (employee_id),
        CONSTRAINT fk_invitations_employee
          FOREIGN KEY (employee_id) REFERENCES employees(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE,
        CONSTRAINT fk_invitations_creator
          FOREIGN KEY (created_by) REFERENCES users(id)
          ON DELETE CASCADE
          ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Successfully created employee_invitations table.');
  } catch (error) {
    console.error('Error creating employee_invitations table:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
