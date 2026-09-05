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

  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Health endpoint: http://localhost:${PORT}/api/health`);
  });
}

startServer();
