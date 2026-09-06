const mysql = require('mysql2/promise');
require('dotenv').config();

// Ensure Node.js process uses Asia/Kolkata timezone for date & time operations
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'attendance_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+05:30',
  dateStrings: true,
});

// Configure MySQL session timezone to Asia/Kolkata (+05:30) on every pool connection
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+05:30'");
});


/**
 * Test database connection
 * Returns an object with connection status details
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    return { connected: true, message: 'Database connected successfully' };
  } catch (error) {
    return { connected: false, message: error.message };
  }
}

module.exports = {
  pool,
  testConnection,
};
