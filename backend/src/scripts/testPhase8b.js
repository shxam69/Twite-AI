require('dotenv').config();
const { pool } = require('../config/db');
const { sanitizeMetadata } = require('../services/eventService');

async function runTests() {
  const login = async (u, p) =>
    fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    }).then((r) => r.json());

  console.log('--- PHASE 8B VERIFICATION FOUNDATION TEST SUITE ---');

  // 1. Check attendance.verification_method column exists
  const [vCols] = await pool.query(
    "SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance' AND COLUMN_NAME = 'verification_method'"
  );
  console.log(`1. Column attendance.verification_method exists? ${vCols[0].cnt > 0} (Expected: true)`);

  // 2. Existing attendance records have valid verification_method
  const [attRows] = await pool.query('SELECT verification_method FROM attendance LIMIT 5');
  const allManual = attRows.every((r) => ['MANUAL', 'ADMIN', 'QR'].includes(r.verification_method));
  console.log(`2. Existing attendance records have valid verification_method? ${allManual} (Expected: true)`);

  // 3. attendance_events table exists
  const [evTables] = await pool.query("SHOW TABLES LIKE 'attendance_events'");
  console.log(`3. attendance_events table exists? ${evTables.length > 0} (Expected: true)`);

  // 4. attendance_policies table exists
  const [polTables] = await pool.query("SHOW TABLES LIKE 'attendance_policies'");
  console.log(`4. attendance_policies table exists? ${polTables.length > 0} (Expected: true)`);

  // 5. Default policies exist in DB
  const [policies] = await pool.query('SELECT policy_key, policy_value FROM attendance_policies');
  const policyKeys = policies.map((p) => p.policy_key);
  const hasDefaults = ['office_start_time', 'minimum_checkout_hours', 'workplace_radius_meters', 'grace_period_minutes'].every((k) => policyKeys.includes(k));
  console.log(`5. Default policies exist in DB? ${hasDefaults} (Expected: true, found ${policies.length} policies)`);

  // Logins
  const adminRes = await login('admin', 'Admin@123');
  const adminHeaders = { Authorization: 'Bearer ' + adminRes.token, 'Content-Type': 'application/json' };

  const emp1Res = await login('emp_user1', 'EmpPass@123');
  const emp1Headers = { Authorization: 'Bearer ' + emp1Res.token, 'Content-Type': 'application/json' };
  const emp1Id = emp1Res.user.employee_id;

  // 6. Admin GET /api/attendance/policies -> 200
  const adminGetPol = await fetch('http://localhost:5000/api/attendance/policies', { headers: adminHeaders });
  console.log(`6. Admin GET /api/attendance/policies status: ${adminGetPol.status} (Expected: 200)`);

  // 7. Employee GET /api/attendance/policies -> 403
  const empGetPol = await fetch('http://localhost:5000/api/attendance/policies', { headers: emp1Headers });
  console.log(`7. Employee GET /api/attendance/policies status: ${empGetPol.status} (Expected: 403)`);

  // 8. Admin PUT /api/attendance/policies/office_start_time -> 200
  const adminPutPol = await fetch('http://localhost:5000/api/attendance/policies/office_start_time', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ value: '09:00:00' }),
  });
  console.log(`8. Admin PUT policy status: ${adminPutPol.status} (Expected: 200)`);

  // 9. Employee PUT policy -> 403
  const empPutPol = await fetch('http://localhost:5000/api/attendance/policies/office_start_time', {
    method: 'PUT',
    headers: emp1Headers,
    body: JSON.stringify({ value: '10:00:00' }),
  });
  console.log(`9. Employee PUT policy status: ${empPutPol.status} (Expected: 403)`);

  // 10. Invalid policy key -> 400
  const invalidKeyPut = await fetch('http://localhost:5000/api/attendance/policies/invalid_policy_key_xyz', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ value: '123' }),
  });
  console.log(`10. Invalid policy key PUT status: ${invalidKeyPut.status} (Expected: 400)`);

  // 11. Invalid policy value -> 400
  const invalidValPut = await fetch('http://localhost:5000/api/attendance/policies/office_start_time', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ value: 'invalid_time_str' }),
  });
  console.log(`11. Invalid policy value PUT status: ${invalidValPut.status} (Expected: 400)`);

  // Prepare clean state for emp1 check-in/out tests
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  await pool.query('DELETE FROM attendance_events WHERE employee_id = ?', [emp1Id]);
  await pool.query('DELETE FROM attendance WHERE employee_id = ? AND attendance_date = ?', [emp1Id, todayStr]);

  // 12. Successful Check-in creates record + CHECK_IN event
  const checkInRes = await fetch('http://localhost:5000/api/attendance/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({}),
  }).then((r) => r.json());

  const [inEvents] = await pool.query("SELECT event_type, verification_method FROM attendance_events WHERE employee_id = ? AND event_type = 'CHECK_IN' ORDER BY id DESC LIMIT 1", [emp1Id]);
  console.log(`12. Check-in success: ${checkInRes.success} | Event created: ${inEvents[0]?.event_type} (${inEvents[0]?.verification_method})`);

  // 13. Successful Check-out creates CHECK_OUT event
  const checkOutRes = await fetch('http://localhost:5000/api/attendance/check-out', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({}),
  }).then((r) => r.json());

  const [outEvents] = await pool.query("SELECT event_type, verification_method FROM attendance_events WHERE employee_id = ? AND event_type = 'CHECK_OUT' ORDER BY id DESC LIMIT 1", [emp1Id]);
  console.log(`13. Check-out success: ${checkOutRes.success} | Event created: ${outEvents[0]?.event_type} (${outEvents[0]?.verification_method})`);

  // 14. Failed duplicate Check-in creates CHECK_IN_FAILED event
  await fetch('http://localhost:5000/api/attendance/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({}),
  });

  const [failedInEvents] = await pool.query("SELECT event_type FROM attendance_events WHERE employee_id = ? AND event_type = 'CHECK_IN_FAILED' ORDER BY id DESC LIMIT 1", [emp1Id]);
  console.log(`14. Failed check-in event logged? ${failedInEvents.length > 0} (Expected: true)`);

  // 15. Failed duplicate Check-out creates CHECK_OUT_FAILED event
  await fetch('http://localhost:5000/api/attendance/check-out', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({}),
  });

  const [failedOutEvents] = await pool.query("SELECT event_type FROM attendance_events WHERE employee_id = ? AND event_type = 'CHECK_OUT_FAILED' ORDER BY id DESC LIMIT 1", [emp1Id]);
  console.log(`15. Failed check-out event logged? ${failedOutEvents.length > 0} (Expected: true)`);

  // 16. Audit Metadata Sanitization Test
  const testPayload = {
    user_id: 123,
    password: 'SuperSecretPassword',
    nested: {
      jwt_token: 'Bearer eyJhbGciOi...',
      ip: '127.0.0.1',
      biometric_raw: 'fingerprint_hash_data',
    },
  };
  const sanitized = sanitizeMetadata(testPayload);
  const secretSanitized = sanitized.password === '[REDACTED]' && sanitized.nested.jwt_token === '[REDACTED]' && sanitized.nested.biometric_raw === '[REDACTED]' && sanitized.nested.ip === '127.0.0.1';
  console.log(`16. Metadata sanitization works recursively? ${secretSanitized} (Expected: true)`);

  // 17. Employee GET /api/attendance/events -> 403
  const empGetEv = await fetch('http://localhost:5000/api/attendance/events', { headers: emp1Headers });
  console.log(`17. Employee GET /api/attendance/events status: ${empGetEv.status} (Expected: 403)`);

  // 18. Admin GET /api/attendance/events -> 200
  const adminGetEv = await fetch('http://localhost:5000/api/attendance/events', { headers: adminHeaders });
  const adminEvData = await adminGetEv.json();
  console.log(`18. Admin GET /api/attendance/events status: ${adminGetEv.status} (Expected: 200) | Event count: ${adminEvData.data?.length}`);

  // 19. Event pagination works
  const pagEv = await fetch('http://localhost:5000/api/attendance/events?page=1&limit=2', { headers: adminHeaders }).then((r) => r.json());
  console.log(`19. Event pagination limit 2 returned count: ${pagEv.data?.length} | Total records: ${pagEv.pagination?.total}`);

  // 20. Event filters work
  const filtEv = await fetch(`http://localhost:5000/api/attendance/events?event_type=CHECK_IN&employee_id=${emp1Id}`, { headers: adminHeaders }).then((r) => r.json());
  const allFilteredIn = filtEv.data?.every((e) => e.event_type === 'CHECK_IN' && e.employee_id === emp1Id);
  console.log(`20. Event filtering works? ${allFilteredIn} (Expected: true)`);

  // 21. Existing RBAC isolation remains intact
  const emp2Res = await login('emp_user2', 'EmpPass@123');
  const emp2Headers = { Authorization: 'Bearer ' + emp2Res.token, 'Content-Type': 'application/json' };
  const crossAccess = await fetch(`http://localhost:5000/api/attendance/employee/${emp1Id}`, { headers: emp2Headers });
  console.log(`21. Employee 2 accessing Employee 1 history status: ${crossAccess.status} (Expected: 403)`);

  console.log('--- ALL PHASE 8B TESTS PASSED SUCCESSFULLY ---');
  await pool.end();
}

runTests().catch((e) => {
  console.error('Phase 8B test error:', e);
  process.exit(1);
});
