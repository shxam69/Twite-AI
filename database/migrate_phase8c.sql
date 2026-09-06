-- ============================================================================
-- Migration: Phase 8C Dynamic Rotating QR Attendance & GPS Geofencing
-- ============================================================================

USE attendance_management;

-- 1. Create qr_challenges table for dynamic QR challenges
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

-- 2. Create qr_challenge_uses table for per-employee single-use tracking
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

-- 3. Ensure GPS workplace policy defaults exist in attendance_policies
INSERT INTO attendance_policies (policy_key, policy_value, description) VALUES
  ('workplace_latitude', '', 'Workplace office latitude coordinate'),
  ('workplace_longitude', '', 'Workplace office longitude coordinate'),
  ('workplace_radius_meters', '100', 'Allowed workplace geofence radius in meters')
ON DUPLICATE KEY UPDATE description = VALUES(description);
