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
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Check In</span>;
      case 'CHECK_OUT':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Check Out</span>;
      case 'CHECK_IN_FAILED':
      case 'CHECK_OUT_FAILED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">Failed Attempt</span>;
      case 'ADMIN_ATTENDANCE_UPDATE':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">Admin Update</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">{type}</span>;
    }
  };

  const getMethodBadge = (method) => {
    switch (method) {
      case 'QR':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">QR Code</span>;
      case 'ADMIN':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">Admin Action</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">Manual</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Attendance Audit Log</h1>
            <p className="text-xs text-slate-500">Traceable immutable security event logs & audit history</p>
          </div>
        </div>

        <button
          onClick={() => fetchEvents(pagination.page)}
          className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
          title="Refresh Events"
        >
          &#8635; Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
        <select
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
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
          className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
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
          className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
          placeholder="Start Date"
        />

        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 focus:ring-2 focus:ring-blue-500"
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
            className="text-xs text-blue-600 hover:underline px-2 py-1 font-semibold"
          >
            Clear Filters
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
                <th className="py-3.5 px-5">Timestamp</th>
                <th className="py-3.5 px-5">Employee</th>
                <th className="py-3.5 px-5">Event Type</th>
                <th className="py-3.5 px-5">Method</th>
                <th className="py-3.5 px-5">Metadata Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-36" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-32" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-48" /></td>
                  </tr>
                ))
              ) : events.length > 0 ? (
                events.map((evt) => (
                  <tr key={evt.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-4 px-5 whitespace-nowrap text-xs font-mono text-slate-600">
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
                      <div className="font-semibold text-slate-800">{evt.employee_name}</div>
                      <div className="text-xs text-slate-400">{evt.employee_code}</div>
                    </td>
                    <td className="py-4 px-5">{getEventBadge(evt.event_type)}</td>
                    <td className="py-4 px-5">{getMethodBadge(evt.verification_method)}</td>
                    <td className="py-4 px-5">
                      <button
                        onClick={() => setSelectedMetadata(evt.metadata)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-mono font-medium underline cursor-pointer"
                      >
                        Inspect Safe Metadata ({Object.keys(evt.metadata || {}).length} keys)
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                    No audit log events found matching criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-slate-100 text-xs text-slate-500">
            <span>
              Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} events total)
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => fetchEvents(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchEvents(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Inspector Drawer Modal */}
      {selectedMetadata !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-slate-950 text-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-800 space-y-4">
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

            <pre className="bg-slate-900 p-4 rounded-xl text-xs font-mono text-emerald-400 overflow-x-auto border border-slate-800 max-h-72">
              {JSON.stringify(selectedMetadata, null, 2)}
            </pre>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedMetadata(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-xl"
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
