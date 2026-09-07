-- ============================================================================
-- Database: attendance_management
-- Description: Schema for Mini Attendance Management System
-- ============================================================================

CREATE DATABASE IF NOT EXISTS attendance_management
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE attendance_management;

-- ----------------------------------------------------------------------------
-- 1. Employees Table (Employee Master Information)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 2. Users Table (Authentication & Access Control)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. Employee Invitations Table (One-Time Registration Links)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 3. Attendance Table (Daily Attendance Records)
-- ----------------------------------------------------------------------------
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
  
  -- Foreign Key Constraint to Employees Table
  CONSTRAINT fk_attendance_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  -- Ensure one attendance record per employee per day
  CONSTRAINT uk_employee_attendance_date
    UNIQUE (employee_id, attendance_date),

  -- Query optimization indexes
  INDEX idx_attendance_date (attendance_date),
  INDEX idx_attendance_employee_id (employee_id),
  INDEX idx_attendance_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 4. Employee Reward Accounts
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_reward_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL UNIQUE,
  balance INT NOT NULL DEFAULT 0,
  total_earned INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_reward_acc_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 5. Employee Reward Transactions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS employee_reward_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  amount INT NOT NULL,
  type ENUM('EXTRA_HOURS_EARNED', 'REWARD_REDEEMED', 'ADMIN_ADJUSTMENT', 'REFUND') NOT NULL,
  reference_id INT NULL,
  description VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_reward_tx_emp (employee_id),
  INDEX idx_reward_tx_type (type),
  CONSTRAINT fk_reward_tx_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 6. Rewards Catalog
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rewards (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  points_cost INT NOT NULL,
  stock_quantity INT NOT NULL DEFAULT 100,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rewards_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 7. Reward Redemptions
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_redemptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  reward_id INT NOT NULL,
  points_spent INT NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'FULFILLED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_redemptions_emp (employee_id),
  INDEX idx_redemptions_reward (reward_id),
  INDEX idx_redemptions_status (status),
  CONSTRAINT fk_redemption_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_redemption_reward
    FOREIGN KEY (reward_id) REFERENCES rewards(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 8. WebAuthn Platform Authenticator Credentials (Zero Biometrics Stored)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  employee_id INT NOT NULL,
  credential_id VARCHAR(500) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT NOT NULL DEFAULT 0,
  device_type VARCHAR(50) NULL,
  backed_up BOOLEAN DEFAULT FALSE,
  transports VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  INDEX idx_webauthn_employee (employee_id),
  INDEX idx_webauthn_credential_id (credential_id),
  CONSTRAINT fk_webauthn_employee
    FOREIGN KEY (employee_id) REFERENCES employees(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 9. Attendance Events Table (Immutable Audit Event Log)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 10. Attendance Policies Table (Configurable Operational Rules)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_key VARCHAR(50) NOT NULL UNIQUE,
  policy_value VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_policies_key (policy_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Attendance Policies Seed
INSERT INTO attendance_policies (policy_key, policy_value, description) VALUES
  ('office_start_time', '09:00:00', 'Standard office start time for late calculation'),
  ('standard_work_hours', '8', 'Standard full-day working hours before extra hours apply'),
  ('reward_points_per_extra_hour', '100', 'Reward points awarded per completed extra hour'),
  ('minimum_checkout_hours', '4', 'Minimum working hours required before check-out'),
  ('workplace_radius_meters', '100', 'Allowed geofence radius in meters'),
  ('qr_validity_seconds', '30', 'Dynamic QR code expiration duration'),
  ('auto_checkout_enabled', 'false', 'Enable or disable automatic EOD checkout'),
  ('grace_period_minutes', '15', 'Grace period in minutes after office start time'),
  ('temporary_exit_enabled', 'true', 'Allow temporary exit requests'),
  ('monthly_exit_allowance', '2', 'Number of allowed temporary exits per month'),
  ('workplace_latitude', '13.197384', 'Workplace office latitude coordinate'),
  ('workplace_longitude', '80.202507', 'Workplace office longitude coordinate')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- ----------------------------------------------------------------------------
-- 11. QR Challenges Table (Dynamic Rotating Tokens)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qr_challenges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  challenge_id VARCHAR(64) NOT NULL UNIQUE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  purpose ENUM('CHECK_IN', 'CHECK_OUT') NOT NULL DEFAULT 'CHECK_IN',
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by INT NOT NULL,
  INDEX idx_qr_challenge_id (challenge_id),
  INDEX idx_qr_token_hash (token_hash),
  INDEX idx_qr_purpose (purpose),
  INDEX idx_qr_expires_at (expires_at),
  CONSTRAINT fk_qr_created_by
    FOREIGN KEY (created_by) REFERENCES users(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------------------
-- 12. QR Challenge Uses Table (Per-Employee Replay Protection)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 13. Help Requests Table (Employee Assistance Requests)
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 14. Leave Requests Table
-- ----------------------------------------------------------------------------
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

-- ----------------------------------------------------------------------------
-- 15. Attendance Correction Requests Table
-- ----------------------------------------------------------------------------
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



