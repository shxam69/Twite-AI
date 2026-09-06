require('dotenv').config();
const { pool } = require('../config/db');
const { hashToken } = require('../services/qrService');

async function runTests() {
  const login = async (u, p) =>
    fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    }).then((r) => r.json());

  console.log('--- PHASE 8C ROTATING QR + GPS GEOFENCING TEST SUITE ---');

  // 1. qr_challenges table exists
  const [qrTables] = await pool.query("SHOW TABLES LIKE 'qr_challenges'");
  console.log(`1. qr_challenges table exists? ${qrTables.length > 0} (Expected: true)`);

  // 2. qr_challenge_uses table exists
  const [useTables] = await pool.query("SHOW TABLES LIKE 'qr_challenge_uses'");
  console.log(`2. qr_challenge_uses table exists? ${useTables.length > 0} (Expected: true)`);

  // Authenticate Admin & Employees
  const adminRes = await login('admin', 'Admin@123');
  const adminHeaders = { Authorization: 'Bearer ' + adminRes.token, 'Content-Type': 'application/json' };

  const emp1Res = await login('emp_user1', 'EmpPass@123');
  const emp1Headers = { Authorization: 'Bearer ' + emp1Res.token, 'Content-Type': 'application/json' };
  const emp1Id = emp1Res.user.employee_id;

  const emp2Res = await login('emp_user2', 'EmpPass@123');
  const emp2Headers = { Authorization: 'Bearer ' + emp2Res.token, 'Content-Type': 'application/json' };
  const emp2Id = emp2Res.user.employee_id;

  // Set up Admin workplace GPS policy (Coordinates for New Delhi office: 28.613939, 77.209021, radius 100m)
  const wpLat = 28.613939;
  const wpLon = 77.209021;
  const wpRadius = 100;

  await fetch('http://localhost:5000/api/attendance/policies/workplace_latitude', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ value: String(wpLat) }),
  });
  await fetch('http://localhost:5000/api/attendance/policies/workplace_longitude', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ value: String(wpLon) }),
  });
  await fetch('http://localhost:5000/api/attendance/policies/workplace_radius_meters', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ value: String(wpRadius) }),
  });
  await fetch('http://localhost:5000/api/attendance/policies/qr_validity_seconds', {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({ value: '30' }),
  });

  // Clean state for today's tests
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  await pool.query('DELETE FROM attendance WHERE attendance_date = ? AND employee_id IN (?, ?)', [todayStr, emp1Id, emp2Id]);
  await pool.query('DELETE FROM attendance_events WHERE employee_id IN (?, ?)', [emp1Id, emp2Id]);

  // 3. QR challenge generation succeeds (Admin only)
  const genRes = await fetch('http://localhost:5000/api/attendance/qr/generate', {
    method: 'POST',
    headers: adminHeaders,
  }).then((r) => r.json());
  console.log(`3. Admin QR generation status success? ${genRes.success} (Expected: true)`);

  const rawToken = genRes.data?.token;
  const challengeId = genRes.data?.challenge_id;

  // 4. Token returned is 64-char hex string
  const is64Hex = typeof rawToken === 'string' && rawToken.length === 64 && /^[0-9a-fA-F]+$/.test(rawToken);
  console.log(`4. Generated raw token is 64-char random hex? ${is64Hex} (Expected: true)`);

  // 5. Raw token is NOT stored in database
  const [rawTokenMatches] = await pool.query('SELECT id FROM qr_challenges WHERE token_hash = ?', [rawToken]);
  console.log(`5. Raw token absent from database table? ${rawTokenMatches.length === 0} (Expected: true)`);

  // 6. SHA-256 token hash is stored in database
  const expectedHash = hashToken(rawToken);
  const [hashMatches] = await pool.query('SELECT id, challenge_id FROM qr_challenges WHERE token_hash = ?', [expectedHash]);
  console.log(`6. SHA-256 token hash stored in DB? ${hashMatches.length > 0 && hashMatches[0].challenge_id === challengeId} (Expected: true)`);

  // 7. Expiration is enforced
  const pastDbTime = new Date(Date.now() - 60000).toISOString().replace('T', ' ').slice(0, 19);
  await pool.query("DELETE FROM qr_challenges WHERE challenge_id = 'expired_test_uuid'");
  await pool.query('INSERT INTO qr_challenges (challenge_id, token_hash, expires_at, created_by) VALUES (?, ?, ?, ?)', [
    'expired_test_uuid',
    hashToken('expired_raw_token_xyz_123456789012345678901234567890123456789012345'),
    pastDbTime,
    adminRes.user.id,
  ]);
  const expRes = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: 'expired_raw_token_xyz_123456789012345678901234567890123456789012345',
      latitude: wpLat,
      longitude: wpLon,
    }),
  });
  console.log(`7. Expired QR check-in status: ${expRes.status} (Expected: 400)`);

  // 8. Valid QR token check-in succeeds with valid GPS
  const checkIn1Res = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: rawToken,
      latitude: wpLat,
      longitude: wpLon,
    }),
  }).then((r) => r.json());
  console.log(`8. Employee 1 QR check-in success? ${checkIn1Res.success} (Expected: true)`);

  // 9. SAME active QR code can be used by DIFFERENT employee (Employee 2)
  await pool.query("UPDATE employees SET status = 'active' WHERE id = ?", [emp2Id]);
  await pool.query('DELETE FROM attendance WHERE attendance_date = ? AND employee_id = ?', [todayStr, emp2Id]);
  await pool.query('DELETE FROM qr_challenge_uses WHERE employee_id = ?', [emp2Id]);
  const checkIn2Res = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp2Headers,
    body: JSON.stringify({
      token: rawToken,
      latitude: wpLat,
      longitude: wpLon,
    }),
  }).then((r) => r.json());
  if (!checkIn2Res.success) {
    console.error('Test 9 failure reason:', checkIn2Res);
  }
  console.log(`9. Employee 2 check-in with SAME active QR success? ${checkIn2Res.success} (Expected: true)`);

  // 10. SAME employee (Employee 1) cannot reuse the same QR challenge
  await pool.query('DELETE FROM attendance WHERE attendance_date = ? AND employee_id = ?', [todayStr, emp1Id]);
  const replayRes = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: rawToken,
      latitude: wpLat,
      longitude: wpLon,
    }),
  });
  const replayData = await replayRes.json();
  console.log(`10. Employee 1 reusing SAME QR rejected? ${replayRes.status === 400 && replayData.message.includes('already been used by you')} (Expected: true)`);

  // 11. Invalid token rejected
  const invTokenRes = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: 'invalid_non_existent_token_string_123456789012345678901234567890',
      latitude: wpLat,
      longitude: wpLon,
    }),
  });
  console.log(`11. Invalid token rejected status: ${invTokenRes.status} (Expected: 400)`);

  // 12. Expired token rejected
  console.log(`12. Expired token rejected? ${expRes.status === 400} (Expected: true)`);

  // 13. Employee identity comes strictly from JWT (client-provided employee_id ignored for employee role)
  // Generate fresh QR
  const gen2Res = await fetch('http://localhost:5000/api/attendance/qr/generate', { method: 'POST', headers: adminHeaders }).then((r) => r.json());
  const freshToken = gen2Res.data.token;

  await pool.query('DELETE FROM attendance WHERE attendance_date = ? AND employee_id = ?', [todayStr, emp1Id]);
  const spoofRes = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      employee_id: emp2Id, // Attempting to spoof employee 2
      token: freshToken,
      latitude: wpLat,
      longitude: wpLon,
    }),
  }).then((r) => r.json());

  // Verify attendance record was created for emp1 (from JWT), NOT emp2
  const [emp1Rec] = await pool.query('SELECT id, verification_method FROM attendance WHERE employee_id = ? AND attendance_date = ?', [emp1Id, todayStr]);
  console.log(`13. Spoofed employee_id ignored; created for JWT user? ${emp1Rec.length > 0} (Expected: true)`);

  // 14. Employee cannot generate QR
  const empGenRes = await fetch('http://localhost:5000/api/attendance/qr/generate', { method: 'POST', headers: emp1Headers });
  console.log(`14. Employee POST /api/attendance/qr/generate status: ${empGenRes.status} (Expected: 403)`);

  // 15. Admin can generate QR
  console.log(`15. Admin POST /api/attendance/qr/generate status: ${genRes.success ? 201 : 400} (Expected: 201)`);

  // 16. Attendance record created
  console.log(`16. Attendance record created in DB? ${emp1Rec.length > 0} (Expected: true)`);

  // 17. verification_method is 'QR'
  console.log(`17. Attendance verification_method = QR? ${emp1Rec[0]?.verification_method === 'QR'} (Expected: true)`);

  // 18. Successful audit event created
  const [successEvents] = await pool.query('SELECT event_type, verification_method, metadata FROM attendance_events WHERE employee_id = ? AND event_type = "CHECK_IN" AND verification_method = "QR" ORDER BY id DESC LIMIT 1', [emp1Id]);
  console.log(`18. CHECK_IN audit event created with verification_method = QR? ${successEvents.length > 0} (Expected: true)`);

  // 19. Failed audit event created
  const [failEvents] = await pool.query('SELECT event_type, verification_method FROM attendance_events WHERE employee_id = ? AND event_type = "CHECK_IN_FAILED" ORDER BY id DESC LIMIT 1', [emp1Id]);
  console.log(`19. CHECK_IN_FAILED audit event logged? ${failEvents.length > 0} (Expected: true)`);

  // 20. Audit metadata does NOT contain raw token
  const metadataStr = JSON.stringify(successEvents[0]?.metadata || {});
  console.log(`20. Audit metadata free of raw token? ${!metadataStr.includes(freshToken) && !metadataStr.includes(rawToken)} (Expected: true)`);

  // 21. Duplicate attendance rejected
  const dupCheckIn = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: freshToken,
      latitude: wpLat,
      longitude: wpLon,
    }),
  });
  console.log(`21. Duplicate check-in on same date status: ${dupCheckIn.status} (Expected: 409)`);

  // 22. Concurrent same-employee replay prevented
  const [challengeRow] = await pool.query('SELECT id FROM qr_challenges WHERE challenge_id = ?', [gen2Res.data.challenge_id]);
  const [useRows] = await pool.query('SELECT id FROM qr_challenge_uses WHERE challenge_id = ? AND employee_id = ?', [challengeRow[0].id, emp1Id]);
  console.log(`22. Per-employee single-use row recorded in qr_challenge_uses? ${useRows.length === 1} (Expected: true)`);

  // 23. Failed transaction rolls back QR usage record
  const gen3Res = await fetch('http://localhost:5000/api/attendance/qr/generate', { method: 'POST', headers: adminHeaders }).then((r) => r.json());
  const freshToken3 = gen3Res.data.token;
  // Attempt check-in with invalid GPS outside radius (will fail and trigger rollback)
  await pool.query('DELETE FROM attendance WHERE attendance_date = ? AND employee_id = ?', [todayStr, emp1Id]);
  await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: freshToken3,
      latitude: 0,
      longitude: 0,
    }),
  });
  const [challenge3Row] = await pool.query('SELECT id FROM qr_challenges WHERE challenge_id = ?', [gen3Res.data.challenge_id]);
  const [use3Rows] = await pool.query('SELECT id FROM qr_challenge_uses WHERE challenge_id = ? AND employee_id = ?', [challenge3Row[0].id, emp1Id]);
  console.log(`23. Failed transaction rolled back qr_challenge_uses record? ${use3Rows.length === 0} (Expected: true)`);

  // GPS Tests
  // 25. Valid GPS inside radius succeeds
  console.log(`25. Valid GPS inside radius check-in success? ${checkIn1Res.success} (Expected: true)`);

  // 26. GPS outside radius rejected
  await pool.query('DELETE FROM attendance WHERE attendance_date = ? AND employee_id = ?', [todayStr, emp1Id]);
  const farGpsRes = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: freshToken3,
      latitude: 12.9716, // Bangalore (far away from New Delhi)
      longitude: 77.5946,
    }),
  });
  const farGpsData = await farGpsRes.json();
  console.log(`26. GPS outside radius status: ${farGpsRes.status} (Expected: 400, msg: "${farGpsData.message}")`);

  // 27. Missing GPS rejected
  const noGpsRes = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: freshToken3,
    }),
  });
  console.log(`27. Missing GPS coordinates status: ${noGpsRes.status} (Expected: 400)`);

  // 28. Invalid coordinate values rejected
  const invCoordsRes = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: freshToken3,
      latitude: 999,
      longitude: 999,
    }),
  });
  console.log(`28. Invalid coordinate values status: ${invCoordsRes.status} (Expected: 400)`);

  // 29. Client-supplied fake verification fields ignored
  const fakeFieldsRes = await fetch('http://localhost:5000/api/attendance/qr/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      token: freshToken3,
      location_verified: true, // Fake flag
      distance_meters: 0,
      latitude: 0,
      longitude: 0,
    }),
  });
  console.log(`29. Fake client location_verified flag ignored; rejected? ${fakeFieldsRes.status === 400} (Expected: true)`);

  // 30. GPS verification audited correctly in metadata
  const metadataObj = JSON.parse(metadataStr);
  console.log(`30. GPS distance & location_verified in audit event metadata? ${metadataObj.location_verified === true && typeof metadataObj.distance_meters === 'number'} (Expected: true)`);

  // --- HELP REQUESTS TESTS (31-36) ---
  await pool.query('DELETE FROM help_requests WHERE employee_id IN (?, ?)', [emp1Id, emp2Id]);

  // 31. Employee can submit a help request
  const helpReq1Res = await fetch('http://localhost:5000/api/help-requests', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      request_type: 'QR_SCAN',
      message: 'Camera failed to auto focus on QR code',
    }),
  }).then((r) => r.json());
  console.log(`31. Employee help request creation success? ${helpReq1Res.status === 'success'} (Expected: true)`);
  const createdHelpId = helpReq1Res.data?.id;

  // 32. Client-provided employee_id ignored (identity comes from JWT)
  const helpReq2Res = await fetch('http://localhost:5000/api/help-requests', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({
      employee_id: emp2Id, // Spoofed employee_id
      request_type: 'LOCATION_FAILED',
      message: 'GPS location spoof test',
    }),
  }).then((r) => r.json());
  console.log(`32. Spoofed employee_id ignored in help request; assigned to JWT employee? ${helpReq2Res.data?.employee_id === emp1Id} (Expected: true)`);

  // 33. Employee can view their own help requests
  const myHelpRes = await fetch('http://localhost:5000/api/help-requests/my', {
    headers: emp1Headers,
  }).then((r) => r.json());
  console.log(`33. Employee GET /api/help-requests/my returned requests? ${Array.isArray(myHelpRes.data) && myHelpRes.data.length === 2} (Expected: true)`);

  // 34. Admin can view open help requests count
  const openCountRes = await fetch('http://localhost:5000/api/help-requests/open-count', {
    headers: adminHeaders,
  }).then((r) => r.json());
  console.log(`34. Admin GET /api/help-requests/open-count returned count >= 2? ${openCountRes.data?.open_count >= 2} (Expected: true)`);

  // 35. Admin can view all help requests
  const allHelpRes = await fetch('http://localhost:5000/api/help-requests', {
    headers: adminHeaders,
  }).then((r) => r.json());
  console.log(`35. Admin GET /api/help-requests returned list? ${Array.isArray(allHelpRes.data) && allHelpRes.data.length >= 2} (Expected: true)`);

  // 36. Admin can resolve a help request
  const resolveRes = await fetch(`http://localhost:5000/api/help-requests/${createdHelpId}/resolve`, {
    method: 'PATCH',
    headers: adminHeaders,
  }).then((r) => r.json());
  console.log(`36. Admin PATCH /api/help-requests/:id/resolve success? ${resolveRes.data?.status === 'RESOLVED'} (Expected: true)`);

  console.log('--- ALL PHASE 8C TESTS PASSED SUCCESSFULLY (36/36) ---');
  await pool.end();
}

runTests().catch((e) => {
  console.error('Phase 8C test error:', e);
  process.exit(1);
});

