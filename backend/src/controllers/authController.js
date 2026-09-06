const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const invitationService = require('../services/invitationService');

/**
 * @desc    Authenticate user & return JWT token
 * @route   POST /api/auth/login
 * @access  Public
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    // Validate request payload
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both username and password.',
      });
    }

    // Lookup user in database by username
    const [rows] = await pool.query(
      'SELECT id, username, password, role, employee_id FROM users WHERE username = ? LIMIT 1',
      [username.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    const user = rows[0];

    // Compare submitted password with bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password.',
      });
    }

    // Generate JWT token with user id, username, role, and employee_id
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      employee_id: user.employee_id,
    };

    const secret = process.env.JWT_SECRET || 'dev_attendance_jwt_secret_key_2026';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const token = jwt.sign(payload, secret, { expiresIn });

    // Respond without password or sensitive details
    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        employee_id: user.employee_id,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get currently authenticated user details
 * @route   GET /api/auth/me
 * @access  Private (Requires valid JWT)
 */
async function getMe(req, res, next) {
  try {
    // req.user is populated by authenticateToken middleware with fresh DB state
    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
        employee_id: req.user.employee_id,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Validate invitation token & return safe employee info (Public)
 * @route   GET /api/auth/register/invitation/:token
 * @access  Public
 */
async function validateInvitationToken(req, res, next) {
  try {
    const { token } = req.params;
    const result = await invitationService.validateToken(token);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

/**
 * @desc    Self-register employee user using invitation token (Public)
 * @route   POST /api/auth/register/employee
 * @access  Public
 */
async function registerEmployee(req, res, next) {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invitation token is required.',
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Password and confirm password do not match.',
      });
    }

    const result = await invitationService.registerEmployee(token, password);

    return res.status(201).json({
      success: true,
      message: 'Employee account created successfully.',
      data: result,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
}

module.exports = {
  login,
  getMe,
  validateInvitationToken,
  registerEmployee,
};
