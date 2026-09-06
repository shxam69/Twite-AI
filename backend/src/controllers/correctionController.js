const correctionService = require('../services/correctionService');

/**
 * POST /api/attendance/corrections
 * Employee submits an attendance correction request.
 */
async function createCorrectionRequest(req, res, next) {
  try {
    const employee_id = req.user.employee_id;
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Authenticated user is not associated with an employee record',
      });
    }

    const {
      attendance_id,
      requested_date,
      requested_check_in,
      requested_check_out,
      requested_status,
      reason,
    } = req.body;

    const request = await correctionService.createCorrectionRequest({
      employee_id, // Identity strictly from JWT
      attendance_id,
      requested_date,
      requested_check_in,
      requested_check_out,
      requested_status,
      reason,
    });

    return res.status(201).json({
      success: true,
      status: 'success',
      data: request,
    });
  } catch (error) {
    next(error);
  }
}

async function getMyCorrections(req, res, next) {
  try {
    const employee_id = req.user.employee_id;
    if (!employee_id) {
      return res.status(400).json({
        success: false,
        status: 'error',
        message: 'Authenticated user is not associated with an employee record',
      });
    }

    const requests = await correctionService.getEmployeeCorrections(employee_id);
    return res.status(200).json({
      success: true,
      status: 'success',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

async function getAllCorrections(req, res, next) {
  try {
    const { status } = req.query;
    const requests = await correctionService.getAllCorrections({ status });
    return res.status(200).json({
      success: true,
      status: 'success',
      data: requests,
    });
  } catch (error) {
    next(error);
  }
}

async function getCorrectionById(req, res, next) {
  try {
    const { id } = req.params;
    const request = await correctionService.getCorrectionById(id);

    if (req.user.role === 'employee' && request.employee_id !== req.user.employee_id) {
      return res.status(403).json({
        success: false,
        status: 'error',
        message: 'Forbidden: You do not have permission to view this correction request',
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

async function approveCorrectionRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;
    const admin_user_id = req.user.id;

    const updated = await correctionService.approveCorrectionRequest(id, admin_user_id, admin_comment);
    return res.status(200).json({
      success: true,
      status: 'success',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
}

async function rejectCorrectionRequest(req, res, next) {
  try {
    const { id } = req.params;
    const { admin_comment } = req.body;
    const admin_user_id = req.user.id;

    const updated = await correctionService.rejectCorrectionRequest(id, admin_user_id, admin_comment);
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
  createCorrectionRequest,
  getMyCorrections,
  getAllCorrections,
  getCorrectionById,
  approveCorrectionRequest,
  rejectCorrectionRequest,
};
