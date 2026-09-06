const express = require('express');
const router = express.Router();
const correctionController = require('../controllers/correctionController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// All correction request routes require valid JWT authentication
router.use(authenticateToken);

/**
 * @route   POST /api/attendance/corrections
 * @desc    Submit an attendance correction request (Employee)
 * @access  Private (Employee)
 */
router.post('/', correctionController.createCorrectionRequest);

/**
 * @route   GET /api/attendance/corrections/my
 * @desc    Get current employee's submitted correction requests
 * @access  Private (Employee)
 */
router.get('/my', correctionController.getMyCorrections);

/**
 * @route   GET /api/attendance/corrections
 * @desc    List all attendance correction requests (Admin)
 * @access  Private (Admin)
 */
router.get('/', requireAdmin, correctionController.getAllCorrections);

/**
 * @route   GET /api/attendance/corrections/:id
 * @desc    Get single correction request details
 * @access  Private (Authenticated)
 */
router.get('/:id', correctionController.getCorrectionById);

/**
 * @route   PATCH /api/attendance/corrections/:id/approve
 * @desc    Approve an attendance correction request (Admin)
 * @access  Private (Admin)
 */
router.patch('/:id/approve', requireAdmin, correctionController.approveCorrectionRequest);

/**
 * @route   PATCH /api/attendance/corrections/:id/reject
 * @desc    Reject an attendance correction request (Admin)
 * @access  Private (Admin)
 */
router.patch('/:id/reject', requireAdmin, correctionController.rejectCorrectionRequest);

module.exports = router;
