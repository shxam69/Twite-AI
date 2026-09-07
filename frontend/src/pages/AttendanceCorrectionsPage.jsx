import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createCorrectionRequest,
  getMyCorrectionRequests,
  getCorrectionRequests,
  approveCorrectionRequest,
  rejectCorrectionRequest,
} from '../services/api';

export default function AttendanceCorrectionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Employee Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [requestedDate, setRequestedDate] = useState('');
  const [requestedCheckIn, setRequestedCheckIn] = useState('09:00:00');
  const [requestedCheckOut, setRequestedCheckOut] = useState('17:00:00');
  const [requestedStatus, setRequestedStatus] = useState('present');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Admin Process Action Modal State
  const [actionTarget, setActionTarget] = useState(null); // { request, type: 'APPROVE' | 'REJECT' }
  const [adminComment, setAdminComment] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      if (isAdmin) {
        const res = await getCorrectionRequests({ status: statusFilter });
        setRequests(res.data || []);
      } else {
        const res = await getMyCorrectionRequests();
        setRequests(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch correction requests');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);
      setSuccessMsg(null);

      await createCorrectionRequest({
        requested_date: requestedDate,
        requested_check_in: requestedCheckIn,
        requested_check_out: requestedCheckOut,
        requested_status: requestedStatus,
        reason,
      });

      setSuccessMsg('Attendance correction request submitted successfully!');
      setReason('');
      setRequestedDate('');
      await fetchRequests();

      setTimeout(() => {
        setSuccessMsg(null);
        setIsModalOpen(false);
      }, 1500);
    } catch (err) {
      setFormError(err.message || 'Failed to submit correction request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProcessAction = async () => {
    if (!actionTarget) return;
    try {
      setProcessing(true);
      const { request, type } = actionTarget;
      if (type === 'APPROVE') {
        await approveCorrectionRequest(request.id, adminComment);
      } else {
        await rejectCorrectionRequest(request.id, adminComment);
      }
      setActionTarget(null);
      setAdminComment('');
      await fetchRequests();
    } catch (err) {
      alert(err.message || 'Failed to process correction request');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
            <span>✓ Approved</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60">
            <span>✕ Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Pending</span>
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel bg-white/80 dark:bg-slate-900/60 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {isAdmin ? 'Attendance Corrections Portal' : 'My Attendance Corrections'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAdmin ? 'Review and approve employee attendance adjustment requests' : 'Request corrections for missed or inaccurate check-ins'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isAdmin ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending Only</option>
              <option value="APPROVED">Approved Only</option>
              <option value="REJECTED">Rejected Only</option>
            </select>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
            >
              <span>+</span>
              <span>Request Correction</span>
            </button>
          )}

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
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="glass-panel bg-white/80 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800/80 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/80 dark:bg-slate-800/40">
                {isAdmin && <th className="py-3.5 px-5">Employee</th>}
                <th className="py-3.5 px-5">Requested Date</th>
                <th className="py-3.5 px-5">Proposed Check-In / Out</th>
                <th className="py-3.5 px-5">Proposed Status</th>
                <th className="py-3.5 px-5">Reason</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Admin Comment</th>
                {isAdmin && <th className="py-3.5 px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {isAdmin && <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-32" /></td>}
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-36" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-16" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-48" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-20" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-24" /></td>
                    {isAdmin && <td className="py-4 px-5 text-right"><div className="h-6 bg-slate-200 dark:bg-slate-800 rounded w-24 ml-auto" /></td>}
                  </tr>
                ))
              ) : requests.length > 0 ? (
                requests.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                    {isAdmin && (
                      <td className="py-4 px-5">
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{item.employee_name}</div>
                        <div className="text-xs text-slate-400 dark:text-slate-500">
                          {item.employee_code} &bull; {item.department || 'General'}
                        </div>
                      </td>
                    )}
                    <td className="py-4 px-5 whitespace-nowrap font-medium text-slate-800 dark:text-slate-200">{item.requested_date}</td>
                    <td className="py-4 px-5 whitespace-nowrap text-xs font-mono text-slate-600 dark:text-slate-400">
                      {item.requested_check_in || '--'} &rarr; {item.requested_check_out || '--'}
                    </td>
                    <td className="py-4 px-5 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                        {item.requested_status}
                      </span>
                    </td>
                    <td className="py-4 px-5 max-w-xs text-slate-700 dark:text-slate-300 text-xs">{item.reason}</td>
                    <td className="py-4 px-5 whitespace-nowrap">{getStatusBadge(item.status)}</td>
                    <td className="py-4 px-5 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                      {item.admin_comment ? (
                        <span>{item.admin_comment}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600 italic">No comment</span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-4 px-5 text-right whitespace-nowrap space-x-2">
                        {item.status === 'PENDING' ? (
                          <>
                            <button
                              onClick={() => setActionTarget({ request: item, type: 'APPROVE' })}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setActionTarget({ request: item, type: 'REJECT' })}
                              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                            Reviewed by {item.reviewer_name || 'Admin'}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 8 : 6} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No attendance correction requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Correction Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 glass-modal rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Request Attendance Correction</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/60 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 text-xs rounded-xl font-medium">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmitCorrection} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Target Attendance Date
                </label>
                <input
                  type="date"
                  required
                  value={requestedDate}
                  onChange={(e) => setRequestedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Proposed Check-In
                  </label>
                  <input
                    type="text"
                    placeholder="09:00:00"
                    value={requestedCheckIn}
                    onChange={(e) => setRequestedCheckIn(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                    Proposed Check-Out
                  </label>
                  <input
                    type="text"
                    placeholder="17:00:00"
                    value={requestedCheckOut}
                    onChange={(e) => setRequestedCheckOut(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Proposed Status
                </label>
                <select
                  value={requestedStatus}
                  onChange={(e) => setRequestedStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="half_day">Half Day</option>
                  <option value="absent">Absent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                  Reason for Correction
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain why this attendance record requires adjustment..."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Action Process Modal */}
      {actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 glass-modal rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
              {actionTarget.type === 'APPROVE' ? 'Approve Attendance Correction' : 'Reject Attendance Correction'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Correction by <strong className="text-slate-700 dark:text-slate-200">{actionTarget.request.employee_name}</strong> for date <strong className="text-slate-700 dark:text-slate-200">{actionTarget.request.requested_date}</strong> ({actionTarget.request.requested_status}).
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1">
                Admin Comment / Note (Optional)
              </label>
              <textarea
                rows={3}
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="E.g., Approved after manager verification / Rejected due to invalid timestamp..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleProcessAction}
                disabled={processing}
                className={`px-5 py-2 text-white font-semibold text-xs rounded-xl shadow-xs disabled:opacity-50 ${
                  actionTarget.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {processing ? 'Processing...' : actionTarget.type === 'APPROVE' ? 'Approve & Update Record' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
