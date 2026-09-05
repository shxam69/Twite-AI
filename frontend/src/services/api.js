import axios from 'axios';

export const TOKEN_KEY = 'attendance_token';

// Normalize base URL without trailing slashes
const rawBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const baseURL = rawBaseURL.replace(/\/+$/, '');

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

export default api;
