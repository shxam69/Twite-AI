const employeeService = require('../services/employeeService');
const invitationService = require('../services/invitationService');

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

    // Validate required fields (mobile is optional)
    const missing = [];
    if (!employee_id || !employee_id.trim()) missing.push('employee_id');
    if (!name || !name.trim()) missing.push('name');
    if (!email || !email.trim()) missing.push('email');
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

    // Validate mobile format if provided (optional field - requires exactly 10 digits)
    let sanitizedMobile = null;
    if (mobile !== undefined && mobile !== null && typeof mobile === 'string' && mobile.trim() !== '') {
      const trimmedMobile = mobile.trim();
      const PHONE_REGEX = /^[0-9]{10}$/;
      if (!PHONE_REGEX.test(trimmedMobile)) {
        return res.status(400).json({
          success: false,
          message: 'Mobile number must be exactly 10 digits.',
        });
      }
      sanitizedMobile = trimmedMobile;
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
      mobile: sanitizedMobile,
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
    const queryParams = { ...req.query };

    // RBAC: Non-admin employees can only view their own employee record
    if (req.user.role === 'employee') {
      if (!req.user.employee_id) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
      }
      queryParams.id = req.user.employee_id;
    }

    const result = await employeeService.getEmployees(queryParams);

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

    // RBAC: Employees can only view their own record
    if (req.user.role === 'employee' && id !== req.user.employee_id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to view another employee\'s details.',
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

    const { email, mobile, status } = req.body;

    // Validate email format if updating email
    if (email !== undefined && !EMAIL_REGEX.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format.',
      });
    }

    // Validate mobile format if updating mobile (optional, allowed to be cleared/null, requires exactly 10 digits if provided)
    if (mobile !== undefined && mobile !== null && typeof mobile === 'string' && mobile.trim() !== '') {
      const PHONE_REGEX = /^[0-9]{10}$/;
      if (!PHONE_REGEX.test(mobile.trim())) {
        return res.status(400).json({
          success: false,
          message: 'Mobile number must be exactly 10 digits.',
        });
      }
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

/**
 * @desc    Generate an employee invitation token and link (Admin)
 * @route   POST /api/employees/:id/invite
 * @access  Private (Admin)
 */
async function createInvitation(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID.',
      });
    }

    const appBaseUrl = req.get('origin') || (req.get('referer') ? new URL(req.get('referer')).origin : '');
    const result = await invitationService.createInvitation(id, req.user.id, appBaseUrl);

    return res.status(201).json({
      success: true,
      message: 'Invitation link generated successfully.',
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

/**
 * @desc    Get invitation & account status for an employee (Admin)
 * @route   GET /api/employees/:id/invitation
 * @access  Private (Admin)
 */
async function getInvitationStatus(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID.',
      });
    }

    const result = await invitationService.getInvitationStatus(id);

    return res.status(200).json({
      success: true,
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

/**
 * @desc    Revoke active invitation link for an employee (Admin)
 * @route   POST /api/employees/:id/invite/revoke
 * @access  Private (Admin)
 */
async function revokeInvitation(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid employee ID.',
      });
    }

    const result = await invitationService.revokeInvitation(id);

    return res.status(200).json({
      success: true,
      message: 'Invitation revoked successfully.',
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
  createInvitation,
  getInvitationStatus,
  revokeInvitation,
};
