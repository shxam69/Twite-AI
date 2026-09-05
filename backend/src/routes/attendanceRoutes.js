const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// All attendance routes require valid JWT authentication
router.use(authenticateToken);

/**
 * @route   POST /api/attendance/check-in
 * @desc    Quick check-in for today's date
 * @access  Private (Authenticated)
 */
router.post('/check-in', attendanceController.checkIn);

/**
 * @route   POST /api/attendance/check-out
 * @desc    Quick check-out for today's date
 * @access  Private (Authenticated)
 */
router.post('/check-out', attendanceController.checkOut);

/**
 * @route   GET /api/attendance/summary
 * @desc    Retrieve aggregated attendance summary & percentage
 * @access  Private (Authenticated)
 */
router.get('/summary', attendanceController.getAttendanceSummary);

/**
 * @route   GET /api/attendance/employee/:employeeId
 * @desc    Retrieve attendance history for a single employee
 * @access  Private (Authenticated)
 */
router.get('/employee/:employeeId', attendanceController.getEmployeeAttendanceHistory);

/**
 * @route   POST /api/attendance
 * @desc    Manually mark/create an attendance record
 * @access  Private (Admin only)
 */
router.post('/', requireAdmin, attendanceController.markAttendance);

/**
 * @route   GET /api/attendance
 * @desc    List attendance records with filters, search, and pagination
 * @access  Private (Authenticated)
 */
router.get('/', attendanceController.getAttendanceRecords);

/**
 * @route   GET /api/attendance/:id
 * @desc    Retrieve single attendance record details by ID
 * @access  Private (Authenticated)
 */
router.get('/:id', attendanceController.getAttendanceById);

module.exports = router;
