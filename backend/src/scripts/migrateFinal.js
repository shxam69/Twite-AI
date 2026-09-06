require('dotenv').config();
const { pool } = require('../config/db');

async function migrate() {
  console.log('--- RUNNING FINAL ASSESSMENT DATABASE MIGRATION ---');

  // 1. Add remarks column to attendance table if missing
  const [cols] = await pool.query(
    `SELECT COUNT(*) AS cnt 
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
       AND TABLE_NAME = 'attendance' 
       AND COLUMN_NAME = 'remarks'`
  );

  if (cols[0].cnt === 0) {
    await pool.query(
      `ALTER TABLE attendance ADD COLUMN remarks TEXT NULL AFTER verification_method`
    );
    console.log('1. Added remarks column to attendance table.');
  } else {
    console.log('1. Column remarks already exists in attendance table.');
  }

  // 2. Create leave_requests table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      leave_type ENUM('CASUAL', 'SICK', 'ANNUAL', 'UNPAID') NOT NULL DEFAULT 'CASUAL',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      reason TEXT NOT NULL,
      status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      admin_comment TEXT NULL,
      reviewed_by INT NULL,
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_leave_employee_id (employee_id),
      INDEX idx_leave_status (status),
      INDEX idx_leave_dates (start_date, end_date),
      CONSTRAINT fk_leave_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_leave_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('2. Created/verified leave_requests table.');

  // 3. Create attendance_correction_requests table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attendance_correction_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      employee_id INT NOT NULL,
      attendance_id INT NULL,
      requested_date DATE NOT NULL,
      requested_check_in TIME NULL,
      requested_check_out TIME NULL,
      requested_status ENUM('present', 'absent', 'late', 'half_day') NOT NULL DEFAULT 'present',
      reason TEXT NOT NULL,
      status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
      admin_comment TEXT NULL,
      reviewed_by INT NULL,
      reviewed_at TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_corr_employee_id (employee_id),
      INDEX idx_corr_status (status),
      INDEX idx_corr_requested_date (requested_date),
      CONSTRAINT fk_corr_employee
        FOREIGN KEY (employee_id) REFERENCES employees(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
      CONSTRAINT fk_corr_attendance
        FOREIGN KEY (attendance_id) REFERENCES attendance(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
      CONSTRAINT fk_corr_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES users(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('3. Created/verified attendance_correction_requests table.');

  console.log('--- FINAL DATABASE MIGRATION COMPLETED SUCCESSFULLY ---');
  await pool.end();
}

migrate().catch((e) => {
  console.error('Final Migration error:', e);
  process.exit(1);
});
