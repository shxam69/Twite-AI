import React, { useState, useEffect, useCallback } from 'react';
import { getAttendanceEvents } from '../services/api';

export default function AuditTimelinePage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });

  // Filters
  const [eventType, setEventType] = useState('');
  const [verificationMethod, setVerificationMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Metadata Drawer State
  const [selectedMetadata, setSelectedMetadata] = useState(null);

  const fetchEvents = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAttendanceEvents({
        page,
        limit: 15,
        event_type: eventType,
        verification_method: verificationMethod,
        start_date: startDate,
        end_date: endDate,
      });
      setEvents(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 15, total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  }, [eventType, verificationMethod, startDate, endDate]);

  useEffect(() => {
    fetchEvents(1);
  }, [fetchEvents]);

  const getEventBadge = (type) => {
    switch (type) {
      case 'CHECK_IN':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">Check In</span>;
      case 'CHECK_OUT':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">Check Out</span>;
      case 'CHECK_IN_FAILED':
      case 'CHECK_OUT_FAILED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">Failed Attempt</span>;
      case 'ADMIN_ATTENDANCE_UPDATE':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60">Admin Update</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">{type}</span>;
    }
  };

  const getMethodBadge = (method) => {
    switch (method) {
      case 'QR':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">QR Code</span>;
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">Admin Action</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Manual</span>;
    }
  };

  const getResultBadge = (evt) => {
    const isFailed = evt.event_type && evt.event_type.endsWith('_FAILED');
    const metadata = evt.metadata || {};
    if (isFailed) {
      const reason = metadata.reason || metadata.error || 'Verification Failed';
      return (
        <div className="flex items-center space-x-2">
          <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            Failed ({reason})
          </span>
          {evt.metadata && Object.keys(evt.metadata).length > 0 && (
            <button
              onClick={() => setSelectedMetadata(evt.metadata)}
              className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline font-medium cursor-pointer ml-1"
              title="Inspect Raw Event Payload"
            >
              Details
            </button>
          )}
        </div>
      );
    }

    let label = 'Success';
    if (metadata.distance_meters !== undefined && metadata.distance_meters !== null) {
      label = `Verified (${Math.round(metadata.distance_meters)}m away)`;
    } else if (evt.verification_method === 'ADMIN') {
      label = 'Admin Updated';
    }

    return (
      <div className="flex items-center space-x-2">
        <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
          {label}
        </span>
        {evt.metadata && Object.keys(evt.metadata).length > 0 && (
          <button
            onClick={() => setSelectedMetadata(evt.metadata)}
            className="text-[11px] text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:underline font-medium cursor-pointer ml-1"
            title="Inspect Raw Event Payload"
          >
            Details
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel bg-white/80 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Attendance Audit Log</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Traceable immutable security event logs & audit history</p>
          </div>
        </div>

        <button
          onClick={() => fetchEvents(pagination.page)}
          className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer shrink-0 text-xs font-semibold"
          title="Refresh Events"
        >
          &#8635; Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel bg-white/80 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs flex flex-wrap items-center gap-3">
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Event Types</option>
          <option value="CHECK_IN">CHECK_IN</option>
          <option value="CHECK_OUT">CHECK_OUT</option>
          <option value="CHECK_IN_FAILED">CHECK_IN_FAILED</option>
          <option value="ADMIN_ATTENDANCE_UPDATE">ADMIN_ATTENDANCE_UPDATE</option>
        </select>

        <select
          value={verificationMethod}
          onChange={(e) => setVerificationMethod(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Verification Methods</option>
          <option value="QR">QR Code</option>
          <option value="MANUAL">Manual</option>
          <option value="ADMIN">Admin</option>
        </select>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
          placeholder="Start Date"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
          placeholder="End Date"
        />

        {(eventType || verificationMethod || startDate || endDate) && (
          <button
            onClick={() => {
              setEventType('');
              setVerificationMethod('');
              setStartDate('');
              setEndDate('');
            }}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 font-semibold"
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-400 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="glass-panel bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/80 dark:bg-slate-800/40">
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">Employee</th>
                <th className="py-3.5 px-5">Event</th>
                <th className="py-3.5 px-5">Method</th>
                <th className="py-3.5 px-5">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48" /></td>
                  </tr>
                ))
              ) : events.length > 0 ? (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="py-4 px-5 whitespace-nowrap text-xs font-mono text-slate-600 dark:text-slate-400">
                      {new Date(evt.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{evt.employee_name}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">{evt.employee_code}</div>
                    </td>
                    <td className="py-4 px-5">{getEventBadge(evt.event_type)}</td>
                    <td className="py-4 px-5">{getMethodBadge(evt.verification_method)}</td>
                    <td className="py-4 px-5">{getResultBadge(evt)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No audit log events found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-800/80 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Page <strong className="text-slate-700 dark:text-slate-200">{pagination.page}</strong> of <strong className="text-slate-700 dark:text-slate-200">{pagination.totalPages}</strong> ({pagination.total} events total)
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchEvents(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-200 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchEvents(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 dark:text-slate-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Inspector Drawer Modal */}
      {selectedMetadata !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-slate-950 glass-modal text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>🛡️</span>
                <span>Sanitized Audit Metadata</span>
              </h3>
              <button
                onClick={() => setSelectedMetadata(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Sanitized event details. Secrets, passwords, raw QR tokens, and sensitive keys are stripped server-side.
            </p>

            <pre className="bg-slate-900/90 p-4 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800 max-h-72">
              {JSON.stringify(selectedMetadata, null, 2)}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMetadata(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
