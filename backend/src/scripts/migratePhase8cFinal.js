require('dotenv').config();
const { pool } = require('../config/db');

async function migrate() {
  console.log('--- RUNNING PHASE 8C FINAL DATABASE MIGRATION ---');

  // Create help_requests table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS help_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      request_type ENUM(
        'QR_SCAN',
        'LOCATION_FAILED',
        'CHECKIN_FAILED',
        'CHECKOUT_FAILED',
        'OTHER'
      ) NOT NULL,
      message VARCHAR(500) NULL,
      status ENUM('OPEN', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP NULL DEFAULT NULL,
      resolved_by INT NULL,
      INDEX idx_help_employee (employee_id),
      INDEX idx_help_status (status),
      INDEX idx_help_created_at (created_at),
      CONSTRAINT fk_help_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_help_resolver
        FOREIGN KEY (resolved_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('1. Created/verified help_requests table.');

  console.log('--- PHASE 8C FINAL MIGRATION COMPLETED SUCCESSFULLY ---');
  await pool.end();
}

migrate().catch((e) => {
  console.error('Phase 8C Final Migration error:', e);
  process.exit(1);
});
