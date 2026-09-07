const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const policyController = require('../controllers/policyController');
const qrController = require('../controllers/qrController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// All attendance routes require valid JWT authentication
router.use(authenticateToken);

/**
 * @route   POST /api/attendance/qr/generate
 * @desc    Generate a dynamic rotating QR challenge (Admin only)
 * @access  Private (Admin only)
 */
router.post('/qr/generate', requireAdmin, qrController.generateQr);

/**
 * @route   POST /api/attendance/qr/check-in
 * @desc    Check-in with dynamic QR code & GPS geofencing (Employee)
 * @access  Private (Authenticated)
 */
router.post('/qr/check-in', qrController.checkInWithQr);

/**
 * @route   POST /api/attendance/qr/check-out
 * @desc    Check-out with dynamic QR code & GPS geofencing (Employee)
 * @access  Private (Authenticated)
 */
router.post('/qr/check-out', qrController.checkOutWithQr);

/**
 * @route   GET /api/attendance/policies
 * @desc    Get configured attendance policies
 * @access  Private (Admin only)
 */
router.get('/policies', requireAdmin, policyController.getAllPolicies);

/**
 * @route   PUT /api/attendance/policies/:key
 * @desc    Update a specific attendance policy setting
 * @access  Private (Admin only)
 */
router.put('/policies/:key', requireAdmin, policyController.updatePolicy);

/**
 * @route   GET /api/attendance/events
 * @desc    Retrieve paginated attendance audit events
 * @access  Private (Admin only)
 */
router.get('/events', requireAdmin, attendanceController.getAttendanceEvents);

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
 * @route   PUT /api/attendance/:id/remark
 * @desc    Update remark on an attendance record (Admin only)
 * @access  Private (Admin only)
 */
router.put('/:id/remark', requireAdmin, attendanceController.updateAttendanceRemark);

/**
 * @route   GET /api/attendance/export
 * @desc    Export attendance report as CSV (Admin only)
 * @access  Private (Admin only)
 */
router.get('/export', requireAdmin, attendanceController.exportAttendance);

/**
 * @route   GET /api/attendance/:id
 * @desc    Retrieve single attendance record details by ID
 * @access  Private (Authenticated)
 */
router.get('/:id', attendanceController.getAttendanceById);

module.exports = router;

