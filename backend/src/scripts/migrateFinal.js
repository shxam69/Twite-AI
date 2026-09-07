require('dotenv').config();
const { pool } = require('../config/db');

async function tableExists(tableName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt 
     FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [tableName]
  );
  return rows[0].cnt > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt 
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tableName, columnName]
  );
  return rows[0].cnt > 0;
}

async function migrate() {
  console.log('==================================================');
  console.log('🚀 RUNNING PRODUCTION-SAFE DATABASE MIGRATION');
  console.log('==================================================\n');

  // Step 1: employees table
  if (!(await tableExists('employees'))) {
    await pool.query(`
      CREATE TABLE employees (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "employees" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "employees" exists.');
  }

  // Step 2: users table
  if (!(await tableExists('users'))) {
    await pool.query(`
      CREATE TABLE users (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "users" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "users" exists.');
    if (!(await columnExists('users', 'employee_id'))) {
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN employee_id INT NULL UNIQUE AFTER role,
        ADD CONSTRAINT fk_users_employee 
          FOREIGN KEY (employee_id) REFERENCES employees(id) 
          ON DELETE SET NULL 
          ON UPDATE CASCADE
      `);
      console.log('  ✅ [CREATED] Added column "employee_id" to table "users".');
    }
  }

  // Step 3: attendance table
  if (!(await tableExists('attendance'))) {
    await pool.query(`
      CREATE TABLE attendance (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "attendance" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "attendance" exists.');
    if (!(await columnExists('attendance', 'verification_method'))) {
      await pool.query(`
        ALTER TABLE attendance 
        ADD COLUMN verification_method ENUM('MANUAL', 'QR', 'WEBAUTHN', 'QR_WEBAUTHN', 'AUTO_LOCATION', 'ADMIN') NOT NULL DEFAULT 'MANUAL' AFTER status
      `);
      console.log('  ✅ [CREATED] Added column "verification_method" to table "attendance".');
    }
    if (!(await columnExists('attendance', 'remarks'))) {
      await pool.query(`
        ALTER TABLE attendance 
        ADD COLUMN remarks TEXT NULL AFTER verification_method
      `);
      console.log('  ✅ [CREATED] Added column "remarks" to table "attendance".');
    }
  }

  // Step 4: employee_invitations table
  if (!(await tableExists('employee_invitations'))) {
    await pool.query(`
      CREATE TABLE employee_invitations (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "employee_invitations" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "employee_invitations" exists.');
  }

  // Step 5: attendance_events table
  if (!(await tableExists('attendance_events'))) {
    await pool.query(`
      CREATE TABLE attendance_events (
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
    console.log('✅ [CREATED] Table "attendance_events" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "attendance_events" exists.');
  }

  // Step 6: attendance_policies table & policy seeding
  if (!(await tableExists('attendance_policies'))) {
    await pool.query(`
      CREATE TABLE attendance_policies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        policy_key VARCHAR(50) NOT NULL UNIQUE,
        policy_value VARCHAR(255) NOT NULL,
        description VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_policies_key (policy_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "attendance_policies" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "attendance_policies" exists.');
  }

  const defaultPolicies = [
    ['office_start_time', '09:00:00', 'Standard office start time for late calculation'],
    ['minimum_checkout_hours', '4', 'Minimum working hours required before check-out'],
    ['standard_work_hours', '8', 'Standard shift working hours for extra hours calculation'],
    ['reward_points_per_extra_hour', '100', 'Reward points awarded per completed extra working hour'],
    ['workplace_radius_meters', '100', 'Allowed geofence radius in meters'],
    ['qr_validity_seconds', '30', 'Dynamic QR code expiration duration'],
    ['auto_checkout_enabled', 'false', 'Enable or disable automatic EOD checkout'],
    ['grace_period_minutes', '15', 'Grace period in minutes after office start time'],
    ['temporary_exit_enabled', 'true', 'Allow temporary exit requests'],
    ['monthly_exit_allowance', '2', 'Number of allowed temporary exits per month'],
    ['workplace_latitude', '', 'Workplace office latitude coordinate'],
    ['workplace_longitude', '', 'Workplace office longitude coordinate'],
  ];

  for (const [key, value, desc] of defaultPolicies) {
    await pool.query(
      `INSERT INTO attendance_policies (policy_key, policy_value, description)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE description = VALUES(description)`,
      [key, value, desc]
    );
  }
  console.log('✅ [SEEDED] Default attendance policies verified/seeded.');

  // Step 7: qr_challenges table
  if (!(await tableExists('qr_challenges'))) {
    await pool.query(`
      CREATE TABLE qr_challenges (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "qr_challenges" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "qr_challenges" exists.');
    if (!(await columnExists('qr_challenges', 'purpose'))) {
      await pool.query(`
        ALTER TABLE qr_challenges
        ADD COLUMN purpose ENUM('CHECK_IN', 'CHECK_OUT') NOT NULL DEFAULT 'CHECK_IN' AFTER token_hash,
        ADD INDEX idx_qr_purpose (purpose)
      `);
      console.log('  ✅ [CREATED] Added column "purpose" to table "qr_challenges".');
    }
  }

  // Step 8: qr_challenge_uses table
  if (!(await tableExists('qr_challenge_uses'))) {
    await pool.query(`
      CREATE TABLE qr_challenge_uses (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "qr_challenge_uses" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "qr_challenge_uses" exists.');
  }

  // Step 9: help_requests table
  if (!(await tableExists('help_requests'))) {
    await pool.query(`
      CREATE TABLE help_requests (
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
    console.log('✅ [CREATED] Table "help_requests" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "help_requests" exists.');
  }

  // Step 10: leave_requests table
  if (!(await tableExists('leave_requests'))) {
    await pool.query(`
      CREATE TABLE leave_requests (
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
    console.log('✅ [CREATED] Table "leave_requests" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "leave_requests" exists.');
  }

  // Step 11: attendance_correction_requests table
  if (!(await tableExists('attendance_correction_requests'))) {
    await pool.query(`
      CREATE TABLE attendance_correction_requests (
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
    console.log('✅ [CREATED] Table "attendance_correction_requests" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "attendance_correction_requests" exists.');
  }

  // Step 13: employee_reward_accounts table
  if (!(await tableExists('employee_reward_accounts'))) {
    await pool.query(`
      CREATE TABLE employee_reward_accounts (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "employee_reward_accounts" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "employee_reward_accounts" exists.');
  }

  // Step 14: employee_reward_transactions table
  if (!(await tableExists('employee_reward_transactions'))) {
    await pool.query(`
      CREATE TABLE employee_reward_transactions (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "employee_reward_transactions" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "employee_reward_transactions" exists.');
  }

  // Step 15: rewards catalog table
  if (!(await tableExists('rewards'))) {
    await pool.query(`
      CREATE TABLE rewards (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description VARCHAR(255) NULL,
        points_cost INT NOT NULL,
        status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_rewards_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "rewards" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "rewards" exists.');
    if (!(await columnExists('rewards', 'stock_quantity'))) {
      await pool.query(`
        ALTER TABLE rewards
        ADD COLUMN stock_quantity INT NOT NULL DEFAULT 100 AFTER points_cost
      `);
      console.log('  ✅ [CREATED] Added column "stock_quantity" to table "rewards".');
    }
  }

  // Seed default rewards catalog items
  const defaultRewards = [
    ['☕ Gourmet Coffee Voucher', 'Redeem for a fresh barista coffee at the workplace cafe', 100],
    ['🍱 Premium Lunch Coupon', 'Full complimentary gourmet lunch voucher', 300],
    ['🎁 Company Merchandise Gift', 'Exclusive branded workplace hoodie or mug set', 500],
    ['🍿 Movie Ticket Pass', 'Complimentary weekend cinema e-voucher', 400],
  ];

  for (const [name, desc, cost] of defaultRewards) {
    await pool.query(
      `INSERT INTO rewards (name, description, points_cost, stock_quantity, status)
       SELECT ?, ?, ?, 100, 'active'
       WHERE NOT EXISTS (SELECT id FROM rewards WHERE name = ?)`,
      [name, desc, cost, name]
    );
  }
  console.log('✅ [SEEDED] Default reward catalog items verified.');

  // Step 16: reward_redemptions table
  if (!(await tableExists('reward_redemptions'))) {
    await pool.query(`
      CREATE TABLE reward_redemptions (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "reward_redemptions" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "reward_redemptions" exists.');
  }

  // Step 17: webauthn_credentials table (Zero Biometrics Stored)
  if (!(await tableExists('webauthn_credentials'))) {
    await pool.query(`
      CREATE TABLE webauthn_credentials (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ [CREATED] Table "webauthn_credentials" created successfully.');
  } else {
    console.log('ℹ️  [ALREADY PRESENT] Table "webauthn_credentials" exists.');
  }

  // Verification step: Verify all required tables exist
  const requiredTables = [
    'employees',
    'users',
    'attendance',
    'employee_invitations',
    'attendance_events',
    'attendance_policies',
    'qr_challenges',
    'qr_challenge_uses',
    'help_requests',
    'leave_requests',
    'attendance_correction_requests',
    'employee_reward_accounts',
    'employee_reward_transactions',
    'rewards',
    'reward_redemptions',
    'webauthn_credentials',
  ];

  console.log('\n--------------------------------------------------');
  console.log('🔍 VERIFYING REQUIRED SCHEMAS & TABLES');
  console.log('--------------------------------------------------');

  let allExist = true;
  for (const table of requiredTables) {
    const exists = await tableExists(table);
    if (exists) {
      console.log(`  ✅ Table "${table}" verified.`);
    } else {
      console.log(`  ❌ Table "${table}" MISSING!`);
      allExist = false;
    }
  }

  // Query actual total count of tables from INFORMATION_SCHEMA dynamically
  const [actualTables] = await pool.query(
    `SELECT TABLE_NAME 
     FROM INFORMATION_SCHEMA.TABLES 
     WHERE TABLE_SCHEMA = DATABASE() 
     ORDER BY TABLE_NAME`
  );
  console.log(`\n📊 Total Database Tables in Schema: ${actualTables.length}`);
  console.log(`📋 Tables: ${actualTables.map(t => t.TABLE_NAME).join(', ')}`);

  if (allExist) {
    console.log('\n==================================================');
    console.log('🎉 PRODUCTION MIGRATION COMPLETED & VERIFIED');
    console.log('==================================================');
  } else {
    throw new Error('Migration completed but some required tables are missing!');
  }

  await pool.end();
}

migrate().catch((e) => {
  console.error('\n❌ Production Migration failed:', e.message);
  process.exit(1);
});
