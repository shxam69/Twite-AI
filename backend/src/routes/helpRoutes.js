const express = require('express');
const router = express.Router();
const helpController = require('../controllers/helpController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// All help request routes require valid JWT authentication
router.use(authenticateToken);

/**
 * @route   POST /api/help-requests
 * @desc    Submit a new employee help request
 * @access  Private (Employee / Authenticated)
 */
router.post('/', helpController.createHelpRequest);

/**
 * @route   GET /api/help-requests/my
 * @desc    Get current employee's submitted help requests
 * @access  Private (Employee / Authenticated)
 */
router.get('/my', helpController.getMyHelpRequests);

/**
 * @route   GET /api/help-requests/open-count
 * @desc    Get count of open help requests
 * @access  Private (Admin / HR)
 */
router.get('/open-count', requireAdmin, helpController.getOpenCount);

/**
 * @route   GET /api/help-requests
 * @desc    List all help requests (Admin portal)
 * @access  Private (Admin / HR)
 */
router.get('/', requireAdmin, helpController.getAllHelpRequests);

/**
 * @route   PATCH /api/help-requests/:id/resolve
 * @desc    Resolve a specific help request
 * @access  Private (Admin / HR)
 */
router.patch('/:id/resolve', requireAdmin, helpController.resolveHelpRequest);

module.exports = router;
