-- ============================================================================
-- Migration: Complete Final Assessment Schema (Leave, Corrections, Remarks)
-- ============================================================================

USE attendance_management;

-- 1. Add remarks column to attendance table if it does not exist
SET @dbname = DATABASE();
SET @tablename = 'attendance';
SET @columnname = 'remarks';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT "Column remarks already exists in attendance table."',
  'ALTER TABLE attendance ADD COLUMN remarks TEXT NULL AFTER verification_method'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Create leave_requests table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create attendance_correction_requests table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
