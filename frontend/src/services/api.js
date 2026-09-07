import axios from 'axios';

export const TOKEN_KEY = 'attendance_token';

// Dynamic base URL resolution using relative /api path for dev proxy & HTTPS LAN access
const getDynamicBaseURL = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  return '/api';
};

const baseURL = getDynamicBaseURL();

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor: attach auth token from localStorage if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: extract clean error messages from server response
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred. Please try again.';
    return Promise.reject(new Error(message));
  }
);

/**
 * Health check endpoint: GET /api/health
 */
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

/**
 * Authentication API calls
 */
export const loginUser = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

/**
 * Dashboard API calls
 */
export const getDashboardStats = async () => {
  const response = await api.get('/dashboard/stats');
  return response.data;
};

export const getMyDashboardStats = async () => {
  const response = await api.get('/dashboard/my-stats');
  return response.data;
};


/**
 * Employee API calls
 */
export const getEmployees = async (params = {}) => {
  const response = await api.get('/employees', { params });
  return response.data;
};

export const getEmployee = async (id) => {
  const response = await api.get(`/employees/${id}`);
  return response.data;
};

export const createEmployee = async (data) => {
  const response = await api.post('/employees', data);
  return response.data;
};

export const updateEmployee = async (id, data) => {
  const response = await api.put(`/employees/${id}`, data);
  return response.data;
};

export const deleteEmployee = async (id) => {
  const response = await api.delete(`/employees/${id}`);
  return response.data;
};

/**
 * Employee Invitation & Registration API calls
 */
export const createEmployeeInvite = async (id) => {
  const response = await api.post(`/employees/${id}/invite`);
  return response.data;
};

export const getEmployeeInviteStatus = async (id) => {
  const response = await api.get(`/employees/${id}/invitation`);
  return response.data;
};

export const revokeEmployeeInvite = async (id) => {
  const response = await api.post(`/employees/${id}/invite/revoke`);
  return response.data;
};

export const validateInviteToken = async (token) => {
  const response = await api.get(`/auth/register/invitation/${token}`);
  return response.data;
};

export const registerEmployee = async (data) => {
  const response = await api.post('/auth/register/employee', data);
  return response.data;
};

/**
 * Attendance API calls
 */
export const checkIn = async () => {
  // Employee check-in sends empty body {}; identity is derived from JWT
  const response = await api.post('/attendance/check-in', {});
  return response.data;
};

export const checkOut = async () => {
  // Employee check-out sends empty body {}; identity is derived from JWT
  const response = await api.post('/attendance/check-out', {});
  return response.data;
};

export const getAttendanceRecords = async (params = {}) => {
  const response = await api.get('/attendance', { params });
  return response.data;
};

export const getAttendanceSummary = async (params = {}) => {
  const response = await api.get('/attendance/summary', { params });
  return response.data;
};

export const getEmployeeAttendanceHistory = async (employeeId, params = {}) => {
  const response = await api.get(`/attendance/employee/${employeeId}`, { params });
  return response.data;
};

export const adminMarkAttendance = async (data) => {
  const response = await api.post('/attendance/admin/mark', data);
  return response.data;
};

export const adminUpdateAttendance = async (id, data) => {
  const response = await api.put(`/attendance/admin/${id}`, data);
  return response.data;
};

/**
 * Dynamic QR Code & GPS Geofencing API calls
 */
export const generateQrCode = async (purpose = 'CHECK_IN') => {
  const response = await api.post('/attendance/qr/generate', { purpose });
  return response.data;
};

export const getQrChallengeStatus = async (challengeId) => {
  const response = await api.get(`/attendance/qr/status/${encodeURIComponent(challengeId)}`);
  return response.data;
};

export const checkInWithQr = async (payload) => {
  const response = await api.post('/attendance/qr/check-in', payload);
  return response.data;
};

export const checkOutWithQr = async (payload) => {
  const response = await api.post('/attendance/qr/check-out', payload);
  return response.data;
};


/**
 * Rewards API calls
 */
export const getMyRewardAccount = async () => {
  const response = await api.get('/rewards/my-account');
  return response.data;
};

export const getRewardsCatalog = async (includeInactive = false) => {
  const response = await api.get('/rewards/catalog', { params: { includeInactive } });
  return response.data;
};

export const redeemRewardItem = async (reward_id) => {
  const response = await api.post('/rewards/redeem', { reward_id });
  return response.data;
};

export const createRewardItem = async (data) => {
  const response = await api.post('/rewards', data);
  return response.data;
};

export const updateRewardItem = async (id, data) => {
  const response = await api.put(`/rewards/${id}`, data);
  return response.data;
};

export const getRewardStats = async () => {
  const response = await api.get('/rewards/stats');
  return response.data;
};

export const getPointsHistory = async (params = {}) => {
  const response = await api.get('/rewards/points-history', { params });
  return response.data;
};

