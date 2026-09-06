-- ============================================================================
-- Complete Master Schema & Migration for Attendance Management System
-- Compatible with empty database initialization & idempotent re-execution
-- ============================================================================

CREATE DATABASE IF NOT EXISTS attendance_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE attendance_management;

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  mobile VARCHAR(20) NOT NULL,
  department VARCHAR(50) NOT NULL,
  designation VARCHAR(50) NOT NULL,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_employees_employee_id (employee_id),
  INDEX idx_employees_email (email),
  INDEX idx_employees_department (department),
  INDEX idx_employees_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('admin', 'employee') NOT NULL DEFAULT 'employee',
  employee_id INT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_username (username),
  INDEX idx_users_role (role),
  CONSTRAINT fk_users_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Attendance Table
CREATE TABLE IF NOT EXISTS attendance (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  attendance_date DATE NOT NULL,
  check_in TIME NULL,
  check_out TIME NULL,
  status ENUM('present', 'absent', 'late', 'half_day') NOT NULL DEFAULT 'present',
  verification_method ENUM('MANUAL', 'QR', 'WEBAUTHN', 'QR_WEBAUTHN', 'AUTO_LOCATION', 'ADMIN') NOT NULL DEFAULT 'MANUAL',
  remarks TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_attendance_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT uk_employee_attendance_date
    UNIQUE (employee_id, attendance_date),
  INDEX idx_attendance_date (attendance_date),
  INDEX idx_attendance_employee_id (employee_id),
  INDEX idx_attendance_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Employee Invitations Table
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

-- 5. Attendance Events Table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Attendance Policies Table
CREATE TABLE IF NOT EXISTS attendance_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_key VARCHAR(50) NOT NULL UNIQUE,
  policy_value VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_policies_key (policy_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO attendance_policies (policy_key, policy_value, description) VALUES
  ('office_start_time', '09:00:00', 'Standard office start time for late calculation'),
  ('minimum_checkout_hours', '4', 'Minimum working hours required before check-out'),
  ('workplace_radius_meters', '100', 'Allowed geofence radius in meters'),
  ('qr_validity_seconds', '30', 'Dynamic QR code expiration duration'),
  ('auto_checkout_enabled', 'false', 'Enable or disable automatic EOD checkout'),
  ('grace_period_minutes', '15', 'Grace period in minutes after office start time'),
  ('temporary_exit_enabled', 'true', 'Allow temporary exit requests'),
  ('monthly_exit_allowance', '2', 'Number of allowed temporary exits per month'),
  ('workplace_latitude', '', 'Workplace office latitude coordinate'),
  ('workplace_longitude', '', 'Workplace office longitude coordinate')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 7. QR Challenges Table
CREATE TABLE IF NOT EXISTS qr_challenges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  challenge_id VARCHAR(64) NOT NULL UNIQUE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  INDEX idx_qr_challenge_id (challenge_id),
  INDEX idx_qr_token_hash (token_hash),
  INDEX idx_qr_expires_at (expires_at),
  CONSTRAINT fk_qr_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. QR Challenge Uses Table
CREATE TABLE IF NOT EXISTS qr_challenge_uses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  challenge_id INT NOT NULL,
  employee_id INT NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_challenge_employee (challenge_id, employee_id),
  INDEX idx_use_challenge (challenge_id),
  INDEX idx_use_employee (employee_id),
  CONSTRAINT fk_use_challenge
    FOREIGN KEY (challenge_id) REFERENCES qr_challenges(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_use_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Help Requests Table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Leave Requests Table
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

-- 11. Attendance Correction Requests Table
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
