-- ============================================================================
-- Migration: Phase 8C Final Help Requests Table
-- ============================================================================

USE attendance_management;

-- Create help_requests table
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
