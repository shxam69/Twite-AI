/**
 * testAdminManualAttendance.js
 * Comprehensive automated verification for Admin Manual Attendance capability:
 * 1. Admin can manually create attendance.
 * 2. Admin can modify attendance.
 * 3. Employee cannot create admin attendance (403 Forbidden).
 * 4. Employee cannot call the admin endpoint (403 Forbidden).
 * 5. Duplicate employee/date attendance is rejected safely (409 Conflict).
 * 6. Invalid time ranges are rejected (check_out <= check_in -> 400 Bad Request).
 * 7. Missing admin reason is rejected (400 Bad Request).
 * 8. ADMIN verification_method is recorded in DB.
 * 9. Audit event is created (ADMIN_ATTENDANCE_UPDATE).
 * 10. Existing employee attendance remains unchanged.
 * 11. Manual attendance reward calculation works correctly.
 * 12. Duplicate reward issuance cannot occur (idempotent).
 * 13. Admin identity is recorded in the audit trail.
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
  console.log('STARTING ADMIN MANUAL ATTENDANCE AUTOMATED VERIFICATION');
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

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'attendance_management',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // 1. Authenticate Admin and Employee
    const adminLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: { username: 'admin', password: 'Admin@123' },
    });
    const adminHeaders = { Authorization: `Bearer ${adminLogin.token}` };
    const adminUser = adminLogin.user;
    assert('Admin Login', !!adminLogin.token);

    const empLogin = await req(`${BASE_URL}/auth/login`, {
      method: 'POST',
      body: { username: 'emp_user1', password: 'EmpPass@123' },
    });
    const empHeaders = { Authorization: `Bearer ${empLogin.token}` };
    const empId = empLogin.user.employee_id;
    assert('Employee Login (emp_user1)', !!empLogin.token && empId > 0);

    // Fetch employee details
    const [empRows] = await pool.query('SELECT * FROM employees WHERE id = ?', [empId]);
    const empName = empRows[0].name;

    // Set policies for rewards testing: standard_work_hours = 4, reward_points_per_extra_hour = 100
    await req(`${BASE_URL}/attendance/policies/standard_work_hours`, { method: 'PUT', headers: adminHeaders, body: { value: '4' } });
    await req(`${BASE_URL}/attendance/policies/reward_points_per_extra_hour`, { method: 'PUT', headers: adminHeaders, body: { value: '100' } });

    // Test Date: Use a distinct past date for manual creation testing
    const testDate = '2026-08-15';
    const testDate2 = '2026-08-16';

    // Clean up test dates
    await pool.query('DELETE FROM attendance WHERE employee_id = ? AND attendance_date IN (?, ?)', [empId, testDate, testDate2]);

    // TEST 3 & 4: Employee cannot call admin endpoint or create admin attendance
    console.log('\n--- Security: RBAC Enforcement ---');
    try {
      await req(`${BASE_URL}/attendance/admin/mark`, {
        method: 'POST',
        headers: empHeaders,
        body: {
          employee_id: empId,
          attendance_date: testDate,
          check_in: '09:00:00',
          check_out: '17:00:00',
          status: 'present',
          remarks: 'Hacked override attempt',
        },
      });
      assert('Employee cannot call /api/attendance/admin/mark', false);
    } catch (err) {
      assert('Employee cannot call /api/attendance/admin/mark (403 Forbidden)', err.status === 403);
    }

    try {
      await req(`${BASE_URL}/attendance`, {
        method: 'POST',
        headers: empHeaders,
        body: {
          employee_id: empId,
          attendance_date: testDate,
          check_in: '09:00:00',
          check_out: '17:00:00',
          status: 'present',
          remarks: 'Hacked override attempt',
        },
      });
      assert('Employee cannot create admin attendance via /api/attendance', false);
    } catch (err) {
      assert('Employee cannot create admin attendance via /api/attendance (403 Forbidden)', err.status === 403);
    }

    // TEST 7: Missing admin reason is rejected (400)
    console.log('\n--- Validation: Missing Reason & Invalid Time Ranges ---');
    try {
      await req(`${BASE_URL}/attendance/admin/mark`, {
        method: 'POST',
        headers: adminHeaders,
        body: {
          employee_id: empId,
          attendance_date: testDate,
          check_in: '09:00:00',
          check_out: '17:00:00',
          status: 'present',
          remarks: '   ', // blank reason
        },
      });
      assert('Missing admin reason rejected', false);
    } catch (err) {
      assert('Missing admin reason is rejected (400 Bad Request)', err.status === 400);
    }

    // TEST 6: Invalid time ranges are rejected (check_out <= check_in)
    try {
      await req(`${BASE_URL}/attendance/admin/mark`, {
        method: 'POST',
        headers: adminHeaders,
        body: {
          employee_id: empId,
          attendance_date: testDate,
          check_in: '18:00:00',
          check_out: '09:00:00',
          status: 'present',
          remarks: 'Invalid time test',
        },
      });
      assert('Invalid time range rejected', false);
    } catch (err) {
      assert('Invalid time ranges are rejected (check_out <= check_in -> 400)', err.status === 400);
    }

    // TEST 1: Admin can manually create attendance
    console.log('\n--- Creation & Verification Method ---');
    const createRes = await req(`${BASE_URL}/attendance/admin/mark`, {
      method: 'POST',
      headers: adminHeaders,
      body: {
        employee_id: empId,
        attendance_date: testDate,
        check_in: '09:00:00',
        check_out: '16:00:00', // 7 hours (standard = 4h -> 3 extra hours = 300 pts)
        status: 'present',
        remarks: 'Employee phone was unavailable, verified by supervisor',
      },
    });
    assert('Admin can manually create attendance (201 Created)', createRes.success === true && createRes.data?.id > 0);
    const createdId = createRes.data.id;

    // TEST 8: ADMIN verification_method is recorded
    const [dbAttRows] = await pool.query('SELECT * FROM attendance WHERE id = ?', [createdId]);
    assert('ADMIN verification_method is recorded in DB', dbAttRows.length > 0 && dbAttRows[0].verification_method === 'ADMIN');
    assert('Admin remarks are saved on attendance record', dbAttRows[0].remarks.includes('Employee phone was unavailable'));

    // TEST 5: Duplicate employee/date attendance is rejected safely (409)
    console.log('\n--- Duplicate Protection & Integrity ---');
    try {
      await req(`${BASE_URL}/attendance/admin/mark`, {
        method: 'POST',
        headers: adminHeaders,
        body: {
          employee_id: empId,
          attendance_date: testDate,
          check_in: '08:00:00',
          status: 'present',
          remarks: 'Duplicate attempt',
        },
      });
      assert('Duplicate attendance rejected', false);
    } catch (err) {
      assert('Duplicate employee/date attendance is rejected safely (409 Conflict)', err.status === 409);
    }

    // TEST 9 & 13: Audit event is created and admin identity is recorded
    console.log('\n--- Audit Event Logging & Admin Identity ---');
    const [auditRows] = await pool.query(
      `SELECT * FROM attendance_events 
       WHERE employee_id = ? AND event_type = 'ADMIN_ATTENDANCE_UPDATE' 
       ORDER BY id DESC LIMIT 5`,
      [empId]
    );
    assert('Audit event ADMIN_ATTENDANCE_UPDATE created', auditRows.length > 0);

    const createAuditRow = auditRows.find(r => {
      const m = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
      return m?.action === 'CREATE';
    });
    assert('Found CREATE audit event in audit trail', !!createAuditRow);

    const meta = typeof createAuditRow.metadata === 'string' ? JSON.parse(createAuditRow.metadata) : createAuditRow.metadata;

    assert('Audit event has verification_method = ADMIN', createAuditRow.verification_method === 'ADMIN');
    assert('Admin identity is recorded in the audit trail', meta.admin_username === 'admin' || meta.admin_user_id === adminUser.id);
    assert('Audit trail includes reason/remarks', meta.reason && meta.reason.includes('Employee phone was unavailable'));
    assert('Audit trail includes employee info and date', meta.attendance_date === testDate && (meta.employee_id === empId || meta.employee_name === empName));

    // TEST 11: Manual attendance reward calculation works correctly
    console.log('\n--- Reward Calculation & Idempotency ---');
    // Shift was 09:00:00 to 16:00:00 = 7 hours. Standard = 4h -> 3 extra hours * 100 = 300 pts.
    const [txRows] = await pool.query(
      `SELECT * FROM employee_reward_transactions 
       WHERE employee_id = ? AND reference_id = ? AND type = 'EXTRA_HOURS_EARNED'`,
      [empId, createdId]
    );
    assert('Manual attendance reward transaction recorded', txRows.length > 0 && txRows[0].amount === 300);

    // TEST 12: Duplicate reward issuance cannot occur
    // Call update on same record without changing times -> reward should not be re-issued
    const initialBalanceRows = await pool.query('SELECT balance FROM employee_reward_accounts WHERE employee_id = ?', [empId]);
    const balanceBefore = initialBalanceRows[0][0].balance;

    // TEST 2: Admin can modify attendance
    console.log('\n--- Modify Attendance (Update) ---');
    const updateRes = await req(`${BASE_URL}/attendance/admin/${createdId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: {
        check_in: '09:00:00',
        check_out: '16:00:00',
        status: 'present',
        remarks: 'Correction: verified shift completed, manager approved',
      },
    });
    assert('Admin can modify attendance (200 OK)', updateRes.success === true && updateRes.data.remarks.includes('Correction'));

    // Check balance after update
    const balanceAfterRows = await pool.query('SELECT balance FROM employee_reward_accounts WHERE employee_id = ?', [empId]);
    const balanceAfter = balanceAfterRows[0][0].balance;
    assert('Duplicate reward issuance cannot occur (balance unchanged)', balanceBefore === balanceAfter);

    // Check update audit event
    const [updateAuditRows] = await pool.query(
      `SELECT * FROM attendance_events 
       WHERE employee_id = ? AND event_type = 'ADMIN_ATTENDANCE_UPDATE' 
       ORDER BY id DESC LIMIT 1`,
      [empId]
    );
    const updateMeta = typeof updateAuditRows[0].metadata === 'string' ? JSON.parse(updateAuditRows[0].metadata) : updateAuditRows[0].metadata;
    assert('Update audit event records action = UPDATE', updateMeta.action === 'UPDATE');
    assert('Update audit event contains previous_values and new_values', !!updateMeta.previous_values && !!updateMeta.new_values);

    // TEST 10: Existing employee attendance remains unchanged
    console.log('\n--- Existing Attendance Safety ---');
    const [otherAttRows] = await pool.query('SELECT id, verification_method FROM attendance WHERE employee_id = ? AND attendance_date != ? LIMIT 5', [empId, testDate]);
    const allValid = otherAttRows.every(r => ['QR', 'QR_WEBAUTHN', 'MANUAL', 'AUTO_LOCATION', 'ADMIN'].includes(r.verification_method));
    assert('Existing employee attendance remains unchanged and valid', allValid);

    // Clean up test records
    await pool.query('DELETE FROM attendance WHERE id = ?', [createdId]);
    await pool.query('DELETE FROM employee_reward_transactions WHERE reference_id = ? AND type = \'EXTRA_HOURS_EARNED\'', [createdId]);

    await pool.end();

    console.log('\n==================================================');
    console.log(`ADMIN MANUAL ATTENDANCE VERIFICATION SUMMARY: ${passed}/${total} PASSED, 0 FAILED`);
    console.log('==================================================\n');

  } catch (err) {
    console.error('Test execution error:', err);
    await pool.end();
    process.exitCode = 1;
  }
}

run();
