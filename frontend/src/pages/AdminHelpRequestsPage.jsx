import React, { useState, useEffect, useCallback } from 'react';
import { getHelpRequests, resolveHelpRequest } from '../services/api';

export default function AdminHelpRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getHelpRequests({ status: statusFilter });
      setRequests(res.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load help requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleResolve = async (id) => {
    try {
      setResolvingId(id);
      await resolveHelpRequest(id);
      await fetchRequests();
    } catch (err) {
      alert(err.message || 'Failed to resolve request');
    } finally {
      setResolvingId(null);
    }
  };

  const getTypeBadge = (type) => {
    switch (type) {
      case 'QR_SCAN':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">QR Scan</span>;
      case 'LOCATION_FAILED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">GPS / Geofence</span>;
      case 'CHECKIN_FAILED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">Check-in Error</span>;
      case 'CHECKOUT_FAILED':
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">Check-out Error</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">Other Support</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="glass-panel flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/90 dark:bg-slate-900/80 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Employee Help Requests</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage and resolve employee support issues</p>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center space-x-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="OPEN">Open Only</option>
            <option value="RESOLVED">Resolved Only</option>
          </select>
          <button
            onClick={fetchRequests}
            className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
            title="Refresh List"
          >
            &#8635;
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="glass-card bg-white/90 dark:bg-slate-900/80 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-800/60">
                <th className="py-3.5 px-5">Employee</th>
                <th className="py-3.5 px-5">Category</th>
                <th className="py-3.5 px-5">Message / Details</th>
                <th className="py-3.5 px-5">Submitted At</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-32" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-20" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16" /></td>
                    <td className="py-4 px-5 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16 ml-auto" /></td>
                  </tr>
                ))
              ) : requests.length > 0 ? (
                requests.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="font-semibold text-slate-800 dark:text-slate-100">{item.employee_name}</div>
                      <div className="text-xs text-slate-400 dark:text-slate-400">
                        {item.employee_code} &bull; {item.department || 'General'}
                      </div>
                    </td>
                    <td className="py-4 px-5">{getTypeBadge(item.request_type)}</td>
                    <td className="py-4 px-5 max-w-xs text-slate-700 dark:text-slate-300 text-xs">
                      {item.message || <span className="text-slate-400 dark:text-slate-500 italic">No details provided</span>}
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {new Date(item.created_at).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      {item.status === 'OPEN' ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                          <span>Open</span>
                        </span>
                      ) : (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            <span>✓ Resolved</span>
                          </span>
                          {item.resolved_by_name && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block">by {item.resolved_by_name}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right whitespace-nowrap">
                      {item.status === 'OPEN' && (
                        <button
                          onClick={() => handleResolve(item.id)}
                          disabled={resolvingId === item.id}
                          className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {resolvingId === item.id ? 'Resolving...' : 'Resolve'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No help requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
