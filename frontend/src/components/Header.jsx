import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header({ onToggleSidebar }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // Determine current page title from pathname
  const getPageTitle = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('dashboard')) return 'System Dashboard';
    if (path.includes('employees')) return 'Employee Management';
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
            Overview &bull; Assessment Portal
          </p>
        </div>
      </div>

      {/* Right section: System status & user actions */}
      <div className="flex items-center space-x-3 sm:space-x-4">
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
    </header>
  );
}
