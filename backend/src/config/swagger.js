const swaggerJsdoc = require('swagger-jsdoc');

const backendPublicUrl = process.env.BACKEND_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || 'https://twite-ai-1.onrender.com';

const servers = [
  {
    url: backendPublicUrl.replace(/\/+$/, ''),
    description: 'Production API (Render)',
  },
  {
    url: 'http://localhost:5000',
    description: 'Local Development Server',
  },
];

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Twite AI Technologies Mini Attendance Management System API',
      version: '1.0.0',
      description:
        'Production REST API documentation for Attendance, Leaves, Corrections, QR, GPS Geofencing, Help Requests, Policies, and Audit Logs.',
    },
    servers,
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter JWT Bearer token obtained from POST /api/auth/login',
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
            admin_comment: { type: 'string', nullable: true },
          },
        },
        HelpRequest: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            employee_id: { type: 'integer', example: 1 },
            subject: { type: 'string', example: 'Login assistance' },
            message: { type: 'string', example: 'Need help updating email' },
            status: { type: 'string', enum: ['OPEN', 'RESOLVED'], example: 'OPEN' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            status: { type: 'string', example: 'error' },
            message: { type: 'string', example: 'Unauthorized access or invalid request' },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'System health check & database connectivity' },
      { name: 'Auth', description: 'Authentication, registration, identity verification' },
      { name: 'Employees', description: 'Employee management, CRUD, invitations' },
      { name: 'Attendance', description: 'Manual check-in/out, records, summary, history, export' },
      { name: 'QR & GPS', description: 'Dynamic QR attendance generation & geofenced check-in' },
      { name: 'Attendance Policies', description: 'Admin attendance & geofence configuration' },
      { name: 'Attendance Audit', description: 'Audit events log & security timeline' },
      { name: 'Attendance Corrections', description: 'Employee attendance correction requests & approval' },
      { name: 'Leave Management', description: 'Leave request applications, approvals, and history' },
      { name: 'Dashboard', description: 'Admin metrics, personal stats, notification counts' },
      { name: 'Help Requests', description: 'Employee help tickets & admin resolution' },
    ],
    paths: {
      '/api/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check endpoint',
          description: 'Public health check returning API uptime and MySQL connectivity status.',
          security: [],
          responses: {
            200: {
              description: 'API and database operating normally',
            },
          },
        },
      },
      '/api/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'User login',
          description: 'Authenticate user with username and password, returning JWT bearer token.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['username', 'password'],
                  properties: {
                    username: { type: 'string', example: 'admin' },
                    password: { type: 'string', example: 'Admin@123' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Login successful' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/api/auth/register/invitation/{token}': {
        get: {
          tags: ['Auth'],
          summary: 'Validate employee invitation token',
          description: 'Fetch pre-filled safe employee info for self-registration.',
          security: [],
          parameters: [
            {
              name: 'token',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            200: { description: 'Valid token' },
            404: { description: 'Invalid or expired invitation token' },
          },
        },
      },
      '/api/auth/register/employee': {
        post: {
          tags: ['Auth'],
          summary: 'Self-register employee account',
          description: 'Create employee login account using invitation token.',
          security: [],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['token', 'username', 'password'],
                  properties: {
                    token: { type: 'string' },
                    username: { type: 'string' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'Registration successful' },
            400: { description: 'Invalid or expired invitation token' },
          },
        },
      },
      '/api/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user info',
          description: 'Retrieve details of currently authenticated user from JWT token.',
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: 'User info retrieved' },
            401: { description: 'Unauthorized' },
          },
        },
      },
      '/api/auth/admin-check': {
        get: {
          tags: ['Auth'],
          summary: 'Verify Admin authorization (Admin Only)',
          description: 'Test endpoint to verify Admin role access.',
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: 'Admin verified' },
            403: { description: 'Forbidden: Admin access required' },
          },
        },
      },
      '/api/employees': {
        get: {
          tags: ['Employees'],
          summary: 'List employees',
          description: 'Get paginated, filtered, and sorted employee directory.',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
            { name: 'search', in: 'query', schema: { type: 'string' } },
            { name: 'department', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'List of employees' } },
        },
        post: {
          tags: ['Employees'],
          summary: 'Create employee (Admin Only)',
          description: 'Add a new employee record.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['employee_id', 'name', 'email', 'department'],
                  properties: {
                    employee_id: { type: 'string', example: 'EMP-101' },
                    name: { type: 'string', example: 'Jane Smith' },
                    email: { type: 'string', example: 'jane@company.com' },
                    mobile: { type: 'string', example: '+1234567890' },
                    department: { type: 'string', example: 'Marketing' },
                    designation: { type: 'string', example: 'Manager' },
                  },
                },
              },
            },
          },
          responses: { 201: { description: 'Employee created' } },
        },
      },
      '/api/employees/{id}': {
        get: {
          tags: ['Employees'],
          summary: 'Get employee by ID',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Employee details' } },
        },
        put: {
          tags: ['Employees'],
          summary: 'Update employee (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Employee updated' } },
        },
        delete: {
          tags: ['Employees'],
          summary: 'Soft-delete employee (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Employee deactivated' } },
        },
      },
      '/api/employees/{id}/invite': {
        post: {
          tags: ['Employees'],
          summary: 'Generate invitation link (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Invitation token generated' } },
        },
      },
      '/api/employees/{id}/invitation': {
        get: {
          tags: ['Employees'],
          summary: 'Get invitation status (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Invitation status' } },
        },
      },
      '/api/employees/{id}/invite/revoke': {
        post: {
          tags: ['Employees'],
          summary: 'Revoke active invitation link (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Invitation revoked' } },
        },
      },
      '/api/attendance/check-in': {
        post: {
          tags: ['Attendance'],
          summary: 'Quick check-in',
          description: 'Employee quick check-in for current date (derived from JWT token).',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Check-in successful' } },
        },
      },
      '/api/attendance/check-out': {
        post: {
          tags: ['Attendance'],
          summary: 'Quick check-out',
          description: 'Employee quick check-out for current date (derived from JWT token).',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Check-out successful' } },
        },
      },
      '/api/attendance': {
        get: {
          tags: ['Attendance'],
          summary: 'List attendance records',
          security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer' } },
            { name: 'limit', in: 'query', schema: { type: 'integer' } },
            { name: 'date', in: 'query', schema: { type: 'string' } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'Attendance list' } },
        },
        post: {
          tags: ['Attendance'],
          summary: 'Manually mark attendance (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 201: { description: 'Attendance marked' } },
        },
      },
      '/api/attendance/summary': {
        get: {
          tags: ['Attendance'],
          summary: 'Get attendance summary & percentage',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Summary statistics' } },
        },
      },
      '/api/attendance/employee/{employeeId}': {
        get: {
          tags: ['Attendance'],
          summary: 'Get employee attendance history',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'employeeId', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Employee history' } },
        },
      },
      '/api/attendance/export': {
        get: {
          tags: ['Attendance'],
          summary: 'Export attendance CSV report (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'CSV file download' } },
        },
      },
      '/api/attendance/{id}/remark': {
        put: {
          tags: ['Attendance'],
          summary: 'Update attendance remark (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Remark updated' } },
        },
      },
      '/api/attendance/{id}': {
        get: {
          tags: ['Attendance'],
          summary: 'Get single attendance record details',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Attendance record' } },
        },
      },
      '/api/attendance/qr/generate': {
        post: {
          tags: ['QR & GPS'],
          summary: 'Generate dynamic rotating QR challenge (Admin Only)',
          description: 'Generates a secure QR challenge with expiration time.',
          security: [{ BearerAuth: [] }],
          responses: { 201: { description: 'QR challenge created' } },
        },
      },
      '/api/attendance/qr/check-in': {
        post: {
          tags: ['QR & GPS'],
          summary: 'Check-in with QR & GPS geofencing',
          description: 'Validates QR challenge token and client GPS coordinates against workplace geofence radius.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['qr_token', 'latitude', 'longitude'],
                  properties: {
                    qr_token: { type: 'string' },
                    latitude: { type: 'number', example: 28.613939 },
                    longitude: { type: 'number', example: 77.209021 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'QR & GPS check-in verified successfully' },
            400: { description: 'Expired QR code or outside workplace geofence' },
          },
        },
      },
      '/api/attendance/policies': {
        get: {
          tags: ['Attendance Policies'],
          summary: 'Get configured attendance policies (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'List of policy key-value pairs' } },
        },
      },
      '/api/attendance/policies/{key}': {
        put: {
          tags: ['Attendance Policies'],
          summary: 'Update specific policy key (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'key', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', properties: { value: { type: 'string' } } } } },
          },
          responses: { 200: { description: 'Policy updated' } },
        },
      },
      '/api/attendance/events': {
        get: {
          tags: ['Attendance Audit'],
          summary: 'Get paginated audit events log (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Audit events timeline' } },
        },
      },
      '/api/attendance/corrections': {
        post: {
          tags: ['Attendance Corrections'],
          summary: 'Submit correction request (Employee)',
          security: [{ BearerAuth: [] }],
          responses: { 201: { description: 'Correction request submitted' } },
        },
        get: {
          tags: ['Attendance Corrections'],
          summary: 'List all correction requests (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'List of all correction requests' } },
        },
      },
      '/api/attendance/corrections/my': {
        get: {
          tags: ['Attendance Corrections'],
          summary: 'Get employee personal correction requests',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'My correction requests' } },
        },
      },
      '/api/attendance/corrections/{id}': {
        get: {
          tags: ['Attendance Corrections'],
          summary: 'Get single correction request details',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Correction request details' } },
        },
      },
      '/api/attendance/corrections/{id}/approve': {
        patch: {
          tags: ['Attendance Corrections'],
          summary: 'Approve correction request (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Correction approved & attendance updated' } },
        },
      },
      '/api/attendance/corrections/{id}/reject': {
        patch: {
          tags: ['Attendance Corrections'],
          summary: 'Reject correction request (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Correction rejected' } },
        },
      },
      '/api/leave-requests': {
        post: {
          tags: ['Leave Management'],
          summary: 'Submit leave request (Employee)',
          security: [{ BearerAuth: [] }],
          responses: { 201: { description: 'Leave request created' } },
        },
        get: {
          tags: ['Leave Management'],
          summary: 'List all leave requests (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'All leave requests' } },
        },
      },
      '/api/leave-requests/my': {
        get: {
          tags: ['Leave Management'],
          summary: 'Get employee personal leave requests',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Employee leave history' } },
        },
      },
      '/api/leave-requests/{id}': {
        get: {
          tags: ['Leave Management'],
          summary: 'Get leave request details by ID',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Leave request details' } },
        },
      },
      '/api/leave-requests/{id}/approve': {
        put: {
          tags: ['Leave Management'],
          summary: 'Approve leave request (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Leave request approved' } },
        },
      },
      '/api/leave-requests/{id}/reject': {
        put: {
          tags: ['Leave Management'],
          summary: 'Reject leave request (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Leave request rejected' } },
        },
      },
      '/api/dashboard/stats': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get today metrics & trend (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Admin dashboard analytics' } },
        },
      },
      '/api/dashboard/my-stats': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get personal employee dashboard stats',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Personal employee stats' } },
        },
      },
      '/api/dashboard/notifications/counts': {
        get: {
          tags: ['Dashboard'],
          summary: 'Get aggregated notification counts (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Pending corrections & open help requests count' } },
        },
      },
      '/api/help-requests': {
        post: {
          tags: ['Help Requests'],
          summary: 'Submit help request (Employee)',
          security: [{ BearerAuth: [] }],
          responses: { 201: { description: 'Help request submitted' } },
        },
        get: {
          tags: ['Help Requests'],
          summary: 'List all help requests (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'List of all help requests' } },
        },
      },
      '/api/help-requests/my': {
        get: {
          tags: ['Help Requests'],
          summary: 'Get employee personal help requests',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'My help requests' } },
        },
      },
      '/api/help-requests/open-count': {
        get: {
          tags: ['Help Requests'],
          summary: 'Get count of open help requests (Admin Only)',
          security: [{ BearerAuth: [] }],
          responses: { 200: { description: 'Open help requests count' } },
        },
      },
      '/api/help-requests/{id}/resolve': {
        patch: {
          tags: ['Help Requests'],
          summary: 'Resolve help request (Admin Only)',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
          responses: { 200: { description: 'Help request resolved' } },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
