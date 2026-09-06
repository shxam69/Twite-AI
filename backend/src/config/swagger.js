const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Twite AI Technologies Mini Attendance Management System API',
      version: '1.0.0',
      description: 'Comprehensive REST API documentation for Attendance, Leaves, Corrections, QR, GPS, and Audit Events.',
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Provide valid JWT Bearer token obtained from /api/auth/login',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            username: { type: 'string', example: 'admin' },
            role: { type: 'string', enum: ['admin', 'employee'], example: 'admin' },
            employee_id: { type: 'integer', nullable: true, example: 1 },
          },
        },
        Employee: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            employee_id: { type: 'string', example: 'EMP-001' },
            name: { type: 'string', example: 'Alice Johnson' },
            email: { type: 'string', example: 'alice@company.com' },
            mobile: { type: 'string', example: '+1234567890' },
            department: { type: 'string', example: 'Engineering' },
            designation: { type: 'string', example: 'Senior Software Engineer' },
            status: { type: 'string', enum: ['active', 'inactive'], example: 'active' },
          },
        },
        Attendance: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            employee_id: { type: 'integer', example: 1 },
            attendance_date: { type: 'string', format: 'date', example: '2026-09-06' },
            check_in: { type: 'string', example: '09:00:00' },
            check_out: { type: 'string', example: '17:00:00' },
            status: { type: 'string', enum: ['present', 'absent', 'late', 'half_day'], example: 'present' },
            verification_method: { type: 'string', enum: ['MANUAL', 'QR', 'WEBAUTHN', 'AUTO_LOCATION', 'ADMIN'], example: 'QR' },
            remarks: { type: 'string', nullable: true, example: 'Verified via dynamic QR code' },
          },
        },
        LeaveRequest: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            employee_id: { type: 'integer', example: 1 },
            leave_type: { type: 'string', enum: ['CASUAL', 'SICK', 'ANNUAL', 'UNPAID'], example: 'CASUAL' },
            start_date: { type: 'string', format: 'date', example: '2026-09-10' },
            end_date: { type: 'string', format: 'date', example: '2026-09-12' },
            reason: { type: 'string', example: 'Personal emergency' },
            status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'], example: 'PENDING' },
            admin_comment: { type: 'string', nullable: true, example: 'Approved by HR' },
          },
        },
        CorrectionRequest: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            employee_id: { type: 'integer', example: 1 },
            requested_date: { type: 'string', format: 'date', example: '2026-09-05' },
            requested_check_in: { type: 'string', example: '09:05:00' },
            requested_check_out: { type: 'string', example: '17:00:00' },
            requested_status: { type: 'string', enum: ['present', 'absent', 'late', 'half_day'], example: 'present' },
            reason: { type: 'string', example: 'Forgot check-in due to client meeting' },
            status: { type: 'string', enum: ['PENDING', 'APPROVED', 'REJECTED'], example: 'PENDING' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Unauthorized access or invalid token' },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: [], // Inline OpenAPI definition
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
