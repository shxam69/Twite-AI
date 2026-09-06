const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// All leave request routes require valid JWT authentication
router.use(authenticateToken);

/**
 * @route   POST /api/leave-requests
 * @desc    Submit a new leave request (Employee)
 * @access  Private (Employee)
 */
router.post('/', leaveController.createLeaveRequest);

/**
 * @route   GET /api/leave-requests/my
 * @desc    Get current employee's leave requests
 * @access  Private (Employee)
 */
router.get('/my', leaveController.getMyLeaveRequests);

/**
 * @route   GET /api/leave-requests
 * @desc    List all leave requests (Admin)
 * @access  Private (Admin)
 */
router.get('/', requireAdmin, leaveController.getAllLeaveRequests);

/**
 * @route   GET /api/leave-requests/:id
 * @desc    Get single leave request details
 * @access  Private (Authenticated)
 */
router.get('/:id', leaveController.getLeaveRequestById);

/**
 * @route   PUT /api/leave-requests/:id/approve
 * @desc    Approve a leave request (Admin)
 * @access  Private (Admin)
 */
router.put('/:id/approve', requireAdmin, leaveController.approveLeaveRequest);

/**
 * @route   PUT /api/leave-requests/:id/reject
 * @desc    Reject a leave request (Admin)
 * @access  Private (Admin)
 */
router.put('/:id/reject', requireAdmin, leaveController.rejectLeaveRequest);

module.exports = router;
