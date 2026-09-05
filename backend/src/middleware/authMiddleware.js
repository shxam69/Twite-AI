const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies JWT token from Authorization header (Bearer <token>)
 * Attaches decoded payload { id, username, role } to req.user
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

  jwt.verify(token, secret, (err, decoded) => {
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

    // Attach decoded user payload to request
    req.user = decoded;
    next();
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
