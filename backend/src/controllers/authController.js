const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

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
      'SELECT id, username, password, role FROM users WHERE username = ? LIMIT 1',
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

    // Generate JWT token with user id, username, and role
    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
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
    // req.user is set by authenticateToken middleware
    return res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        username: req.user.username,
        role: req.user.role,
      },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  login,
  getMe,
};
