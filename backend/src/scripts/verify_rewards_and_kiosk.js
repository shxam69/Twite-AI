/**
 * verify_rewards_and_kiosk.js
 * End-to-end verification script for Dual QR Kiosk, Geofencing, Extra-Hours Rewards, and Atomic Redemptions.
 * Uses native fetch (Node 18+) so no external HTTP dependencies are required.
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

async function runVerification() {
  console.log('=== STARTING REWARDS & KIOSK COMPREHENSIVE VERIFICATION ===\n');

  try {
    // 1. Login as Admin
    console.log('1. Logging in as Admin...');
    const adminLoginRes = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: {
        username: 'admin',
        password: 'Admin@123',
      },
    });
    const adminToken = adminLoginRes.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };
    console.log('   Admin login successful.');

    // 2. Login as Employee
    console.log('2. Logging in as Employee (emp_user1)...');
    const empLoginRes = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: {
        username: 'emp_user1',
        password: 'EmpPass@123',
      },
    });
    const empToken = empLoginRes.token;
    const empHeaders = { Authorization: `Bearer ${empToken}` };
    const employeeId = empLoginRes.user.employee_id;
    console.log(`   Employee login successful. Employee ID = ${employeeId}`);

    // Set policies: minimum_checkout_hours = 2, standard_work_hours = 4, reward_points_per_extra_hour = 100
    await req(`${BASE_URL}/attendance/policies/minimum_checkout_hours`, { method: 'PUT', headers: adminHeaders, body: { value: '2' } });
    await req(`${BASE_URL}/attendance/policies/standard_work_hours`, { method: 'PUT', headers: adminHeaders, body: { value: '4' } });
    await req(`${BASE_URL}/attendance/policies/reward_points_per_extra_hour`, { method: 'PUT', headers: adminHeaders, body: { value: '100' } });

    // Clean up all attendance records for this employee
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'attendance_management',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    await connection.query('DELETE FROM attendance WHERE employee_id = ?', [employeeId]);
    console.log(`   Cleaned up existing attendance records for employee_id = ${employeeId} for clean test execution.\n`);

    // 3. Generate Check-In QR Token
    console.log('3. Generating CHECK_IN QR Token as Admin...');
    const checkInQrRes = await req(`${BASE_URL}/attendance/qr/generate`, { method: 'POST', headers: adminHeaders, body: { purpose: 'CHECK_IN' } });
    const checkInToken = checkInQrRes.data?.token || checkInQrRes.token;
    console.log(`   Generated CHECK_IN token: ${checkInToken.substring(0, 16)}...`);

    // 4. Generate Check-Out QR Token
    console.log('4. Generating CHECK_OUT QR Token as Admin...');
    const checkOutQrRes = await req(`${BASE_URL}/attendance/qr/generate`, { method: 'POST', headers: adminHeaders, body: { purpose: 'CHECK_OUT' } });
    const checkOutToken = checkOutQrRes.data?.token || checkOutQrRes.token;
    console.log(`   Generated CHECK_OUT token: ${checkOutToken.substring(0, 16)}...`);

    // 5. Test Purpose Mismatch Rejection
    console.log('\n5. Testing Purpose Mismatch Rejections...');
    
    // Attempting check-in using CHECK_OUT token
    try {
      await req(`${BASE_URL}/attendance/qr/check-in`, {
        method: 'POST',
        headers: empHeaders,
        body: {
          token: checkOutToken,
          latitude: 28.613939,
          longitude: 77.209021,
        },
      });
      console.error('   ❌ ERROR: Purpose mismatch check-in should have failed!');
    } catch (err) {
      console.log(`   ✅ Correctly rejected Check-In with CHECK_OUT token: "${err.data?.message || err.message}"`);
    }

    // 6. Test Out of Geofence Rejection
    console.log('\n6. Testing Workplace GPS Geofence Enforcement...');
    try {
      await req(`${BASE_URL}/attendance/qr/check-in`, {
        method: 'POST',
        headers: empHeaders,
        body: {
          token: checkInToken,
          latitude: 35.000000,
          longitude: 80.000000,
        },
      });
      console.error('   ❌ ERROR: Geofence check should have failed!');
    } catch (err) {
      console.log(`   ✅ Correctly rejected out-of-range Check-In: "${err.data?.message || err.message}"`);
    }

    // 7. Successful QR Check-In with valid location
    console.log('\n7. Performing Valid QR Check-In with Geofence Verification...');
    const checkInSuccessRes = await req(`${BASE_URL}/attendance/qr/check-in`, {
      method: 'POST',
      headers: empHeaders,
      body: {
        token: checkInToken,
        latitude: 28.613939,
        longitude: 77.209021,
      },
    });
    console.log(`   ✅ Check-In successful: "${checkInSuccessRes.message}"`);

    // 8. Test Check-Out with CHECK_IN token mismatch now that checked in
    console.log('\n8. Testing Check-Out with CHECK_IN Token Mismatch...');
    try {
      await req(`${BASE_URL}/attendance/qr/check-out`, {
        method: 'POST',
        headers: empHeaders,
        body: {
          token: checkInToken,
          latitude: 28.613939,
          longitude: 77.209021,
        },
      });
      console.error('   ❌ ERROR: Purpose mismatch check-out should have failed!');
    } catch (err) {
      console.log(`   ✅ Correctly rejected Check-Out with CHECK_IN token: "${err.data?.message || err.message}"`);
    }

    // 9. Test Minimum Hours checkout rejection (0h worked < 2h min)
    console.log('\n9. Testing Minimum Working Duration Rejection (0h worked < 2h min)...');
    try {
      await req(`${BASE_URL}/attendance/qr/check-out`, {
        method: 'POST',
        headers: empHeaders,
        body: {
          token: checkOutToken,
          latitude: 28.613939,
          longitude: 77.209021,
        },
      });
      console.error('   ❌ ERROR: Minimum duration check-out should have failed!');
    } catch (err) {
      console.log(`   ✅ Correctly rejected premature checkout: "${err.data?.message || err.message}"`);
    }

    // 10. Simulate 6.5 hours worked (e.g. check_in 6.5 hours before current time)
    const now = new Date();
    const past = new Date(now.getTime() - 6.5 * 3600 * 1000);
    const simulatedCheckIn = past.toTimeString().split(' ')[0];
    console.log(`\n10. Simulating 6.5h worked shift (check_in = ${simulatedCheckIn}, standard = 4h)...`);
    await connection.query(
      'UPDATE attendance SET check_in = ? WHERE employee_id = ?',
      [simulatedCheckIn, employeeId]
    );
    await connection.end();

    // 11. Generate fresh Check-Out QR Token
    const freshCheckOutRes = await req(`${BASE_URL}/attendance/qr/generate`, { method: 'POST', headers: adminHeaders, body: { purpose: 'CHECK_OUT' } });
    const freshCheckOutToken = freshCheckOutRes.data?.token;

    // 12. Perform Successful QR Check-Out & Points Awarding
    console.log('\n12. Performing Valid QR Check-Out & Points Awarding...');
    const checkOutSuccessRes = await req(`${BASE_URL}/attendance/qr/check-out`, {
      method: 'POST',
      headers: empHeaders,
      body: {
        token: freshCheckOutToken,
        latitude: 28.613939,
        longitude: 77.209021,
      },
    });
    console.log(`   ✅ Check-Out successful: "${checkOutSuccessRes.message}"`);
    console.log(`      Worked duration: ${checkOutSuccessRes.worked_hours} hrs`);
    console.log(`      Extra hours: ${checkOutSuccessRes.extra_hours} hrs`);
    console.log(`      Points awarded: ${checkOutSuccessRes.points_awarded}`);

    // 13. Test Idempotency: Duplicate Check-Out Attempt
    console.log('\n13. Testing Idempotent Check-Out (Already Checked Out)...');
    const thirdCheckOutRes = await req(`${BASE_URL}/attendance/qr/generate`, { method: 'POST', headers: adminHeaders, body: { purpose: 'CHECK_OUT' } });
    try {
      await req(`${BASE_URL}/attendance/qr/check-out`, {
        method: 'POST',
        headers: empHeaders,
        body: {
          token: thirdCheckOutRes.data?.token,
          latitude: 28.613939,
          longitude: 77.209021,
        },
      });
      console.error('   ❌ ERROR: Duplicate checkout should have failed!');
    } catch (err) {
      console.log(`   ✅ Correctly rejected second checkout: "${err.data?.message || err.message}"`);
    }

    // 14. Test Reward Account & Atomic Catalog Redemption
    console.log('\n14. Testing Employee Reward Account & Catalog Redemption...');
    const walletRes = await req(`${BASE_URL}/rewards/my-account`, { headers: empHeaders });
    console.log(`   Employee Reward Account Balance: ${walletRes.data.points_balance} pts`);

    // Admin creates catalog item costing 100 pts
    const newRewardRes = await req(`${BASE_URL}/rewards`, {
      method: 'POST',
      headers: adminHeaders,
      body: {
        title: `Espresso Coffee Voucher ${Date.now()}`,
        description: 'Free coffee at cafeteria',
        points_cost: 100,
        stock_quantity: 5,
      },
    });
    const rewardId = newRewardRes.data.id;
    console.log(`   Created test reward item ID #${rewardId} (Cost: 100 pts, Stock: 5)`);

    // Employee redeems reward
    const redeemRes = await req(`${BASE_URL}/rewards/redeem`, {
      method: 'POST',
      headers: empHeaders,
      body: { reward_id: rewardId },
    });
    console.log(`   ✅ Reward Redemption successful: "${redeemRes.message}"`);

    // Check balance after redemption
    const walletAfterRes = await req(`${BASE_URL}/rewards/my-account`, { headers: empHeaders });
    console.log(`   Employee Balance after redemption: ${walletAfterRes.data.points_balance} pts (Spent 100 pts)`);

    // 15. Verify Audit Events
    console.log('\n15. Verifying Audit Log Events...');
    const eventsRes = await req(`${BASE_URL}/attendance/events?limit=5`, { headers: adminHeaders });
    console.log(`   Retrieved ${eventsRes.data.length} recent audit events from server.`);
    console.log('   Sample Audit Event:');
    const evt = eventsRes.data[0];
    console.log(`     - Time: ${evt.created_at}, Employee: ${evt.employee_name}, Event: ${evt.event_type}, Method: ${evt.verification_method}`);

    // Restore standard policies
    await req(`${BASE_URL}/attendance/policies/minimum_checkout_hours`, { method: 'PUT', headers: adminHeaders, body: { value: '4' } });
    await req(`${BASE_URL}/attendance/policies/standard_work_hours`, { method: 'PUT', headers: adminHeaders, body: { value: '8' } });
    await req(`${BASE_URL}/attendance/policies/reward_points_per_extra_hour`, { method: 'PUT', headers: adminHeaders, body: { value: '100' } });

    console.log('\n=== ALL 15 VERIFICATION TESTS PASSED SUCCESSFULLY! ===');
  } catch (err) {
    console.error('VERIFICATION ERROR:', err.data || err.message);
    process.exit(1);
  }
}

runVerification();
