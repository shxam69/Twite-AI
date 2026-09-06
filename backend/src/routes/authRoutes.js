const express = require('express');
const router = express.Router();
const { login, getMe, validateInvitationToken, registerEmployee } = require('../controllers/authController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate user credentials and return JWT token
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   GET /api/auth/register/invitation/:token
 * @desc    Validate invitation token & fetch safe employee info for registration display
 * @access  Public
 */
router.get('/register/invitation/:token', validateInvitationToken);

/**
 * @route   POST /api/auth/register/employee
 * @desc    Self-register an employee account using an invitation token
 * @access  Public
 */
router.post('/register/employee', registerEmployee);

/**
 * @route   GET /api/auth/me
 * @desc    Get currently authenticated user info from token
 * @access  Private (Authenticated)
 */
router.get('/me', authenticateToken, getMe);

/**
 * @route   GET /api/auth/admin-check
 * @desc    Test/verify admin-only authorization
 * @access  Private (Admin only)
 */
router.get('/admin-check', authenticateToken, requireAdmin, (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Admin authorization verified.',
    user: req.user,
  });
});

module.exports = router;
