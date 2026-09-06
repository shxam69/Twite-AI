const qrService = require('../services/qrService');
const attendanceService = require('../services/attendanceService');

/**
 * @desc    Generate dynamic rotating QR challenge (Admin only)
 * @route   POST /api/attendance/qr/generate
 * @access  Private (Admin)
 */
async function generateQr(req, res, next) {
  try {
    const result = await qrService.generateChallenge(req.user.id);

    return res.status(201).json({
      success: true,
      message: 'QR challenge generated successfully.',
      data: {
        challenge_id: result.challenge_id,
        token: result.rawToken,
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

    const { token, latitude, longitude } = req.body;

    if (!token || typeof token !== 'string' || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'QR token is required.',
      });
    }

    const record = await attendanceService.checkInWithQr(employeeId, token.trim(), latitude, longitude);

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

module.exports = {
  generateQr,
  checkInWithQr,
};
