import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-600 text-white'
        : 'text-slate-600 hover:text-blue-600 hover:bg-slate-100'
    }`;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              AMS
            </div>
            <div>
              <span className="text-lg font-bold text-slate-800 tracking-tight block">
                AttendanceMS
              </span>
              <span className="text-xs text-slate-400 block -mt-1 font-medium">
                Technical Assessment
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {isAuthenticated && (
              <>
                <NavLink to="/dashboard" className={navLinkClass}>
                  Dashboard
                </NavLink>
                <NavLink to="/employees" className={navLinkClass}>
                  Employees
                </NavLink>
                <NavLink to="/attendance" className={navLinkClass}>
                  Attendance
                </NavLink>
              </>
            )}

            {/* Auth Actions */}
            {isAuthenticated ? (
              <div className="flex items-center space-x-3 ml-2 pl-3 border-l border-slate-200">
                <div className="hidden sm:flex flex-col text-right">
                  <span className="text-xs font-semibold text-slate-700">
                    {user?.username}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-blue-600 tracking-wider">
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 rounded-md text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <NavLink
                to="/login"
                className="ml-2 px-4 py-2 rounded-md text-sm font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 transition-colors"
              >
                Login
              </NavLink>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