export const getAllRedemptions = async (status) => {
  const response = await api.get('/rewards/redemptions', { params: { status } });
  return response.data;
};

export const updateRedemptionStatus = async (id, status) => {
  const response = await api.patch(`/rewards/redemptions/${id}`, { status });
  return response.data;
};

/**
 * WebAuthn & Platform Authenticator API calls
 */
export const getWebAuthnRegisterOptions = async () => {
  const response = await api.get('/auth/webauthn/register/options');
  return response.data;
};

export const verifyWebAuthnRegistration = async (payload) => {
  const response = await api.post('/auth/webauthn/register/verify', payload);
  return response.data;
};

export const getWebAuthnAuthOptions = async () => {
  const response = await api.get('/auth/webauthn/authenticate/options');
  return response.data;
};

export const verifyWebAuthnAuthentication = async (payload) => {
  const response = await api.post('/auth/webauthn/authenticate/verify', payload);
  return response.data;
};

export const getWebAuthnCredentials = async () => {
  const response = await api.get('/auth/webauthn/credentials');
  return response.data;
};

export const deleteWebAuthnCredential = async (id) => {
  const response = await api.delete(`/auth/webauthn/credentials/${id}`);
  return response.data;
};

export const logWebAuthnStatus = async (payload) => {
  const response = await api.post('/auth/webauthn/status', payload);
  return response.data;
};


/**
 * Attendance Policies API calls (Admin)
 */
export const getAttendancePolicies = async () => {
  const response = await api.get('/attendance/policies');
  return response.data;
};

export const updateAttendancePolicy = async (key, value) => {
  const response = await api.put(`/attendance/policies/${key}`, { value });
  return response.data;
};

/**
 * Attendance Events API calls (Admin)
 */
export const getAttendanceEvents = async (params = {}) => {
  const response = await api.get('/attendance/events', { params });
  return response.data;
};

/**
 * Help Requests API calls
 */
export const createHelpRequest = async (data) => {
  const response = await api.post('/help-requests', data);
  return response.data;
};

export const getMyHelpRequests = async () => {
  const response = await api.get('/help-requests/my');
  return response.data;
};

export const getHelpRequests = async (params = {}) => {
  const response = await api.get('/help-requests', { params });
  return response.data;
};

export const getOpenHelpRequestsCount = async () => {
  const response = await api.get('/help-requests/open-count');
  return response.data;
};

export const resolveHelpRequest = async (id) => {
  const response = await api.patch(`/help-requests/${id}/resolve`);
  return response.data;
};

/**
 * Unified Admin Notification Counts API call
 */
export const getAdminNotificationCounts = async () => {
  const response = await api.get('/dashboard/notifications/counts');
  return response.data;
};

/**
 * Leave Requests API calls
 */
export const createLeaveRequest = async (data) => {
  const response = await api.post('/leave-requests', data);
  return response.data;
};

export const getMyLeaveRequests = async () => {
  const response = await api.get('/leave-requests/my');
  return response.data;
};

export const getLeaveRequests = async (params = {}) => {
  const response = await api.get('/leave-requests', { params });
  return response.data;
};

export const getLeaveRequest = async (id) => {
  const response = await api.get(`/leave-requests/${id}`);
  return response.data;
};

export const approveLeaveRequest = async (id, admin_comment = '') => {
  const response = await api.put(`/leave-requests/${id}/approve`, { admin_comment });
  return response.data;
};

export const rejectLeaveRequest = async (id, admin_comment = '') => {
  const response = await api.put(`/leave-requests/${id}/reject`, { admin_comment });
  return response.data;
};

/**
 * Attendance Correction Requests API calls
 */
export const createCorrectionRequest = async (data) => {
  const response = await api.post('/attendance/corrections', data);
  return response.data;
};

export const getMyCorrectionRequests = async () => {
  const response = await api.get('/attendance/corrections/my');
  return response.data;
};

export const getCorrectionRequests = async (params = {}) => {
  const response = await api.get('/attendance/corrections', { params });
  return response.data;
};

export const getCorrectionRequest = async (id) => {
  const response = await api.get(`/attendance/corrections/${id}`);
  return response.data;
};

export const approveCorrectionRequest = async (id, admin_comment = '') => {
  const response = await api.patch(`/attendance/corrections/${id}/approve`, { admin_comment });
  return response.data;
};

export const rejectCorrectionRequest = async (id, admin_comment = '') => {
  const response = await api.patch(`/attendance/corrections/${id}/reject`, { admin_comment });
  return response.data;
};

/**
 * Attendance Remarks API call (Admin)
 */
export const updateAttendanceRemark = async (id, remark) => {
  const response = await api.put(`/attendance/${id}/remark`, { remark });
  return response.data;
};

/**
 * Export Attendance Report CSV API call (Admin)
 */
export const exportAttendanceCsv = async (params = {}) => {
  const response = await api.get('/attendance/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
};

export default api;




