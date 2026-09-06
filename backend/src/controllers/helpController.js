const helpService = require('../services/helpService');

/**
 * POST /api/help-requests
 * Employee creates a help request.
 */
async function createHelpRequest(req, res, next) {
  try {
    const employee_id = req.user.employee_id;
    if (!employee_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Authenticated user is not associated with an employee record',
      });
    }

    const { request_type, message } = req.body;
    const request = await helpService.createHelpRequest({
      employee_id,
      request_type,
      message,
    });

    return res.status(201).json({
      status: 'success',
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/help-requests/my
 * Employee retrieves their own help requests.
 */
async function getMyHelpRequests(req, res, next) {
  try {
    const employee_id = req.user.employee_id;
    if (!employee_id) {
      return res.status(400).json({
        status: 'error',
        message: 'Authenticated user is not associated with an employee record',
      });
    }

    const requests = await helpService.getEmployeeHelpRequests(employee_id);
    return res.status(200).json({
      status: 'success',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/help-requests
 * Admin/HR list all help requests.
 */
async function getAllHelpRequests(req, res, next) {
  try {
    const { status } = req.query;
    const requests = await helpService.getAllHelpRequests({ status });
    return res.status(200).json({
      status: 'success',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/help-requests/open-count
 * Admin/HR get count of unresolved help requests for badge.
 */
async function getOpenCount(req, res, next) {
  try {
    const count = await helpService.getOpenCount();
    return res.status(200).json({
      status: 'success',
      data: { open_count: count },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/help-requests/:id/resolve
 * Admin/HR resolve a help request.
 */
async function resolveHelpRequest(req, res, next) {
  try {
    const { id } = req.params;
    const admin_user_id = req.user.id;

    const updated = await helpService.resolveHelpRequest(id, admin_user_id);
    return res.status(200).json({
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createHelpRequest,
  getMyHelpRequests,
  getAllHelpRequests,
  getOpenCount,
  resolveHelpRequest,
};
