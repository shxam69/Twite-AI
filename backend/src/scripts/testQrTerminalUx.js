/**
 * testQrTerminalUx.js
 * Verification of the QR challenge status endpoint and scan confirmation detection
 */
require('dotenv').config({ path: 'C:/attendance-management-system/backend/.env' });
const { pool } = require('C:/attendance-management-system/backend/src/config/db');

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

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  ✅ PASS: ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    failed++;
  }
}

async function run() {
  console.log('==================================================');
  console.log('STARTING QR TERMINAL UX & STATUS VERIFICATION');
  console.log('==================================================');

  // 1. Log in Admin & Employee
  const adminLogin = await req(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: { username: 'admin', password: 'Admin@123' },
  });
  const adminToken = adminLogin.token;
  assert('Admin Login successful', !!adminToken);

  const empLogin = await req(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: { username: 'emp_user1', password: 'EmpPass@123' },
  });
  const empToken = empLogin.token;
  const empId = empLogin.user.employee_id;
  assert('Employee Login successful', !!empToken && empId > 0);

  // 2. Generate a QR challenge as Admin
  const genRes = await req(`${BASE_URL}/attendance/qr/generate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { purpose: 'CHECK_IN' },
  });
  assert('Admin generates QR challenge', genRes.success && genRes.data.challenge_id);
  const challengeId = genRes.data.challenge_id;
  const rawToken = genRes.data.token;

  // 3. Security: Check status endpoint permissions
  try {
    await req(`${BASE_URL}/attendance/qr/status/${challengeId}`);
    assert('Unauthenticated status request blocked', false);
  } catch (err) {
    assert('Unauthenticated status request blocked (401)', err.status === 401);
  }

  try {
    await req(`${BASE_URL}/attendance/qr/status/${challengeId}`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    assert('Employee status request blocked (403)', false);
  } catch (err) {
    assert('Employee status request blocked (403)', err.status === 403);
  }

  // 4. Initial status check: should be unused
  const statusInitial = await req(`${BASE_URL}/attendance/qr/status/${challengeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Initial status returns success', statusInitial.success === true);
  assert('Initial status is NOT used', statusInitial.data.used === false);
  assert('Initial use_count is 0', statusInitial.data.use_count === 0);
  assert('Challenge ID matches', statusInitial.data.challenge_id === challengeId);

  // 5. Simulated Failed Scan: invalid geofence (out of bounds)
  try {
    await req(`${BASE_URL}/attendance/qr/check-in`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${empToken}` },
      body: {
        token: rawToken,
        latitude: 0.0,
        longitude: 0.0, // Far from geofence
      },
    });
    assert('Out-of-bounds scan should fail', false);
  } catch (err) {
    assert('Out-of-bounds scan fails with status >= 400', err.status >= 400);
  }

  // Status after failed scan: MUST still be NOT used
  const statusAfterFail = await req(`${BASE_URL}/attendance/qr/status/${challengeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Status after failed scan remains used = false', statusAfterFail.data.used === false);
  assert('Use count remains 0', statusAfterFail.data.use_count === 0);

  // 6. Clean up attendance for emp1 today if already checked in, so we can test a successful check-in
  await pool.query('DELETE FROM attendance WHERE employee_id = ? AND attendance_date = CURDATE()', [empId]);


  // 7. Successful Scan: valid token & within geofence (workplace coordinates from policy)
  const [policyRows] = await pool.query("SELECT policy_key, policy_value FROM attendance_policies WHERE policy_key IN ('workplace_latitude', 'workplace_longitude')");
  let lat = 13.197384;
  let lng = 80.202507;
  policyRows.forEach(r => {
    if (r.policy_key === 'workplace_latitude') lat = parseFloat(r.policy_value);
    if (r.policy_key === 'workplace_longitude') lng = parseFloat(r.policy_value);
  });

  const checkInRes = await req(`${BASE_URL}/attendance/qr/check-in`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${empToken}` },
    body: {
      token: rawToken,
      latitude: lat,
      longitude: lng,
    },
  });
  assert('Check-in with QR succeeds', checkInRes.success === true);


  // 8. Status check after successful scan: MUST be used = true
  const statusAfterSuccess = await req(`${BASE_URL}/attendance/qr/status/${challengeId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert('Status after successful scan is used = true', statusAfterSuccess.data.used === true);
  assert('Use count is at least 1', statusAfterSuccess.data.use_count >= 1);
  assert('last_used_at is populated', !!statusAfterSuccess.data.last_used_at);

  console.log('==================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================');

  await pool.end();
  if (failed > 0) process.exit(1);
}

run().catch(async (err) => {
  console.error('Test execution failed:', err);
  await pool.end();
  process.exit(1);
});
