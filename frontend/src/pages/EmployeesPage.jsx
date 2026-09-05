import React from 'react';

export default function EmployeesPage() {
  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employee Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Maintain employee master data and directory
          </p>
        </div>
        <button
          disabled
          className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm opacity-60 cursor-not-allowed self-start sm:self-auto"
        >
          + Add Employee (Pending)
        </button>
      </div>

      {/* Wireframe Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Employee Directory (Wireframe)
          </span>
          <span className="text-xs text-slate-400">0 Records</span>
        </div>
        <div className="p-12 text-center text-slate-400 space-y-2">
          <div className="text-4xl">👥</div>
          <p className="text-base font-semibold text-slate-600">
            Employee CRUD Module Not Implemented Yet
          </p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            This module will include full CRUD operations (Add, View, Update, Delete)
            and validation in the upcoming development step.
          </p>
        </div>
      </div>
    </div>
  );
}
