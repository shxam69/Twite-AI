import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import QrDisplayPortalPage from './pages/QrDisplayPortalPage';
import AdminHelpRequestsPage from './pages/AdminHelpRequestsPage';
import AttendanceSettingsPage from './pages/AttendanceSettingsPage';
import EmployeeRegistrationPage from './pages/EmployeeRegistrationPage';
import LeaveRequestsPage from './pages/LeaveRequestsPage';
import AttendanceCorrectionsPage from './pages/AttendanceCorrectionsPage';
import AuditTimelinePage from './pages/AuditTimelinePage';
import AdminRewardsPage from './pages/AdminRewardsPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes (Clean layout without sidebar) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register/employee/:token" element={<EmployeeRegistrationPage />} />

            {/* Standalone Kiosk Route (Admin only, outside MainLayout) */}
            <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
              <Route path="/qr-display" element={<QrDisplayPortalPage />} />
            </Route>

            {/* Authenticated Application Shell (With Sidebar & Header) */}
            <Route element={<ProtectedRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/leaves" element={<LeaveRequestsPage />} />
                <Route path="/attendance/corrections" element={<AttendanceCorrectionsPage />} />
                <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/attendance/qr" element={<Navigate to="/qr-display" replace />} />
                  <Route path="/admin/rewards" element={<AdminRewardsPage />} />
                  <Route path="/admin/help-requests" element={<AdminHelpRequestsPage />} />
                  <Route path="/admin/audit-log" element={<AuditTimelinePage />} />
                  <Route path="/attendance/settings" element={<AttendanceSettingsPage />} />
                </Route>
                <Route path="/attendance" element={<AttendancePage />} />
              </Route>
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

