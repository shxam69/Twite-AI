const { pool } = require('../config/db');

/**
 * Whitelist for sortable columns
 */
const ALLOWED_SORT_COLUMNS = {
  id: 'e.id',
  employee_id: 'e.employee_id',
  name: 'e.name',
  email: 'e.email',
  mobile: 'e.mobile',
  department: 'e.department',
  designation: 'e.designation',
  status: 'e.status',
  created_at: 'e.created_at',
  updated_at: 'e.updated_at',
};

/**
 * Create a new employee
 */
async function createEmployee(data) {
  const {
    employee_id,
    name,
    email,
    mobile,
    department,
    designation,
    status = 'active',
  } = data;

  // Check duplicate employee_id
  const [existingId] = await pool.query(
    'SELECT id FROM employees WHERE employee_id = ? LIMIT 1',
    [employee_id.trim()]
  );
  if (existingId.length > 0) {
    const error = new Error('Employee with this employee_id already exists.');
    error.status = 409;
    throw error;
  }

  // Check duplicate email
  const [existingEmail] = await pool.query(
    'SELECT id FROM employees WHERE email = ? LIMIT 1',
    [email.trim().toLowerCase()]
  );
  if (existingEmail.length > 0) {
    const error = new Error('Employee with this email already exists.');
    error.status = 409;
    throw error;
  }

  const [result] = await pool.query(
    `INSERT INTO employees 
      (employee_id, name, email, mobile, department, designation, status) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      employee_id.trim(),
      name.trim(),
      email.trim().toLowerCase(),
      mobile.trim(),
      department.trim(),
      designation.trim(),
      status,
    ]
  );

  return getEmployeeById(result.insertId);
}

/**
 * Retrieve paginated and filtered list of employees
 */
async function getEmployees(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
  const offset = (page - 1) * limit;

  const { search, department, status, sortBy, sortOrder } = query;

  const conditions = [];
  const params = [];

  // Filter: search across multiple columns
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(
      '(e.employee_id LIKE ? OR e.name LIKE ? OR e.email LIKE ? OR e.mobile LIKE ? OR e.department LIKE ? OR e.designation LIKE ?)'
    );
    params.push(term, term, term, term, term, term);
  }

  // Filter: department
  if (department && department.trim()) {
    conditions.push('e.department = ?');
    params.push(department.trim());
  }

  // Filter: status
  if (status && status.trim()) {
    conditions.push('e.status = ?');
    params.push(status.trim().toLowerCase());
  }

  // Filter: specific primary key id (for RBAC — employee sees only their own record)
  if (query.id) {
    conditions.push('e.id = ?');
    params.push(parseInt(query.id, 10));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Safe sorting with column whitelist
  const safeSortBy = ALLOWED_SORT_COLUMNS[sortBy] || 'e.created_at';
  const safeSortOrder =
    sortOrder && sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  // Count total records — include same JOINs as dataSql so the alias context
  // is consistent and MySQL does not raise an ambiguous-column error for `e.id`
  // (employees, users, and employee_invitations all have an `id` column).
  const countSql = `
    SELECT COUNT(DISTINCT e.id) AS total
    FROM employees e
    LEFT JOIN users u ON u.employee_id = e.id
    LEFT JOIN employee_invitations inv ON inv.employee_id = e.id AND inv.used_at IS NULL AND inv.expires_at > NOW()
    ${whereClause}
  `;
  const [countResult] = await pool.query(countSql, params);
  const total = countResult[0].total;
  const totalPages = Math.ceil(total / limit) || 1;

  // Retrieve records with parameterized pagination and account/invitation indicators
  const dataSql = `
    SELECT 
      e.id, 
      e.employee_id, 
      e.name, 
      e.email, 
      e.mobile, 
      e.department, 
      e.designation, 
      e.status, 
      e.created_at, 
      e.updated_at,
      IF(u.id IS NOT NULL, 1, 0) AS has_account,
      IF(MAX(inv.id) IS NOT NULL, 1, 0) AS pending_invitation
    FROM employees e
    LEFT JOIN users u ON u.employee_id = e.id
    LEFT JOIN employee_invitations inv ON inv.employee_id = e.id AND inv.used_at IS NULL AND inv.expires_at > NOW()
    ${whereClause}
    GROUP BY e.id
    ORDER BY ${safeSortBy} ${safeSortOrder}
    LIMIT ? OFFSET ?
  `;
  const [employees] = await pool.query(dataSql, [...params, limit, offset]);

  return {
    employees,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Get a single employee by ID
 */
async function getEmployeeById(id) {
  const [rows] = await pool.query(
    `SELECT id, employee_id, name, email, mobile, department, designation, status, created_at, updated_at
     FROM employees 
     WHERE id = ? 
     LIMIT 1`,
    [id]
  );

  return rows.length > 0 ? rows[0] : null;
}

/**
 * Update employee fields
 */
async function updateEmployee(id, data) {
  // Verify employee exists
  const existing = await getEmployeeById(id);
  if (!existing) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  // Check duplicate employee_id if changing
  if (data.employee_id && data.employee_id.trim() !== existing.employee_id) {
    const [dupId] = await pool.query(
      'SELECT id FROM employees WHERE employee_id = ? AND id != ? LIMIT 1',
      [data.employee_id.trim(), id]
    );
    if (dupId.length > 0) {
      const error = new Error('Employee with this employee_id already exists.');
      error.status = 409;
      throw error;
    }
  }

  // Check duplicate email if changing
  if (data.email && data.email.trim().toLowerCase() !== existing.email) {
    const [dupEmail] = await pool.query(
      'SELECT id FROM employees WHERE email = ? AND id != ? LIMIT 1',
      [data.email.trim().toLowerCase(), id]
    );
    if (dupEmail.length > 0) {
      const error = new Error('Employee with this email already exists.');
      error.status = 409;
      throw error;
    }
  }

  const updates = [];
  const params = [];

  const allowedFields = [
    'employee_id',
    'name',
    'email',
    'mobile',
    'department',
    'designation',
    'status',
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates.push(`${field} = ?`);
      let val = data[field];
      if (typeof val === 'string') {
        val = field === 'email' ? val.trim().toLowerCase() : val.trim();
      }
      params.push(val);
    }
  }

  if (updates.length > 0) {
    params.push(id);
    await pool.query(
      `UPDATE employees SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  }

  return getEmployeeById(id);
}

/**
 * Soft delete employee: sets status to 'inactive'
 */
async function deleteEmployee(id) {
  const existing = await getEmployeeById(id);
  if (!existing) {
    const error = new Error('Employee not found.');
    error.status = 404;
    throw error;
  }

  await pool.query('UPDATE employees SET status = ? WHERE id = ?', ['inactive', id]);

  return {
    id: existing.id,
    employee_id: existing.employee_id,
    status: 'inactive',
  };
}

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};
