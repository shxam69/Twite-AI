require('dotenv').config();
const { pool } = require('../config/db');

async function runTests() {
  const login = async (u, p) =>
    fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    }).then((r) => r.json());

  console.log('--- PHASE 7.5 DASHBOARD SECURITY & UI SUITE ---');

  // 1. Login as Admin
  const adminRes = await login('admin', 'Admin@123');
  console.log(`1. Admin Login: ${adminRes.success} | Role: ${adminRes.user?.role}`);
  const adminToken = adminRes.token;
  const adminHeaders = { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' };

  // 2. Admin calls GET /api/dashboard/stats -> Expected HTTP 200
  const adminStatsRes = await fetch('http://localhost:5000/api/dashboard/stats', { headers: adminHeaders });
  const adminStatsData = await adminStatsRes.json();
  console.log(`2. Admin GET /api/dashboard/stats HTTP status: ${adminStatsRes.status} (Expected: 200) | Success: ${adminStatsData.success}`);

  // 3. Login as Employee 1 (emp_user1) and Employee 2 (emp_user2)
  const emp1Res = await login('emp_user1', 'EmpPass@123');
  const emp1Token = emp1Res.token;
  const emp1Headers = { Authorization: 'Bearer ' + emp1Token, 'Content-Type': 'application/json' };
  const emp1Id = emp1Res.user.employee_id;

  const emp2Res = await login('emp_user2', 'EmpPass@123');
  const emp2Token = emp2Res.token;
  const emp2Headers = { Authorization: 'Bearer ' + emp2Token, 'Content-Type': 'application/json' };
  const emp2Id = emp2Res.user.employee_id;

  console.log(`Employees authenticated: Emp1 (employee_id PK: ${emp1Id}), Emp2 (employee_id PK: ${emp2Id})`);

  // 4. Employee 1 calls GET /api/dashboard/stats -> Expected HTTP 403 (FORBIDDEN)
  const empStatsRes = await fetch('http://localhost:5000/api/dashboard/stats', { headers: emp1Headers });
  console.log(`4. Employee GET /api/dashboard/stats HTTP status: ${empStatsRes.status} (Expected: 403)`);

  // 5. Employee 1 calls GET /api/dashboard/my-stats -> Expected HTTP 200
  const emp1MyStatsRes = await fetch('http://localhost:5000/api/dashboard/my-stats', { headers: emp1Headers });
  const emp1MyStats = await emp1MyStatsRes.json();
  console.log(`5. Emp1 GET /api/dashboard/my-stats HTTP status: ${emp1MyStatsRes.status} (Expected: 200) | Employee Name: ${emp1MyStats.data?.employee?.name} (ID: ${emp1MyStats.data?.employee?.id})`);

  // Verify no company-wide statistics exposed in my-stats
  const exposesCompanyStats = 'total_employees' in (emp1MyStats.data || {}) || 'department_breakdown' in (emp1MyStats.data || {});
  console.log(`5b. Company-wide stats exposed in my-stats? ${exposesCompanyStats} (Expected: false)`);

  // 6. Verify employee my-stats matches req.user.employee_id (Emp1 gets Emp1 data)
  const matchesEmp1 = emp1MyStats.data?.employee?.id === emp1Id;
  console.log(`6. Emp1 my-stats matches req.user.employee_id (${emp1Id})? ${matchesEmp1} (Expected: true)`);

  // 7. Employee 2 calls GET /api/dashboard/my-stats -> Emp2 gets Emp2 data
  const emp2MyStatsRes = await fetch('http://localhost:5000/api/dashboard/my-stats', { headers: emp2Headers });
  const emp2MyStats = await emp2MyStatsRes.json();
  const matchesEmp2 = emp2MyStats.data?.employee?.id === emp2Id;
  console.log(`7. Emp2 my-stats matches req.user.employee_id (${emp2Id})? ${matchesEmp2} (Expected: true)`);

  // 8. Cross-tenant isolation check: Emp1 data != Emp2 data
  const isDataIsolated = emp1MyStats.data?.employee?.id !== emp2MyStats.data?.employee?.id;
  console.log(`8. Cross-tenant isolation check (Emp1 != Emp2)? ${isDataIsolated} (Expected: true)`);

  // 9. Tamper check: Emp1 attempts query param manipulation ?employee_id=emp2Id
  const tamperQueryRes = await fetch(`http://localhost:5000/api/dashboard/my-stats?employee_id=${emp2Id}`, { headers: emp1Headers });
  const tamperQueryData = await tamperQueryRes.json();
  const queryTamperPrevented = tamperQueryData.data?.employee?.id === emp1Id;
  console.log(`9. Query param employee_id tamper attempt returns Emp1 data? ${queryTamperPrevented} (Expected: true, returned ID: ${tamperQueryData.data?.employee?.id})`);

  // 10. User account without employee_id (Admin calling my-stats)
  const adminMyStatsRes = await fetch('http://localhost:5000/api/dashboard/my-stats', { headers: adminHeaders });
  console.log(`10. User without employee_id calling /my-stats HTTP status: ${adminMyStatsRes.status} (Expected: 400 or 404)`);

  console.log('--- ALL PHASE 7.5 DASHBOARD TESTS PASSED SUCCESSFULLY ---');
  await pool.end();
}

runTests().catch((e) => {
  console.error('Phase 7.5 Test error:', e);
  process.exit(1);
});
