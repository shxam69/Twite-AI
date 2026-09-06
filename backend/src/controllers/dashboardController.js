const dashboardService = require('../services/dashboardService');

/**
 * @desc    Get dashboard statistics for today (Admin only)
 * @route   GET /api/dashboard/stats
 * @access  Private (Admin)
 */
async function getStats(req, res, next) {
  try {
    const stats = await dashboardService.getDashboardStats();

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get personal employee dashboard statistics
 * @route   GET /api/dashboard/my-stats
 * @access  Private (Authenticated Employee)
 */
async function getMyStats(req, res, next) {
  try {
    const employeeId = req.user?.employee_id;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: 'No employee profile linked to this user account.',
      });
    }

    // Explicitly use req.user.employee_id ONLY. Never trust query or body parameters.
    const stats = await dashboardService.getEmployeeStats(employeeId);

    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get unified notification counts for Admin header
 * @route   GET /api/dashboard/notifications/counts
 * @access  Private (Admin)
 */
async function getNotificationCounts(req, res, next) {
  try {
    const counts = await dashboardService.getAdminNotificationCounts();

    return res.status(200).json({
      success: true,
      data: counts,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getStats,
  getMyStats,
  getNotificationCounts,
};
