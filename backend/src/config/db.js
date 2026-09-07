const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

// Ensure Node.js process uses Asia/Kolkata timezone
process.env.TZ = process.env.TZ || 'Asia/Kolkata';

const isProductionDatabase =
  process.env.DB_SSL === 'true' ||
  process.env.DB_HOST?.includes('aivencloud.com');

const poolConfig = {
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
};

// Aiven requires SSL
if (isProductionDatabase) {
  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
}

const pool = mysql.createPool(poolConfig);

// Configure MySQL session timezone to Asia/Kolkata
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+05:30'");
});

/**
 * Test database connection
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();

    await connection.ping();

    connection.release();

    return {
      connected: true,
      message: 'Database connected successfully',
    };
  } catch (error) {
    return {
      connected: false,
      message: error.message,
    };
  }
}

module.exports = {
  pool,
  testConnection,
};