const employeeService = require('../services/employeeService');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_STATUSES = ['active', 'inactive'];

/**
 * @desc    Create a new employee (Admin only)
 * @route   POST /api/employees
 * @access  Private (Admin)
 */
async function createEmployee(req, res, next) {
  try {
    const {
      employee_id,
      name,
      email,
      mobile,
      department,
      designation,
      status,
    } = req.body;

    // Validate required fields
    const missing = [];
    if (!employee_id || !employee_id.trim()) missing.push('employee_id');
    if (!name || !name.trim()) missing.push('name');
    if (!email || !email.trim()) missing.push('email');
    if (!mobile || !mobile.trim()) missing.push('mobile');
    if (!department || !department.trim()) missing.push('department');
    if (!designation || !designation.trim()) missing.push('designation');

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missing.join(', ')}.`,
      });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.',
      });
    }

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "inactive".',
      });
    }

    const employee = await employeeService.createEmployee({
      employee_id,
      name,
      email,
      mobile,
      department,
      designation,
      status: status ? status.trim().toLowerCase() : 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Employee created successfully.',
      data: employee,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    // Handle MySQL unique constraint violation gracefully
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Employee with this employee_id or email already exists.',
      });
    }
    next(error);
  }
}

/**
 * @desc    Get paginated and filtered list of employees
 * @route   GET /api/employees
 * @access  Private (Authenticated)
 */
async function getEmployees(req, res, next) {
  try {
    const result = await employeeService.getEmployees(req.query);

    return res.status(200).json({
      success: true,
      data: result.employees,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get single employee by ID
 * @route   GET /api/employees/:id
 * @access  Private (Authenticated)
 */
async function getEmployeeById(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID.',
      });
    }

    const employee = await employeeService.getEmployeeById(id);
    if (!employee) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update employee by ID (Admin only)
 * @route   PUT /api/employees/:id
 * @access  Private (Admin)
 */
async function updateEmployee(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID.',
      });
    }

    const { email, status } = req.body;

    // Validate email format if updating email
    if (email !== undefined && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.',
      });
    }

    // Validate status if updating status
    if (status !== undefined && !VALID_STATUSES.includes(status.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "inactive".',
      });
    }

    const updated = await employeeService.updateEmployee(id, req.body);

    return res.status(200).json({
      success: true,
      message: 'Employee updated successfully.',
      data: updated,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Employee with this employee_id or email already exists.',
      });
    }
    next(error);
  }
}

/**
 * @desc    Soft delete employee by ID (sets status to inactive, Admin only)
 * @route   DELETE /api/employees/:id
 * @access  Private (Admin)
 */
async function deleteEmployee(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID.',
      });
    }

    const result = await employeeService.deleteEmployee(id);

    return res.status(200).json({
      success: true,
      message: 'Employee deactivated successfully (soft delete).',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

module.exports = {
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  deleteEmployee,
};
