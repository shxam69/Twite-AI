import React, { useCallback, useEffect, useState } from 'react';
import { getDashboardStats, getMyDashboardStats } from '../services/api';
import { useAuth } from '../context/AuthContext';

// --- Stat Card ---
function StatCard({ label, value, accent, icon, sub }) {
  // Ensure non-primitive object or array is never rendered directly as a React child
  let displayValue = '--';
  if (value !== null && value !== undefined) {
    if (typeof value === 'object') {
      displayValue = Array.isArray(value) ? value.length : '--';
    } else {
      displayValue = value;
    }
  }

  let displaySub = null;
  if (sub !== null && sub !== undefined) {
    displaySub = typeof sub === 'object' ? '' : sub;
  }

  return (
    <div className={`glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs border-l-4 ${accent} p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-sm hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">{label}</span>
        <span className="text-xl p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">{icon}</span>
      </div>
      <div className="mt-2">
        <p className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 tracking-tight">{displayValue}</p>
        {displaySub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{displaySub}</p>}
      </div>
    </div>
  );
}

// --- Attendance Rate Bar ---
function AttendanceRateBar({ rate, title = "Today's Attendance Rate" }) {
  const pct = typeof rate === 'number' ? Math.min(100, Math.max(0, rate)) : 0;
  const color =
    pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500';

  return (
    <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{title}</h2>
        <span className={`text-2xl font-bold ${pct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 50 ? 'text-amber-500 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
          {rate !== null && rate !== undefined ? `${pct.toFixed(1)}%` : '--'}
        </span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
        {pct >= 75 ? 'Great attendance record!' : pct >= 50 ? 'Moderate attendance.' : 'Low attendance rate.'}
      </p>
    </div>
  );
}

// --- Department Breakdown (Admin) ---
function DepartmentTable({ departments }) {
  if (!departments || departments.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Department Breakdown</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">No department data available.</p>
      </div>
    );
  }

  const total = departments.reduce((sum, d) => sum + Number(d.count || d.total_employees || 0), 0);

  return (
    <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5">
      <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Department Breakdown</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800">
              <th className="text-left py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Department</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Employees</th>
              <th className="text-right py-2 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Share</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept, idx) => {
              const count = Number(dept.count || dept.total_employees || 0);
              const share = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
              return (
                <tr key={idx} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-2.5 text-slate-700 dark:text-slate-300 font-medium">{dept.department || 'Unassigned'}</td>
                  <td className="py-2.5 text-right text-slate-800 dark:text-slate-100 font-semibold">{count}</td>
                  <td className="py-2.5 text-right text-slate-400 dark:text-slate-500">{share}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 dark:border-slate-800">
              <td className="pt-2.5 text-xs font-semibold text-slate-500 dark:text-slate-400">Total</td>
              <td className="pt-2.5 text-right text-xs font-semibold text-slate-700 dark:text-slate-300">{total}</td>
              <td className="pt-2.5 text-right text-xs text-slate-400 dark:text-slate-500">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// --- Status Badge Helper ---
function StatusBadge({ status }) {
  switch (status?.toLowerCase()) {
    case 'present':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          Present
        </span>
      );
    case 'late':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
          Late
        </span>
      );
    case 'half_day':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
          Half Day
        </span>
      );
    case 'absent':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
          Absent
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
          Not Checked In
        </span>
      );
  }
}

