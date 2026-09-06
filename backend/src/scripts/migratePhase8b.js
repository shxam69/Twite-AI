require('dotenv').config();
const { pool } = require('../config/db');

async function migrate() {
  console.log('--- RUNNING PHASE 8B DATABASE MIGRATION ---');

  // 1. Alter attendance table to add verification_method column if not exists
  const [cols] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'verification_method'"
  );

  if (cols[0].cnt === 0) {
    await pool.query(`
      ALTER TABLE attendance 
      ADD COLUMN verification_method ENUM('MANUAL', 'QR', 'WEBAUTHN', 'QR_WEBAUTHN', 'AUTO_LOCATION', 'ADMIN') NOT NULL DEFAULT 'MANUAL' 
      AFTER status
    `);
    console.log('1. Added verification_method column to attendance table.');
  } else {
    console.log('1. verification_method column already exists in attendance table.');
  }

  // 2. Create attendance_events table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      event_type ENUM(
        'CHECK_IN',
        'CHECK_OUT',
        'CHECK_IN_FAILED',
        'CHECK_OUT_FAILED',
        'VERIFICATION_SUCCESS',
        'VERIFICATION_FAILED',
        'ADMIN_ATTENDANCE_UPDATE'
      ) NOT NULL,
      verification_method ENUM(
        'MANUAL',
        'QR',
        'WEBAUTHN',
        'QR_WEBAUTHN',
        'AUTO_LOCATION',
        'ADMIN'
      ) NOT NULL DEFAULT 'MANUAL',
      metadata JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_events_employee_id (employee_id),
      INDEX idx_events_event_type (event_type),
      INDEX idx_events_created_at (created_at),
      CONSTRAINT fk_events_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('2. Verified attendance_events table schema.');

  // 3. Create attendance_policies table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_policies (
      id INT AUTO_INCREMENT PRIMARY KEY,
      policy_key VARCHAR(50) NOT NULL UNIQUE,
      policy_value VARCHAR(255) NOT NULL,
      description VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_policies_key (policy_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('3. Verified attendance_policies table schema.');

  // 4. Seed default policies (idempotent)
  const defaultPolicies = [
    ['office_start_time', '09:00:00', 'Standard office start time for late calculation'],
    ['minimum_checkout_hours', '4', 'Minimum working hours required before check-out'],
    ['workplace_radius_meters', '100', 'Allowed geofence radius in meters'],
    ['qr_validity_seconds', '30', 'Dynamic QR code expiration duration'],
    ['auto_checkout_enabled', 'false', 'Enable or disable automatic EOD checkout'],
    ['grace_period_minutes', '15', 'Grace period in minutes after office start time'],
    ['temporary_exit_enabled', 'true', 'Allow temporary exit requests'],
    ['monthly_exit_allowance', '2', 'Number of allowed temporary exits per month'],
  ];

  for (const [key, value, desc] of defaultPolicies) {
    await pool.query(
      `INSERT INTO attendance_policies (policy_key, policy_value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP`,
      [key, value, desc]
    );
  }
  console.log('4. Seeded default attendance policies.');

  console.log('--- MIGRATION COMPLETED SUCCESSFULLY ---');
  await pool.end();
}

migrate().catch((e) => {
  console.error('Migration error:', e);
  process.exit(1);
});
