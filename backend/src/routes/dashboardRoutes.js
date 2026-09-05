const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { authenticateToken } = require('../middleware/authMiddleware');

// All dashboard routes require JWT authentication
router.use(authenticateToken);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard metrics for today
 * @access  Private (Authenticated)
 */
router.get('/stats', dashboardController.getStats);

module.exports = router;
