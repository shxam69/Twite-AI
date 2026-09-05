import React from 'react';

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance Tracking</h1>
          <p className="text-sm text-slate-500 mt-1">
            Daily check-in, check-out and status logging
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <input
            type="date"
            defaultValue={new Date().toISOString().split('T')[0]}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white text-slate-700"
          />
          <button
            disabled
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium text-sm opacity-60 cursor-not-allowed"
          >
            Mark Attendance (Pending)
          </button>
        </div>
      </div>

      {/* Wireframe Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Daily Attendance Records (Wireframe)
          </span>
          <span className="text-xs text-slate-400">0 Records</span>
        </div>
        <div className="p-12 text-center text-slate-400 space-y-2">
          <div className="text-4xl">⏱️</div>
          <p className="text-base font-semibold text-slate-600">
            Attendance Logging Module Not Implemented Yet
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            This module will support checking in, checking out, auto status calculation
            (present, late, half-day), and duplicate record prevention.
          </p>
        </div>
      </div>
    </div>
  );
}
