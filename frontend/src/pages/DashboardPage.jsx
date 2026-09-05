import React, { useCallback, useEffect, useState } from 'react';
import { getDashboardStats } from '../services/api';

// --- Stat Card ---
function StatCard({ label, value, accent, icon, sub }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm border-l-4 ${accent} p-5 flex flex-col gap-1`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className="text-3xl font-bold text-slate-800 mt-1">{value ?? '--'}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

// --- Attendance Rate Bar ---
function AttendanceRateBar({ rate }) {
  const pct = typeof rate === 'number' ? Math.min(100, Math.max(0, rate)) : 0;
  const color =
    pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">Today's Attendance Rate</h2>
        <span className={`text-2xl font-bold ${pct >= 75 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-500' : 'text-rose-600'}`}>
          {rate !== null && rate !== undefined ? `${pct.toFixed(1)}%` : '--'}
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-2">
        {pct >= 75 ? 'Great attendance today!' : pct >= 50 ? 'Moderate attendance.' : 'Low attendance today.'}
      </p>
    </div>
  );
}

// --- Department Breakdown ---
function DepartmentTable({ departments }) {
  if (!departments || departments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Department Breakdown</h2>
        <p className="text-sm text-slate-400">No department data available.</p>
      </div>
    );
  }

  const total = departments.reduce((sum, d) => sum + Number(d.count), 0);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h2 className="text-sm font-semibold text-slate-700 mb-4">Department Breakdown</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Department</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Employees</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-400 uppercase tracking-wide">Share</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept, idx) => {
              const count = Number(dept.count);
              const share = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
              return (
                <tr key={idx} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="py-2.5 text-slate-700 font-medium">{dept.department || 'Unassigned'}</td>
                  <td className="py-2.5 text-right text-slate-800 font-semibold">{count}</td>
                  <td className="py-2.5 text-right text-slate-400">{share}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200">
              <td className="pt-2.5 text-xs font-semibold text-slate-500">Total</td>
              <td className="pt-2.5 text-right text-xs font-semibold text-slate-700">{total}</td>
              <td className="pt-2.5 text-right text-xs text-slate-400">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// --- Main Dashboard Page ---
export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDashboardStats();
      setStats(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">{today}</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>&#8635;</span>
          Refresh
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          <span className="text-base">&#9888;&#65039;</span>
          <div>
            <p className="font-semibold">Failed to load dashboard</p>
            <p className="text-xs text-red-500 mt-0.5">{error}</p>
          </div>
          <button
            onClick={fetchStats}
            className="ml-auto text-xs underline text-red-600 hover:text-red-800"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-2/3 mb-4" />
              <div className="h-8 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Employees"
              value={stats.total_employees}
              accent="border-blue-500"
              icon="&#128101;"
              sub="All registered employees"
            />
            <StatCard
              label="Active Employees"
              value={stats.active_employees}
              accent="border-indigo-500"
              icon="&#9989;"
              sub="Currently active"
            />
            <StatCard
              label="Present Today"
              value={stats.present_today}
              accent="border-emerald-500"
              icon="&#128994;"
              sub="Present, late, or half-day"
            />
            <StatCard
              label="Absent Today"
              value={stats.absent_today}
              accent="border-rose-500"
              icon="&#128308;"
              sub="Active employees not checked in"
            />
          </div>

          {/* Second row: rate bar + department table */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AttendanceRateBar rate={stats.attendance_rate} />
            <DepartmentTable departments={stats.department_breakdown} />
          </div>
        </>
      )}
    </div>
  );
}
