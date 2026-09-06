require('dotenv').config();
const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Test database connection at startup
  const dbStatus = await testConnection();
  if (dbStatus.connected) {
    console.log('✅ Database connected successfully');
  } else {
    console.warn(`⚠️  Database connection warning: ${dbStatus.message}`);
    console.warn('   (Ensure MySQL is running and attendance_management database is created)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on 0.0.0.0:${PORT} (Accessible locally & over LAN)`);
    console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
  });
}

startServer();