// --- Employee Dashboard View ---
function EmployeeDashboardView({ data }) {
  const { employee, today, summary, recent_history } = data || {};

  return (
    <div className="space-y-6">
      {/* Personal Info Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-md border border-blue-500/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">{employee?.name || 'Employee Profile'}</h2>
            <p className="text-blue-100 text-sm mt-1">
              Employee ID: <span className="font-semibold text-white">{employee?.employee_id || '--'}</span>
              {employee?.department && ` • ${employee.department}`}
              {employee?.designation && ` • ${employee.designation}`}
            </p>
          </div>
          <div className="bg-white/10 dark:bg-black/20 backdrop-blur-md rounded-xl px-4 py-2 text-right border border-white/20 dark:border-white/10">
            <span className="text-xs text-blue-200 uppercase tracking-wider block">Today's Status</span>
            <div className="mt-1">
              <StatusBadge status={today?.status} />
            </div>
          </div>
        </div>
      </div>

      {/* Personal Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Today's Check-In"
          value={today?.check_in || 'Not checked in'}
          accent="border-emerald-500"
          icon="⏱️"
          sub={today?.working_duration ? `Duration: ${today.working_duration}` : 'Check-in time'}
        />
        <StatCard
          label="Today's Check-Out"
          value={today?.check_out || 'Not checked out'}
          accent="border-blue-500"
          icon="⌛"
          sub="Check-out time"
        />
        <StatCard
          label="Total Present Days"
          value={(summary?.present_count || 0) + (summary?.late_count || 0) + (summary?.half_day_count || 0)}
          accent="border-indigo-500"
          icon="✅"
          sub={`Out of ${summary?.total_records || 0} recorded days`}
        />
        <StatCard
          label="Attendance Rate"
          value={`${summary?.attendance_percentage ?? 0}%`}
          accent="border-purple-500"
          icon="📊"
          sub="Personal attendance percentage"
        />
      </div>

      {/* Today's Detail & Attendance Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Today's Summary Card */}
        <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <span>📅</span> Today's Attendance Overview
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Status</span>
              <StatusBadge status={today?.status} />
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Check-In Time</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{today?.check_in || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-sm text-slate-500 dark:text-slate-400">Check-Out Time</span>
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{today?.check_out || '—'}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Working Duration</span>
              <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{today?.working_duration || '—'}</span>
            </div>
          </div>
        </div>

        {/* Personal Attendance Rate Bar */}
        <AttendanceRateBar rate={summary?.attendance_percentage} title="My Attendance Rate" />
      </div>

      {/* Recent Personal Attendance History */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center justify-between">
          <span>📋 Recent Attendance History</span>
          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">Last {recent_history?.length || 0} records</span>
        </h2>
        {recent_history && recent_history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs font-semibold uppercase tracking-wide">
                  <th className="text-left py-2.5">Date</th>
                  <th className="text-left py-2.5">Status</th>
                  <th className="text-left py-2.5">Check In</th>
                  <th className="text-left py-2.5">Check Out</th>
                </tr>
              </thead>
              <tbody>
                {recent_history.map((record) => (
                  <tr key={record.id} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 text-slate-700 dark:text-slate-300 font-medium">{record.attendance_date}</td>
                    <td className="py-3">
                      <StatusBadge status={record.status} />
                    </td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{record.check_in || '—'}</td>
                    <td className="py-3 text-slate-600 dark:text-slate-400">{record.check_out || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500 py-4 text-center">No attendance history available.</p>
        )}
      </div>
    </div>
  );
}

// --- 7-Day Trend Bar Chart ---
function SevenDayTrendChart({ trend }) {
  const safeTrend = Array.isArray(trend) ? trend : [];
  if (safeTrend.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">7-Day Attendance Trend</h2>
        <p className="text-sm text-slate-400 dark:text-slate-500">No trend data available.</p>
      </div>
    );
  }

  // Find max value for scaling bars
  const maxVal = Math.max(...safeTrend.map((t) => Number(t.total_checked_in || t.present || 0)), 1);

  return (
    <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">7-Day Attendance Trend</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">Daily present employee volume over past week</p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 rounded-full border border-blue-100 dark:border-blue-800/60">
          Last 7 Days
        </span>
      </div>

      <div className="flex items-end justify-between h-40 pt-4 gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
        {safeTrend.map((day, idx) => {
          const count = Number(day.total_checked_in || day.present || 0);
          const onCount = Number(day.present_count || day.present || 0);
          const lateCount = Number(day.late_count || day.late || 0);
          const heightPct = Math.max(8, Math.round((count / maxVal) * 100));
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
              {/* Tooltip */}
              <div className="absolute -top-10 hidden group-hover:flex flex-col items-center z-10">
                <div className="bg-slate-800 dark:bg-slate-700 text-white text-[10px] py-1 px-2 rounded shadow-md whitespace-nowrap">
                  {count} Present ({onCount} ON, {lateCount} LT)
                </div>
                <div className="w-2 h-2 bg-slate-800 dark:bg-slate-700 rotate-45 -mt-1"></div>
              </div>

              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">{count}</span>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-t-md overflow-hidden flex items-end h-full">
                <div
                  className="w-full bg-gradient-to-t from-blue-600 to-indigo-500 rounded-t-md transition-all duration-300 group-hover:from-blue-500 group-hover:to-indigo-400"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 truncate max-w-full">
                {day.date_formatted || day.date}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Currently In Office Component ---
function CurrentlyInOfficeCard({ officeList, count }) {
  const safeList = Array.isArray(officeList) ? officeList : [];
  const safeCount =
    typeof count === 'number'
      ? count
      : Array.isArray(count)
      ? count.length
      : safeList.length;

  return (
    <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200">Currently In Office</h2>
        </div>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          {safeCount} Employees Active
        </span>
      </div>

      {safeList.length > 0 ? (
        <div className="divide-y divide-slate-50 dark:divide-slate-800/60 max-h-64 overflow-y-auto">
          {safeList.map((emp, idx) => {
            const name = emp.employee_name || emp.name || 'Employee';
            const code = emp.employee_code || (typeof emp.employee_id === 'string' ? emp.employee_id : `EMP-${emp.employee_id || idx + 1}`);
            const dept = emp.department || 'General';
            const desig = emp.designation || '';
            const checkInTime = emp.check_in || '--';
            const duration = emp.working_duration || null;
            const status = emp.status || 'present';

            return (
              <div key={emp.attendance_id || emp.id || idx} className="py-2.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 rounded-lg transition-colors">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs uppercase">
                    {name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{name}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500">
                      {dept}{desig ? ` • ${desig}` : ''} &bull; {code}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                    In: {checkInTime}
                  </div>
                  {duration && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                      {duration}
                    </div>
                  )}
                  <StatusBadge status={status} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
          No employees currently checked in.
        </div>
      )}
    </div>
  );
}

// --- Main Dashboard Page ---
export default function DashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isAdmin) {
        const res = await getDashboardStats();
        setData(res.data);
      } else {
        const res = await getMyDashboardStats();
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const todayStr = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  return (
    <div className="space-y-6">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            {isAdmin ? 'Admin Analytics & Dashboard' : 'My Dashboard'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{todayStr}</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
        >
          <span className={loading ? 'animate-spin inline-block' : ''}>&#8635;</span>
          Refresh Stats
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
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 animate-pulse">
              <div className="h-3 bg-slate-200 rounded w-2/3 mb-4" />
              <div className="h-8 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Admin Dashboard View */}
      {isAdmin && data && (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard
              label="Active Employees"
              value={data.active_employees}
              accent="border-blue-500"
              icon="👥"
              sub={`Out of ${data.total_employees ?? 0} registered`}
            />
            <StatCard
              label="Present Today"
              value={data.present_today}
              accent="border-emerald-500"
              icon="🟢"
              sub={`${data.status_breakdown?.Present || data.present_count || 0} ON, ${data.status_breakdown?.Late || data.late_count || 0} LT, ${data.status_breakdown?.Half_Day || data.half_day_count || 0} HD`}
            />
            <StatCard
              label="Currently In Office"
              value={
                typeof data.currently_in_office_count === 'number'
                  ? data.currently_in_office_count
                  : typeof data.currently_in_office === 'number'
                  ? data.currently_in_office
                  : Array.isArray(data.currently_in_office)
                  ? data.currently_in_office.length
                  : Array.isArray(data.currently_in_office_list)
                  ? data.currently_in_office_list.length
                  : 0
              }
              accent="border-indigo-500"
              icon="🏢"
              sub="On-site right now"
            />
            <StatCard
              label="Absent Today"
              value={data.absent_today}
              accent="border-rose-500"
              icon="🔴"
              sub="Not checked in"
            />
            <StatCard
              label="Attendance Rate"
              value={`${data.attendance_rate ?? data.attendance_percentage ?? 0}%`}
              accent="border-purple-500"
              icon="📊"
              sub="Today's team percentage"
            />
          </div>

          {/* Second row: 7-Day Trend & Currently In Office */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <SevenDayTrendChart trend={data.seven_day_trend || data.trend_last_7_days || []} />
            </div>
            <div>
              <CurrentlyInOfficeCard
                officeList={
                  Array.isArray(data.currently_in_office)
                    ? data.currently_in_office
                    : Array.isArray(data.currently_in_office_list)
                    ? data.currently_in_office_list
                    : []
                }
                count={
                  typeof data.currently_in_office_count === 'number'
                    ? data.currently_in_office_count
                    : Array.isArray(data.currently_in_office)
                    ? data.currently_in_office.length
                    : Array.isArray(data.currently_in_office_list)
                    ? data.currently_in_office_list.length
                    : 0
                }
              />
            </div>
          </div>

          {/* Third row: Attendance Rate Bar & Department Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <AttendanceRateBar rate={data.attendance_rate ?? data.attendance_percentage} />
            <DepartmentTable departments={data.department_breakdown} />
          </div>
        </>
      )}

      {/* Employee Dashboard View */}
      {!isAdmin && data && <EmployeeDashboardView data={data} />}
    </div>
  );
}


