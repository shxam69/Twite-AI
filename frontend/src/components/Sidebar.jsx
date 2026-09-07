import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isAdmin = user?.role === 'admin';

  // Grouped navigation definition
  const navGroups = [
    {
      title: 'Overview',
      items: [
        {
          to: '/dashboard',
          label: 'Dashboard',
          roles: ['admin', 'employee'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          to: '/attendance',
          label: 'Attendance',
          roles: ['admin', 'employee'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Workforce',
      items: [
        {
          to: '/employees',
          label: 'Employees',
          roles: ['admin'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
        {
          to: '/leaves',
          label: 'Leave Requests',
          roles: ['admin', 'employee'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          to: '/attendance/corrections',
          label: 'Corrections',
          roles: ['admin', 'employee'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Insights',
      items: [
        {
          to: '/qr-display',
          label: 'QR Terminal',
          roles: ['admin'],
          external: true,
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          ),
        },
        {
          to: '/admin/rewards',
          label: 'Rewards & Points',
          roles: ['admin'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          to: '/admin/help-requests',
          label: 'Help Requests',
          roles: ['admin'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ),
        },
        {
          to: '/admin/audit-log',
          label: 'Audit Log',
          roles: ['admin'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          to: '/attendance/settings',
          label: 'Attendance Settings',
          roles: ['admin'],
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
        },
      ],
    },
  ];

  // Filter sections and items based on role
  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.roles || item.roles.includes(user?.role)),
  })).filter((group) => group.items.length > 0);

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 ${
          isOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:shadow-none'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              AMS
            </div>
            <div>
              <span className="font-bold text-slate-800 tracking-tight text-base block leading-tight">
                AttendanceMS
              </span>
              <span className="text-[11px] font-medium text-slate-400 block">
                Workforce Platform
              </span>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            aria-label="Close sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation Links Grouped */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              {group.items.map((item) =>
                item.external ? (
                  <a
                    key={item.to}
                    href={item.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      if (window.innerWidth < 768) onClose();
                    }}
                    className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <div className="flex items-center space-x-3">
                      {item.icon}
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      ↗ KIOSK
                    </span>
                  </a>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => {
                      if (window.innerWidth < 768) onClose();
                    }}
                    className={({ isActive }) =>
                      `flex items-center space-x-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                      }`
                    }
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </NavLink>
                )
              )}
            </div>
          ))}
        </nav>


        {/* User Card & Logout Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center space-x-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm uppercase">
              {user?.username ? user.username.charAt(0) : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {user?.username || 'User'}
              </p>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                  {user?.role || 'Guest'}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-medium text-red-600 bg-white hover:bg-red-50 hover:text-red-700 border border-red-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
