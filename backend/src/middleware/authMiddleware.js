const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header (Bearer <token>)
 * Resolves fresh user state (id, username, role, employee_id) from DB
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
    });
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Malformed token.',
    });
  }

  const secret = process.env.JWT_SECRET || 'dev_attendance_jwt_secret_key_2026';

  jwt.verify(token, secret, async (err, decoded) => {
    if (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Token has expired. Please log in again.'
          : 'Invalid authentication token.';

      return res.status(401).json({
        success: false,
        message,
      });
    }

    try {
      // Source of truth: resolve current user details and employee_id link from database
      const [rows] = await pool.query(
        'SELECT id, username, role, employee_id FROM users WHERE id = ? LIMIT 1',
        [decoded.id]
      );

      if (rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'User account no longer exists.',
        });
      }

      req.user = rows[0];
      next();
    } catch (dbErr) {
      next(dbErr);
    }
  });
}

/**
 * Reusable Role Authorization Middleware
 * Checks if req.user has one of the allowed roles
 * Usage: authorize('admin') or authorize('admin', 'employee')
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden. You do not have permission to access this resource.',
      });
    }

    next();
  };
}

/**
 * Helper middleware specifically for Admin-only routes
 */
const requireAdmin = authorize('admin');

module.exports = {
  authenticateToken,
  authorize,
  requireAdmin,
};
