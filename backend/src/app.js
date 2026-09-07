const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const helpRoutes = require('./routes/helpRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const correctionRoutes = require('./routes/correctionRoutes');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// CORS Configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL.trim()]
  : ['http://localhost:5173', 'https://localhost:5173', 'http://127.0.0.1:5173'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, swagger-ui)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production'
      ) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy error: Origin ${origin} is not allowed`));
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const path = require('path');
const fs = require('fs');

// Swagger Documentation UI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance/corrections', correctionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/help-requests', helpRoutes);
app.use('/api/leave-requests', leaveRoutes);

// Static frontend serving & SPA fallback for single deployment
const frontendDistPath = path.resolve(process.cwd(), 'frontend', 'dist');
console.log('Frontend dist path:', frontendDistPath);
console.log(
  'Frontend index exists:',
  fs.existsSync(path.join(frontendDistPath, 'index.html'))
);
const hasFrontendBuild = fs.existsSync(path.join(frontendDistPath, 'index.html'));

if (hasFrontendBuild) {
  // Serve static assets from frontend/dist
  app.use(express.static(frontendDistPath));

  // SPA Fallback for client-side React Router navigation
  app.get('*', (req, res, next) => {
    // Unmatched /api/* routes fall through to JSON 404 handler
    if (req.path.startsWith('/api/')) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
} else {
  // Development / API-only root route
  app.get('/', (req, res) => {
    res.status(200).json({
      status: 'ok',
      message: 'Attendance Management API is running',
      version: '1.0.0',
      documentation: '/api/docs',
    });
  });
}

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

module.exports = app;
