/**
 * testPhase9.js
 * Automated test suite for Phase 9 features using native fetch
 */

require('dotenv').config();

const API_URL = process.env.TEST_API_URL || 'http://localhost:5000/api';

let adminToken = '';
let employeeToken = '';
let createdLeaveId = null;
let createdCorrectionId = null;
let sampleAttendanceId = null;

async function runTests() {
  console.log('==================================================');
  console.log('STARTING PHASE 9 AUTOMATED TEST SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Authenticate Admin
  await test('1. Login as Admin', async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: process.env.ADMIN_USERNAME || 'admin',
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
      }),
    });
    const data = await res.json();
    if (!data.success || !data.token) throw new Error(data.message || 'Login failed');
    adminToken = data.token;
  });

  // 2. Authenticate Employee
  await test('2. Login as Employee (emp_user1)', async () => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'emp_user1',
        password: 'EmpPass@123',
      }),
    });
    const data = await res.json();
    if (!data.success || !data.token) throw new Error(data.message || 'Login failed');
    employeeToken = data.token;
  });

  // 3. Employee Apply for Leave Request
  await test('3. Employee Apply for Leave Request', async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startDate = tomorrow.toISOString().split('T')[0];

    const nextDay = new Date();
    nextDay.setDate(nextDay.getDate() + 2);
    const endDate = nextDay.toISOString().split('T')[0];

    const res = await fetch(`${API_URL}/leave-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({
        leave_type: 'SICK',
        start_date: startDate,
        end_date: endDate,
        reason: 'Medical checkup and rest',
      }),
    });
    const data = await res.json();
    if (!data.success || !data.data?.id) throw new Error(data.message || 'Leave creation failed');
    createdLeaveId = data.data.id;
  });

  // 4. Employee View My Leave Requests
  await test('4. Employee View My Leave Requests', async () => {
    const res = await fetch(`${API_URL}/leave-requests/my`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) throw new Error(data.message || 'Fetch my leave failed');
    const found = data.data.find((l) => l.id === createdLeaveId);
    if (!found) throw new Error('Created leave request not found in employee list');
  });

  // 5. Admin View All Leave Requests
  await test('5. Admin View All Leave Requests', async () => {
    const res = await fetch(`${API_URL}/leave-requests`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (!data.success || !Array.isArray(data.data)) throw new Error(data.message || 'Fetch all leave failed');
  });

  // 6. Admin Approve Leave Request
  await test('6. Admin Approve Leave Request', async () => {
    const res = await fetch(`${API_URL}/leave-requests/${createdLeaveId}/approve`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ admin_comment: 'Approved for medical leave.' }),
    });
    const data = await res.json();
    if (!data.success || data.data.status !== 'APPROVED') throw new Error(data.message || 'Leave approval failed');
  });

  // 7. Get an existing attendance record ID for correction test
  await test('7. Fetch Existing Attendance Record for Correction', async () => {
    const res = await fetch(`${API_URL}/attendance`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      sampleAttendanceId = data.data[0].id;
    }
  });

  // 8. Employee Submit Attendance Correction Request
  await test('8. Employee Submit Attendance Correction Request', async () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const res = await fetch(`${API_URL}/attendance/corrections`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${employeeToken}`,
      },
      body: JSON.stringify({
        attendance_id: sampleAttendanceId,
        requested_date: todayStr,
        requested_check_in: '09:00:00',
        requested_check_out: '17:30:00',
        reason: 'Network outage during check-in timestamp',
      }),
    });
    const data = await res.json();
    if (!data.success || !data.data?.id) throw new Error(data.message || 'Correction submission failed');
    createdCorrectionId = data.data.id;
  });

  // 9. Admin Approve Attendance Correction Request
  await test('9. Admin Approve Attendance Correction Request', async () => {
    if (!createdCorrectionId) return;
    const res = await fetch(`${API_URL}/attendance/corrections/${createdCorrectionId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ admin_comment: 'Verified with logs and approved.' }),
    });
    const data = await res.json();
    if (!data.success || data.data.status !== 'APPROVED') throw new Error(data.message || 'Correction approval failed');
  });

  // 10. Admin Update Attendance Remark
  await test('10. Admin Update Attendance Remark', async () => {
    if (!sampleAttendanceId) return;
    const res = await fetch(`${API_URL}/attendance/${sampleAttendanceId}/remark`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ remark: 'Verified by HR - On-site audit' }),
    });
    const data = await res.json();
    if (!data.success || !data.data.remarks.includes('Verified by HR')) {
      throw new Error(data.message || 'Remark update failed');
    }
  });

  // 11. Admin Notification Counts
  await test('11. Get Unified Admin Notification Counts', async () => {
    const res = await fetch(`${API_URL}/dashboard/notifications/counts`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    if (!data.success || (data.data.total === undefined && data.data.total_action_required === undefined)) {
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }
  });

  // 12. Dashboard Analytics & Trends
  await test('12. Get Admin Dashboard Analytics & 7-Day Trend', async () => {
    const res = await fetch(`${API_URL}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    const trend = data.data.trend_last_7_days || data.data.seven_day_trend;
    if (!data.success || !Array.isArray(trend)) {
      throw new Error(`Invalid response structure: ${JSON.stringify(data)}`);
    }
  });

  // 13. Admin Attendance CSV Export
  await test('13. Admin Export Attendance CSV Report', async () => {
    const res = await fetch(`${API_URL}/attendance/export`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
    if (!contentType.includes('text/csv') || (!text.includes('Attendance Date') && !text.includes('Employee Code'))) {
      throw new Error(`Invalid CSV response (Content-Type: ${contentType}): ${text.slice(0, 100)}`);
    }
  });

  // 14. Verify Swagger OpenAPI Endpoint (/api/docs)
  await test('14. Verify Swagger OpenAPI Endpoint (/api/docs)', async () => {
    const res = await fetch(`${API_URL}/docs/`);
    const text = await res.text();
    if (res.status !== 200 || !text.includes('Swagger UI')) {
      throw new Error(`HTTP ${res.status}: ${text.slice(0, 100)}`);
    }
  });

  console.log('\n==================================================');
  console.log(`PHASE 9 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
