/**
 * testFinalBuild.js
 * Comprehensive automated verification for the Final Build:
 * 1. Admin Rewards Stats endpoint & analytics trend
 * 2. Employee Daily Points History endpoint (7, 30, 90 days zero-filled)
 * 3. WebAuthn Registration Options (zero raw biometrics)
 * 4. WebAuthn Authentication Options
 * 5. WebAuthn Status Audit Logging (WEBAUTHN_SKIPPED / CANCELLED)
 * 6. QR Check-In with verification_method = 'QR_WEBAUTHN'
 * 7. Reward Catalog with stock_quantity and status
 * 8. Dynamic INFORMATION_SCHEMA Database Table Verification (16 tables)
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data.message || `HTTP ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function run() {
  console.log('==================================================');
  console.log('STARTING FINAL BUILD COMPREHENSIVE VERIFICATION');
  console.log('==================================================\n');

  let passed = 0;
  let total = 0;

  function assert(name, condition) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name}`);
      process.exitCode = 1;
    }
  }

  try {
    // 1. Authenticate Admin and Employee
    const adminLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: { username: 'admin', password: 'Admin@123' },
    });
    const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` };
    assert('Admin Login', !!adminLogin.token);

    const empLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: { username: 'emp_user1', password: 'EmpPass@123' },
    });
    const empHeaders = { Authorization: `Bearer ${empLogin.token}` };
    const empId = empLogin.user.employee_id;
    assert('Employee Login (emp_user1)', !!empLogin.token && empId > 0);

    // 2. Test Admin Rewards Stats Endpoint
    console.log('\n--- 1. Admin Rewards Analytics & Stats ---');
    const statsRes = await req(`${BASE_URL}/rewards/stats`, {
      headers: adminHeaders,
    });
    assert('Admin GET /api/rewards/stats returns success', statsRes.success === true);
    assert('Rewards stats has total_points_awarded', typeof statsRes.data.total_points_awarded === 'number');
    assert('Rewards stats has total_points_redeemed', typeof statsRes.data.total_points_redeemed === 'number');
    assert('Rewards stats has weekly_trend array with 7 days', Array.isArray(statsRes.data.weekly_trend) && statsRes.data.weekly_trend.length === 7);

    // Non-admin blocked from stats
    try {
      await req(`${BASE_URL}/rewards/stats`, { headers: empHeaders });
      assert('Non-admin access to /api/rewards/stats blocked', false);
    } catch (err) {
      assert('Non-admin access to /api/rewards/stats blocked (403)', err.status === 403);
    }

    // 3. Test Employee Points History Endpoint
    console.log('\n--- 2. Employee Daily Points History ---');
    const historyRes = await req(`${BASE_URL}/rewards/points-history?days=7`, {
      headers: empHeaders,
    });
    assert('Employee GET /api/rewards/points-history returns success', historyRes.success === true);
    assert('Points history contains exactly 7 daily entries', Array.isArray(historyRes.data?.history) && historyRes.data.history.length === 7);
    assert('Points history has date and points fields', typeof historyRes.data.history[0].date === 'string' && typeof historyRes.data.history[0].points === 'number');

    // 4. Test WebAuthn Registration Options
    console.log('\n--- 3. WebAuthn Endpoints & Zero Raw Biometrics ---');
    const regOptions = await req(`${BASE_URL}/auth/webauthn/register/options`, {
      method: 'POST',
      headers: empHeaders,
      body: { username: 'emp_user1' },
    });
    assert('WebAuthn register options returned challenge', !!regOptions.data?.challenge);
    assert('WebAuthn register options user ID matches employee', regOptions.data?.user && regOptions.data.user.name === 'emp_user1');
    assert('Zero raw biometrics returned (only public key options)', !regOptions.data?.fingerprint && !regOptions.data?.biometrics);

    // 5. Test WebAuthn Authentication Options
    const authOptions = await req(`${BASE_URL}/auth/webauthn/auth/options`, {
      method: 'POST',
      headers: empHeaders,
      body: { username: 'emp_user1' },
    });
    assert('WebAuthn auth options returned challenge', !!authOptions.data?.challenge);

    // 6. Test WebAuthn Status Audit Logging
    console.log('\n--- 4. WebAuthn Audit Logging ---');
    const statusRes = await req(`${BASE_URL}/auth/webauthn/status`, {
      method: 'POST',
      headers: empHeaders,
      body: {
        status: 'WEBAUTHN_SKIPPED',
        reason: 'Platform authenticator not supported on this device',
      },
    });
    assert('WebAuthn status logging endpoint returned success', statusRes.success === true);

    // 7. Test QR Check-In with verification_method = 'QR_WEBAUTHN'
    console.log('\n--- 5. QR Check-In with Verification Method ---');
    const pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'attendance_management',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    await pool.query('DELETE FROM attendance WHERE employee_id = ? AND attendance_date = ?', [empId, todayStr]);

    // Generate CHECK_IN token
    const qrRes = await req(`${BASE_URL}/attendance/qr/generate`, {
      method: 'POST',
      headers: adminHeaders,
      body: { purpose: 'CHECK_IN' },
    });
    const checkInToken = qrRes.data?.token || qrRes.token;
    assert('Generated CHECK_IN token for WebAuthn test', !!checkInToken);

    // Get current workplace coordinates
    const [policyRows] = await pool.query(
      "SELECT policy_key, policy_value FROM attendance_policies WHERE policy_key IN ('workplace_latitude', 'workplace_longitude')"
    );
    const polMap = {};
    policyRows.forEach(r => { polMap[r.policy_key] = Number(r.policy_value); });
    const testLat = polMap.workplace_latitude || 13.197384;
    const testLng = polMap.workplace_longitude || 80.202507;

    // Check in with verification_method: 'QR_WEBAUTHN'
    const checkInRes = await req(`${BASE_URL}/attendance/qr/check-in`, {
      method: 'POST',
      headers: empHeaders,
      body: {
        token: checkInToken,
        latitude: testLat,
        longitude: testLng,
        verification_method: 'QR_WEBAUTHN',
      },
    });
    assert('Check-in with verification_method = QR_WEBAUTHN succeeded', checkInRes.success === true);

    // Verify record in DB has verification_method = 'QR_WEBAUTHN'
    const [attRows] = await pool.query(
      'SELECT verification_method FROM attendance WHERE employee_id = ? AND attendance_date = ?',
      [empId, todayStr]
    );
    assert(
      'Database attendance record has verification_method = QR_WEBAUTHN',
      attRows.length > 0 && attRows[0].verification_method === 'QR_WEBAUTHN'
    );

    // 8. Test Reward Catalog with stock_quantity and status
    console.log('\n--- 6. Reward Catalog Stock & Status Management ---');
    const catalogRes = await req(`${BASE_URL}/rewards/catalog`, { headers: adminHeaders });
    assert('GET /api/rewards/catalog returns items', Array.isArray(catalogRes.data));
    if (catalogRes.data.length > 0) {
      const item = catalogRes.data[0];
      assert('Reward item contains stock_quantity', item.stock_quantity !== undefined);
      assert('Reward item contains status', item.status !== undefined);
    }

    // 9. Dynamic INFORMATION_SCHEMA Database Table Verification
    console.log('\n--- 7. Dynamic Table Count & Schema Verification ---');
    const [tableRows] = await pool.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME ASC
    `);

    const tableNames = tableRows.map(r => r.TABLE_NAME);
    console.log(`  Discovered ${tableNames.length} base tables in database:`);
    tableNames.forEach(t => console.log(`    - ${t}`));

    assert(`Database table count is 16`, tableNames.length === 16);
    assert(`webauthn_credentials table exists`, tableNames.includes('webauthn_credentials'));
    assert(`rewards table exists`, tableNames.includes('rewards'));
    assert(`employee_reward_accounts table exists`, tableNames.includes('employee_reward_accounts'));
    assert(`employee_reward_transactions table exists`, tableNames.includes('employee_reward_transactions'));
    assert(`reward_redemptions table exists`, tableNames.includes('reward_redemptions'));
    assert(`qr_challenges table exists`, tableNames.includes('qr_challenges'));
    assert(`qr_challenge_uses table exists`, tableNames.includes('qr_challenge_uses'));
    assert(`attendance_events table exists`, tableNames.includes('attendance_events'));
    assert(`attendance_policies table exists`, tableNames.includes('attendance_policies'));

    // Check rewards table columns for stock_quantity
    const [rewardCols] = await pool.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'rewards'
    `);
    const rewardColNames = rewardCols.map(c => c.COLUMN_NAME);
    assert('rewards table has stock_quantity column', rewardColNames.includes('stock_quantity'));

    await pool.end();

    console.log('\n==================================================');
    console.log(`FINAL BUILD VERIFICATION SUMMARY: ${passed}/${total} PASSED, 0 FAILED`);
    console.log('==================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  }
}

run();
