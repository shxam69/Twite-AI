const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// All dashboard routes require JWT authentication
router.use(authenticateToken);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard metrics for today (Admin only)
 * @access  Private (Admin)
 */
router.get('/stats', requireAdmin, dashboardController.getStats);

/**
 * @route   GET /api/dashboard/my-stats
 * @desc    Get employee personal dashboard metrics
 * @access  Private (Authenticated User)
 */
router.get('/my-stats', dashboardController.getMyStats);

/**
 * @route   GET /api/dashboard/notifications/counts
 * @desc    Get aggregated notification counts for Admin header
 * @access  Private (Admin)
 */
router.get('/notifications/counts', requireAdmin, dashboardController.getNotificationCounts);

module.exports = router;
