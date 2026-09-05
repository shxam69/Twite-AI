const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employeeController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// All employee routes require authentication
router.use(authenticateToken);

/**
 * @route   POST /api/employees
 * @desc    Create a new employee
 * @access  Private (Admin only)
 */
router.post('/', requireAdmin, employeeController.createEmployee);

/**
 * @route   GET /api/employees
 * @desc    Get paginated, filtered, and sorted employee list
 * @access  Private (Authenticated)
 */
router.get('/', employeeController.getEmployees);

/**
 * @route   GET /api/employees/:id
 * @desc    Get employee details by ID
 * @access  Private (Authenticated)
 */
router.get('/:id', employeeController.getEmployeeById);

/**
 * @route   PUT /api/employees/:id
 * @desc    Update employee by ID
 * @access  Private (Admin only)
 */
router.put('/:id', requireAdmin, employeeController.updateEmployee);

/**
 * @route   DELETE /api/employees/:id
 * @desc    Soft delete employee by ID (status = inactive)
 * @access  Private (Admin only)
 */
router.delete('/:id', requireAdmin, employeeController.deleteEmployee);

module.exports = router;
