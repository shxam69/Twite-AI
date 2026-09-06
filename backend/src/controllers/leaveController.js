const leaveService = require('../services/leaveService');

/**
 * POST /api/leave-requests
 * Employee creates a leave request.
 */
async function createLeaveRequest(req, res, next) {
  try {
    const employee_id = req.user.employee_id;
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Authenticated user is not associated with an employee record',
      });
    }

    const { leave_type, start_date, end_date, reason } = req.body;
    const leaveRequest = await leaveService.createLeaveRequest({
      employee_id, // Identity strictly from JWT
      leave_type,
      start_date,
      end_date,
      reason,
    });

    return res.status(201).json({
      success: true,
      status: 'success',
      data: leaveRequest,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyLeaveRequests(req, res, next) {
  try {
    const employee_id = req.user.employee_id;
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Authenticated user is not associated with an employee record',
      });
    }

    const requests = await leaveService.getEmployeeLeaveRequests(employee_id);
    return res.status(200).json({
      success: true,
      status: 'success',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

async function getAllLeaveRequests(req, res, next) {
  try {
    const { status } = req.query;
    const requests = await leaveService.getAllLeaveRequests({ status });
    return res.status(200).json({
      success: true,
      status: 'success',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

async function getLeaveRequestById(req, res, next) {
  try {
    const { id } = req.params;
    const request = await leaveService.getLeaveRequestById(id);

    if (req.user.role === 'employee' && request.employee_id !== req.user.employee_id) {
      return res.status(403).json({
        success: false,
        status: 'error',
        message: 'Forbidden: You do not have permission to view this leave request',
      });
    }

    return res.status(200).json({
      success: true,
      status: 'success',
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

async function approveLeaveRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;
    const admin_user_id = req.user.id;

    const updated = await leaveService.approveLeaveRequest(id, admin_user_id, admin_comment);
    return res.status(200).json({
      success: true,
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function rejectLeaveRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;
    const admin_user_id = req.user.id;

    const updated = await leaveService.rejectLeaveRequest(id, admin_user_id, admin_comment);
    return res.status(200).json({
      success: true,
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createLeaveRequest,
  getMyLeaveRequests,
  getAllLeaveRequests,
  getLeaveRequestById,
  approveLeaveRequest,
  rejectLeaveRequest,
};
