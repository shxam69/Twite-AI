const express = require('express');
const router = express.Router();
const { testConnection } = require('../config/db');

/**
 * @route   GET /api/health
 * @desc    Health check endpoint for API and database connectivity
 * @access  Public
 */
router.get('/', async (req, res) => {
  const dbStatus = await testConnection();

  res.status(200).json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: 'Attendance Management API',
    database: {
      connected: dbStatus.connected,
      message: dbStatus.message,
    },
  });
});

module.exports = router;
