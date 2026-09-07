const qrService = require('../services/qrService');
const attendanceService = require('../services/attendanceService');

/**
 * @desc    Generate dynamic rotating QR challenge (Admin only)
 * @route   POST /api/attendance/qr/generate
 * @access  Private (Admin)
 */
async function generateQr(req, res, next) {
  try {
    const purpose = req.body.purpose || req.query.purpose || 'CHECK_IN';
    const result = await qrService.generateChallenge(req.user.id, purpose);

    return res.status(201).json({
      success: true,
      message: 'QR challenge generated successfully.',
      data: {
        challenge_id: result.challenge_id,
        token: result.rawToken,
        purpose: result.purpose,
        expires_at: result.expires_at,
        validity_seconds: result.validity_seconds,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Check-in with dynamic QR code & GPS geofencing (Employee)
 * @route   POST /api/attendance/qr/check-in
 * @access  Private (Authenticated Employee)
 */
async function checkInWithQr(req, res, next) {
  try {
    if (req.user.role === 'employee' && !req.user.employee_id) {
      return res.status(400).json({
        success: false,
        message: 'User account is not linked to an employee record.',
      });
    }

    const employeeId = req.user.role === 'employee' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'A valid employee_id is required.',
      });
    }

    const { token, latitude, longitude, verification_method } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'QR token is required.',
      });
    }

    const verificationMethod = verification_method === 'QR_WEBAUTHN' ? 'QR_WEBAUTHN' : 'QR';
    const record = await attendanceService.checkInWithQr(employeeId, token.trim(), latitude, longitude, verificationMethod);

    return res.status(201).json({
      success: true,
      message: 'Check-in recorded successfully via QR code.',
      data: record,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        distanceMeters: error.distanceMeters,
        allowedRadius: error.allowedRadius,
      });
    }
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Attendance record already exists for this employee on this date.',
      });
    }
    next(error);
  }
}

/**
 * @desc    Check-out with dynamic QR code & GPS geofencing (Employee)
 * @route   POST /api/attendance/qr/check-out
 * @access  Private (Authenticated Employee)
 */
async function checkOutWithQr(req, res, next) {
  try {
    if (req.user.role === 'employee' && !req.user.employee_id) {
      return res.status(400).json({
        success: false,
        message: 'User account is not linked to an employee record.',
      });
    }

    const employeeId = req.user.role === 'employee' ? req.user.employee_id : (req.body.employee_id || req.user.employee_id);

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'A valid employee_id is required.',
      });
    }

    const { token, latitude, longitude, verification_method } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'QR token is required.',
      });
    }

    const verificationMethod = verification_method === 'QR_WEBAUTHN' ? 'QR_WEBAUTHN' : 'QR';
    const record = await attendanceService.checkOutWithQr(employeeId, token.trim(), latitude, longitude, verificationMethod);

    return res.status(200).json({
      success: true,
      message: 'Check-out recorded successfully via QR code.',
      data: record,
      worked_hours: record.worked_hours,
      extra_hours: record.extra_hours,
      points_awarded: record.points_awarded,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
        distanceMeters: error.distanceMeters,
        allowedRadius: error.allowedRadius,
      });
    }
    next(error);
  }
}

/**
 * @desc    Get status of a QR challenge to detect employee scan completion (Admin only)
 * @route   GET /api/attendance/qr/status/:challengeId
 * @access  Private (Admin)
 */
async function getChallengeStatus(req, res, next) {
  try {
    const { challengeId } = req.params;
    if (!challengeId) {
      return res.status(400).json({
        success: false,
        message: 'Challenge ID is required.',
      });
    }

    const status = await qrService.getChallengeStatus(challengeId);
    if (!status) {
      return res.status(404).json({
        success: false,
        message: 'QR challenge not found.',
      });
    }

    return res.status(200).json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  generateQr,
  checkInWithQr,
  checkOutWithQr,
  getChallengeStatus,
};

