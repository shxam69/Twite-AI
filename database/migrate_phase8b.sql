-- ============================================================================
-- Migration: Phase 8B Attendance Verification Foundation
-- ============================================================================

USE attendance_management;

-- 1. Modify attendance table to add verification_method ENUM
SET @dbname = DATABASE();
SET @tablename = 'attendance';
SET @columnname = 'verification_method';
SET @preparedStatement = (SELECT IF(
  (
    SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @dbname
      AND TABLE_NAME = @tablename
      AND COLUMN_NAME = @columnname
  ) > 0,
  'SELECT "Column verification_method already exists in attendance table."',
  'ALTER TABLE attendance ADD COLUMN verification_method ENUM("MANUAL", "QR", "WEBAUTHN", "QR_WEBAUTHN", "AUTO_LOCATION", "ADMIN") NOT NULL DEFAULT "MANUAL" AFTER status'
));
PREPARE alterIfNotExists FROM @preparedStatement;
EXECUTE alterIfNotExists;
DEALLOCATE PREPARE alterIfNotExists;

-- 2. Create attendance_events table for audit logging
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

-- 3. Create attendance_policies table
CREATE TABLE IF NOT EXISTS attendance_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  policy_key VARCHAR(50) NOT NULL UNIQUE,
  policy_value VARCHAR(255) NOT NULL,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_policies_key (policy_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Insert default policies (idempotent ON DUPLICATE KEY UPDATE)
INSERT INTO attendance_policies (policy_key, policy_value, description) VALUES
  ('office_start_time', '09:00:00', 'Standard office start time for late calculation'),
  ('minimum_checkout_hours', '4', 'Minimum working hours required before check-out'),
  ('workplace_radius_meters', '100', 'Allowed geofence radius in meters'),
  ('qr_validity_seconds', '30', 'Dynamic QR code expiration duration'),
  ('auto_checkout_enabled', 'false', 'Enable or disable automatic EOD checkout'),
  ('grace_period_minutes', '15', 'Grace period in minutes after office start time'),
  ('temporary_exit_enabled', 'true', 'Allow temporary exit requests'),
  ('monthly_exit_allowance', '2', 'Number of allowed temporary exits per month')
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;
