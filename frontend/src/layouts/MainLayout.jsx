import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export default function MainLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex overflow-x-hidden text-slate-800">
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
        <footer className="bg-white border-t border-slate-200 py-3.5 px-4 sm:px-6 lg:px-8 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Mini Attendance Management System &bull; Junior SE Assessment</span>
            <span className="text-slate-400">Secure JWT Session &bull; MySQL Relational DB</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
