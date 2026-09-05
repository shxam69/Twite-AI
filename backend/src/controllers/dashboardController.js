const dashboardService = require('../services/dashboardService');

/**
 * @desc    Get dashboard statistics for today
 * @route   GET /api/dashboard/stats
 * @access  Private (Authenticated)
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

module.exports = {
  getStats,
};
