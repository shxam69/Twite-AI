import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAdminNotificationCounts } from '../services/api';

export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [counts, setCounts] = useState({
    open_help_requests: 0,
    pending_leave_requests: 0,
    pending_correction_requests: 0,
    total_action_required: 0,
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [toastNotification, setToastNotification] = useState(null);
  const previousHelpCountRef = useRef(null);
  const dropdownRef = useRef(null);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;

    const fetchCounts = async () => {
      try {
        const res = await getAdminNotificationCounts();
        if (res.data) {
          const newCounts = res.data;
          
          // Check if open_help_requests increased
          if (
            previousHelpCountRef.current !== null &&
            newCounts.open_help_requests > previousHelpCountRef.current
          ) {
            const diff = newCounts.open_help_requests - previousHelpCountRef.current;
            setToastNotification({
              id: Date.now(),
              title: 'New Help Request',
              message: diff === 1 ? 'An employee requested technical assistance.' : `${diff} new employee help requests received.`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            });
          }

          previousHelpCountRef.current = newCounts.open_help_requests;
          setCounts(newCounts);
        }
      } catch (err) {
        // Silently handle header badge error
      }
    };

    fetchCounts();
    const timer = setInterval(fetchCounts, 12000);
    return () => clearInterval(timer);
  }, [isAdmin]);

  // Auto-dismiss toast notification after 7 seconds
  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  // Handle click outside notification dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine current page title from pathname
  const getPageTitle = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('dashboard')) return 'System Dashboard';
    if (path.includes('employees')) return 'Employee Management';
    if (path.includes('qr-display')) return 'QR Terminal';
    if (path.includes('help-requests')) return 'Help Requests';
    if (path.includes('leaves')) return 'Leave Management';
    if (path.includes('corrections')) return 'Attendance Corrections';
    if (path.includes('audit-log')) return 'Audit Log';
    if (path.includes('rewards')) return 'Rewards Management';
    if (path.includes('attendance/settings')) return 'Attendance Settings';
    if (path.includes('attendance')) return 'Attendance Tracking';
    return 'Attendance Management';
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 lg:px-8 shadow-2xs">
      {/* Left section: mobile hamburger & page title */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Mobile menu toggle */}
        <button
          onClick={onToggleSidebar}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Open sidebar"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div>
          <h1 className="text-base sm:text-lg font-bold text-slate-800 leading-tight">
            {getPageTitle()}
          </h1>
          <p className="hidden sm:block text-xs text-slate-400">
            Overview &bull; Workforce Attendance Platform
          </p>
        </div>
      </div>

      {/* Right section: System status & user actions */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {/* Admin Unified Notification Center Dropdown */}
        {isAdmin && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className={`relative flex items-center space-x-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                counts.total_action_required > 0
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Admin Action Notifications"
            >
              <span>🔔</span>
              <span className="hidden sm:inline">Notifications</span>
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                counts.total_action_required > 0 ? 'bg-amber-600 text-white animate-pulse' : 'bg-slate-200 text-slate-600'
              }`}>
                {counts.total_action_required}
              </span>
            </button>

            {/* Dropdown Menu */}
            {showDropdown && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Action Center</span>
                  <span className="text-[11px] font-medium text-slate-400">{counts.total_action_required} Pending</span>
                </div>

                <div className="py-1 divide-y divide-slate-50">
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      navigate('/admin/help-requests');
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg text-xs">🆘</span>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">Help Requests</div>
                        <div className="text-[10px] text-slate-500">Employee technical issues</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      counts.open_help_requests > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {counts.open_help_requests}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      navigate('/leaves');
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs">🌴</span>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">Leave Applications</div>
                        <div className="text-[10px] text-slate-500">Pending approval requests</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      counts.pending_leave_requests > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {counts.pending_leave_requests}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      navigate('/attendance/corrections');
                    }}
                    className="w-full px-4 py-2.5 text-left hover:bg-slate-50 flex items-center justify-between transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="p-1.5 bg-purple-100 text-purple-700 rounded-lg text-xs">✏️</span>
                      <div>
                        <div className="text-xs font-semibold text-slate-800">Attendance Corrections</div>
                        <div className="text-[10px] text-slate-500">Check-in time dispute requests</div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      counts.pending_correction_requests > 0 ? 'bg-purple-100 text-purple-800' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {counts.pending_correction_requests}
                    </span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* System online indicator */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-xs font-medium text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>System Online</span>
        </div>

        {/* User profile dropdown/pill */}
        <div className="flex items-center space-x-2.5 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-2xs">
            {user?.username ? user.username.charAt(0) : 'A'}
          </div>
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 leading-tight">
              {user?.username || 'admin'}
            </span>
            <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
              {user?.role || 'admin'}
            </span>
          </div>
        </div>

        {/* Top bar quick logout button */}
        <button
          onClick={handleLogout}
          className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 hover:border-red-200 transition-colors cursor-pointer"
          title="Sign Out"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>Logout</span>
        </button>
      </div>

      {/* Floating In-App Help Request Notification Toast */}
      {toastNotification && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-white rounded-2xl shadow-2xl border border-amber-300 p-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 text-lg shadow-sm">
              🆘
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  {toastNotification.title}
                </h4>
                <span className="text-[10px] text-slate-400 font-mono">
                  {toastNotification.timestamp}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-snug">
                {toastNotification.message}
              </p>
              <div className="mt-2.5 flex items-center space-x-2">
                <button
                  onClick={() => {
                    setToastNotification(null);
                    navigate('/admin/help-requests');
                  }}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
                >
                  View Request &rarr;
                </button>
                <button
                  onClick={() => setToastNotification(null)}
                  className="px-2.5 py-1 text-slate-400 hover:text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}


