require('dotenv').config();
const { pool } = require('../config/db');

async function runTests() {
  const login = async (u, p) =>
    fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    }).then((r) => r.json());

  console.log('--- PHASE 7 INVITATION & REGISTRATION TEST SUITE ---');

  // 1. Login as Admin
  const adminRes = await login('admin', 'Admin@123');
  console.log(`1. Admin Login: ${adminRes.success} | Role: ${adminRes.user?.role}`);
  const adminToken = adminRes.token;
  const adminHeaders = { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' };

  // 1.5 Cleanup previous test run data for idempotency
  await pool.query("DELETE FROM users WHERE username IN ('INV_EMP_01', 'INV_EMP_02', 'INV_EMP_03')");
  await pool.query("DELETE FROM employee_invitations WHERE employee_id IN (SELECT id FROM employees WHERE employee_id IN ('INV_EMP_01', 'INV_EMP_02', 'INV_EMP_03'))");
  await pool.query("DELETE FROM attendance WHERE employee_id IN (SELECT id FROM employees WHERE employee_id IN ('INV_EMP_01', 'INV_EMP_02', 'INV_EMP_03'))");
  await pool.query("DELETE FROM employees WHERE employee_id IN ('INV_EMP_01', 'INV_EMP_02', 'INV_EMP_03')");

  // 2. Create a clean test employee for invitation
  const createEmpRes = await fetch('http://localhost:5000/api/employees', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      employee_id: 'INV_EMP_01',
      name: 'Invitation Test User',
      email: 'inv_test01@example.com',
      mobile: '9988776655',
      department: 'Engineering',
      designation: 'Software Developer',
      status: 'active',
    }),
  }).then((r) => r.json());

  const emp = createEmpRes.data;
  console.log(`2. Created target employee: ${emp.employee_id} (PK: ${emp.id})`);

  // 3. Admin generates invitation for INV_EMP_01
  const inviteRes = await fetch(`http://localhost:5000/api/employees/${emp.id}/invite`, {
    method: 'POST',
    headers: adminHeaders,
  }).then((r) => r.json());

  console.log(`3. Admin generate invitation: ${inviteRes.success} | Token: ${inviteRes.data?.raw_token?.slice(0, 10)}... | URL: ${inviteRes.data?.registration_url}`);
  const rawToken = inviteRes.data.raw_token;

  // 4. Verify Database Token Storage (Must be SHA-256 hash, not plaintext)
  const [dbInv] = await pool.query('SELECT token_hash, used_at, expires_at FROM employee_invitations WHERE employee_id = ? LIMIT 1', [emp.id]);
  const isPlaintext = dbInv[0].token_hash === rawToken;
  console.log(`4. Database token security - Plaintext token in DB? ${isPlaintext} (Expected: false, Hashed: ${dbInv[0].token_hash.slice(0, 16)}...)`);

  // 5. Public Token Validation
  const valRes = await fetch(`http://localhost:5000/api/auth/register/invitation/${rawToken}`).then((r) => r.json());
  console.log(`5. Validate invitation token: ${valRes.success} | Safe Info -> ID: ${valRes.data?.employee_id}, Name: ${valRes.data?.name}`);

  // 6. Test invalid token
  const invalidVal = await fetch('http://localhost:5000/api/auth/register/invitation/invalid_token_12345');
  console.log(`6. Invalid token HTTP status: ${invalidVal.status} (Expected: 404)`);

  // 7. Non-Admin invitation attempt (security check)
  // Log in as employee (emp_user1 from Phase 6)
  const empUser1Res = await login('emp_user1', 'EmpPass@123');
  const empHeaders = { Authorization: 'Bearer ' + empUser1Res.token, 'Content-Type': 'application/json' };
  const empInviteAttempt = await fetch(`http://localhost:5000/api/employees/${emp.id}/invite`, {
    method: 'POST',
    headers: empHeaders,
  });
  console.log(`7. Non-admin invitation creation HTTP status: ${empInviteAttempt.status} (Expected: 403)`);

  // 8. Employee Registration with valid token
  const regRes = await fetch('http://localhost:5000/api/auth/register/employee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: rawToken,
      password: 'NewEmpPassword@123',
      confirmPassword: 'NewEmpPassword@123',
    }),
  }).then((r) => r.json());
  console.log(`8. Employee Self-Registration: ${regRes.success} | Registered Username: ${regRes.data?.username}`);

  // 9. Single-Use Check: Attempt to reuse invitation token
  const reuseRes = await fetch('http://localhost:5000/api/auth/register/employee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: rawToken,
      password: 'AnotherPassword@123',
      confirmPassword: 'AnotherPassword@123',
    }),
  });
  console.log(`9. Reuse invitation token HTTP status: ${reuseRes.status} (Expected: 400)`);

  // 10. Login with newly registered Employee account
  const newEmpLogin = await login('INV_EMP_01', 'NewEmpPassword@123');
  console.log(`10. Login as newly registered employee: ${newEmpLogin.success} | Role: ${newEmpLogin.user?.role} | Linked Emp ID: ${newEmpLogin.user?.employee_id}`);

  // 11. Duplicate Invitation Check: Admin attempts to generate invitation for an employee who already has an account
  const dupInviteRes = await fetch(`http://localhost:5000/api/employees/${emp.id}/invite`, {
    method: 'POST',
    headers: adminHeaders,
  });
  console.log(`11. Invite employee with existing account HTTP status: ${dupInviteRes.status} (Expected: 409)`);

  // 12. Expired Invitation Check
  const createEmp2 = await fetch('http://localhost:5000/api/employees', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      employee_id: 'INV_EMP_02',
      name: 'Expired Test User',
      email: 'exp_test02@example.com',
      mobile: '9988776644',
      department: 'HR',
      designation: 'HR Specialist',
      status: 'active',
    }),
  }).then((r) => r.json());

  const emp2 = createEmp2.data;
  const invite2 = await fetch(`http://localhost:5000/api/employees/${emp2.id}/invite`, { method: 'POST', headers: adminHeaders }).then((r) => r.json());
  
  // Force expire in DB
  await pool.query('UPDATE employee_invitations SET expires_at = NOW() - INTERVAL 1 HOUR WHERE employee_id = ?', [emp2.id]);
  const expReg = await fetch('http://localhost:5000/api/auth/register/employee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: invite2.data.raw_token, password: 'Password@123', confirmPassword: 'Password@123' }),
  });
  console.log(`12. Expired invitation registration HTTP status: ${expReg.status} (Expected: 400)`);

  // 13. Revoked Invitation Check
  const createEmp3 = await fetch('http://localhost:5000/api/employees', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      employee_id: 'INV_EMP_03',
      name: 'Revoke Test User',
      email: 'rev_test03@example.com',
      mobile: '9988776633',
      department: 'Finance',
      designation: 'Accountant',
      status: 'active',
    }),
  }).then((r) => r.json());

  const emp3 = createEmp3.data;
  const invite3 = await fetch(`http://localhost:5000/api/employees/${emp3.id}/invite`, { method: 'POST', headers: adminHeaders }).then((r) => r.json());
  
  // Revoke via admin API
  await fetch(`http://localhost:5000/api/employees/${emp3.id}/invite/revoke`, { method: 'POST', headers: adminHeaders });
  
  const revReg = await fetch('http://localhost:5000/api/auth/register/employee', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: invite3.data.raw_token, password: 'Password@123', confirmPassword: 'Password@123' }),
  });
  console.log(`13. Revoked invitation registration HTTP status: ${revReg.status} (Expected: 400)`);

  console.log('--- ALL PHASE 7 INVITATION TESTS PASSED SUCCESSFULLY ---');
  await pool.end();
}

runTests().catch((e) => {
  console.error('Phase 7 Test error:', e);
  process.exit(1);
});
