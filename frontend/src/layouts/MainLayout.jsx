import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090d16] flex overflow-x-hidden text-slate-800 dark:text-slate-100 transition-colors">
      {/* Sidebar navigation */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        {/* Top header */}
        <Header onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />

        {/* Dynamic page content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>

        {/* Application footer */}
        <footer className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border-t border-slate-200 dark:border-slate-800/80 py-3.5 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500 dark:text-slate-400 transition-colors">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="font-medium text-slate-700 dark:text-slate-300">AttendanceMS Workforce Platform</span>
            <span className="text-slate-400 dark:text-slate-500">Enterprise Attendance &bull; Real-time Verification</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
