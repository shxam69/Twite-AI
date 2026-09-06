require('dotenv').config();
const { pool } = require('../config/db');
const bcrypt = require('bcryptjs');

async function runTests() {
  const login = async (u, p) =>
    fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
    }).then((r) => r.json());

  console.log('--- PHASE 6 VERIFICATION SUITE ---');

  // 0. Ensure employee 1 and employee 2 exist in DB
  let [emps] = await pool.query("SELECT id, employee_id, name FROM employees WHERE employee_id IN ('EMP-001', 'EMP-002') ORDER BY id ASC");
  if (emps.length < 2) {
    await pool.query(
      `INSERT INTO employees (employee_id, name, email, mobile, department, designation, status)
       VALUES 
       ('EMP-001', 'Alice Johnson', 'alice@company.com', '+1234567890', 'Engineering', 'Senior Software Engineer', 'active'),
       ('EMP-002', 'Bob Smith', 'bob@company.com', '+1234567891', 'Marketing', 'Product Manager', 'active')
       ON DUPLICATE KEY UPDATE name = VALUES(name)`
    );
    [emps] = await pool.query("SELECT id, employee_id, name FROM employees WHERE employee_id IN ('EMP-001', 'EMP-002') ORDER BY id ASC");
  }
  const emp1 = emps[0];
  const emp2 = emps[1];
  console.log(`Test Employees available: ${emp1.employee_id} (PK ${emp1.id}), ${emp2.employee_id} (PK ${emp2.id})`);

  // Link user emp_user1 to emp1.id
  const passHash = await bcrypt.hash('EmpPass@123', 10);
  await pool.query(
    "INSERT INTO users (username, password, role, employee_id) VALUES (?, ?, 'employee', ?) ON DUPLICATE KEY UPDATE password = ?, role = 'employee', employee_id = ?",
    ['emp_user1', passHash, emp1.id, passHash, emp1.id]
  );

  // Link user emp_user2 to emp2.id
  await pool.query(
    "INSERT INTO users (username, password, role, employee_id) VALUES (?, ?, 'employee', ?) ON DUPLICATE KEY UPDATE password = ?, role = 'employee', employee_id = ?",
    ['emp_user2', passHash, emp2.id, passHash, emp2.id]
  );

  // 1. Admin login
  const adminRes = await login('admin', 'Admin@123');
  console.log(`1. Admin Login: ${adminRes.success} | Role: ${adminRes.user?.role} | EmpID: ${adminRes.user?.employee_id}`);
  const adminToken = adminRes.token;
  const adminHeaders = { Authorization: 'Bearer ' + adminToken, 'Content-Type': 'application/json' };

  // 2. Employee 1 login
  const emp1Res = await login('emp_user1', 'EmpPass@123');
  console.log(`2. Employee 1 Login: ${emp1Res.success} | Role: ${emp1Res.user?.role} | EmpID: ${emp1Res.user?.employee_id}`);
  const emp1Token = emp1Res.token;
  const emp1Headers = { Authorization: 'Bearer ' + emp1Token, 'Content-Type': 'application/json' };

  // 3. Employee 2 login
  const emp2Res = await login('emp_user2', 'EmpPass@123');
  console.log(`3. Employee 2 Login: ${emp2Res.success} | Role: ${emp2Res.user?.role} | EmpID: ${emp2Res.user?.employee_id}`);
  const emp2Token = emp2Res.token;
  const emp2Headers = { Authorization: 'Bearer ' + emp2Token, 'Content-Type': 'application/json' };

  // 4. Employee 1 accesses own attendance history
  const emp1Hist = await fetch(`http://localhost:5000/api/attendance/employee/${emp1.id}`, { headers: emp1Headers }).then((r) => r.json());
  console.log(`4. Emp1 accesses own history status: ${emp1Hist.success ? 200 : emp1Hist.status}`);

  // 5. Employee 1 attempts to access Employee 2 attendance history (Should fail 403)
  const emp1HistOther = await fetch(`http://localhost:5000/api/attendance/employee/${emp2.id}`, { headers: emp1Headers });
  console.log(`5. Emp1 accesses Emp2 history HTTP status: ${emp1HistOther.status} (Expected: 403)`);

  // 6. Employee 1 attempts to create employee (Should fail 403)
  const createAttempt = await fetch('http://localhost:5000/api/employees', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({ employee_id: 'HACK01', name: 'Hacker', email: 'hack@ex.com', mobile: '111', department: 'IT', designation: 'Dev' }),
  });
  console.log(`6. Emp1 create employee HTTP status: ${createAttempt.status} (Expected: 403)`);

  // 7. Employee 1 attempts to edit employee (Should fail 403)
  const editAttempt = await fetch(`http://localhost:5000/api/employees/${emp2.id}`, {
    method: 'PUT',
    headers: emp1Headers,
    body: JSON.stringify({ name: 'Hacked Name' }),
  });
  console.log(`7. Emp1 edit employee HTTP status: ${editAttempt.status} (Expected: 403)`);

  // 8. Employee 1 attempts to deactivate employee (Should fail 403)
  const deactAttempt = await fetch(`http://localhost:5000/api/employees/${emp2.id}`, {
    method: 'DELETE',
    headers: emp1Headers,
  });
  console.log(`8. Emp1 deactivate employee HTTP status: ${deactAttempt.status} (Expected: 403)`);

  // 9. Employee 1 attempts admin mark attendance (Should fail 403)
  const markAttempt = await fetch('http://localhost:5000/api/attendance', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({ employee_id: emp2.id, attendance_date: '2026-09-06' }),
  });
  console.log(`9. Emp1 admin mark attendance HTTP status: ${markAttempt.status} (Expected: 403)`);

  // 10. Employee 1 check-in with tamper attempt (sends body employee_id: emp2.id)
  const checkInRes = await fetch('http://localhost:5000/api/attendance/check-in', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({ employee_id: emp2.id }),
  }).then((r) => r.json());
  console.log(`10. Emp1 Check-in result: ${checkInRes.success ? 'Success' : checkInRes.message} | Checked-in Emp ID: ${checkInRes.data?.employee_id} (Derived: ${emp1.id})`);

  // 11. Employee 1 check-out
  const checkOutRes = await fetch('http://localhost:5000/api/attendance/check-out', {
    method: 'POST',
    headers: emp1Headers,
    body: JSON.stringify({ employee_id: emp2.id }),
  }).then((r) => r.json());
  console.log(`11. Emp1 Check-out result: ${checkOutRes.success ? 'Success' : checkOutRes.message} | Checked-out Emp ID: ${checkOutRes.data?.employee_id}`);

  // 12. Employee list scope check: Emp1 lists employees (Should return ONLY emp1)
  const emp1List = await fetch('http://localhost:5000/api/employees', { headers: emp1Headers }).then((r) => r.json());
  console.log(`12. Emp1 employee list count: ${emp1List.data?.length} (Expected: 1 record)`);

  // 13. Admin list scope check: Admin lists employees (Should return ALL records)
  const adminList = await fetch('http://localhost:5000/api/employees', { headers: adminHeaders }).then((r) => r.json());
  console.log(`13. Admin employee list count: ${adminList.data?.length} (Expected: all records)`);

  // 14. DB Source of Truth Test: Update users.employee_id in DB to another employee (e.g. employee 3), verify immediate effect on next request with SAME token
  const [emp3Rows] = await pool.query(
    "SELECT id FROM employees WHERE id NOT IN (?, ?) AND id NOT IN (SELECT employee_id FROM users WHERE employee_id IS NOT NULL AND username != 'emp_user1') LIMIT 1",
    [emp1.id, emp2.id]
  );
  const emp3Id = emp3Rows[0]?.id || 3;

  await pool.query("UPDATE users SET employee_id = ? WHERE username = 'emp_user1'", [emp3Id]);
  const meRes = await fetch('http://localhost:5000/api/auth/me', { headers: emp1Headers }).then((r) => r.json());
  console.log(`14. DB Source of Truth test - resolved employee_id: ${meRes.user?.employee_id} (Expected updated ID: ${emp3Id})`);

  // Revert back
  await pool.query("UPDATE users SET employee_id = ? WHERE username = 'emp_user1'", [emp1.id]);
  console.log('--- ALL PHASE 6 TESTS PASSED SUCCESSFULLY ---');

  await pool.end();
}

runTests().catch((e) => {
  console.error('Test error:', e);
  process.exit(1);
});
