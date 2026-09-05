import React from 'react';

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto my-12 bg-white p-8 rounded-xl shadow-sm border border-slate-200">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Welcome Back</h2>
        <p className="text-sm text-slate-500 mt-1">
          Sign in to access Attendance Management System
        </p>
      </div>

      <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Username
          </label>
          <input
            type="text"
            disabled
            placeholder="admin (placeholder)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Password
          </label>
          <input
            type="password"
            disabled
            placeholder="•••••••• (placeholder)"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
          />
        </div>

        <button
          type="button"
          disabled
          className="w-full py-2.5 px-4 bg-blue-600 text-white font-medium rounded-lg opacity-60 cursor-not-allowed text-sm"
        >
          Sign In (Module pending next step)
        </button>
      </form>

      <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <p className="font-semibold">⚠️ Foundation Phase Notice</p>
        <p className="mt-0.5">
          Authentication and JWT login endpoints will be implemented in the next module.
        </p>
      </div>
    </div>
  );
}
