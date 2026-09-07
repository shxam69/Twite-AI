import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  createLeaveRequest,
  getMyLeaveRequests,
  getLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
} from '../services/api';

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isEmployee = user?.role === 'employee';

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Employee Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState('CASUAL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
        const res = await getLeaveRequests({ status: statusFilter });
        setRequests(res.data || []);
      } else {
        const res = await getMyLeaveRequests();
        setRequests(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch leave requests');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);
      setSuccessMsg(null);

      await createLeaveRequest({
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
      });

      setSuccessMsg('Leave request submitted successfully!');
      setReason('');
      setStartDate('');
      setEndDate('');
      await fetchRequests();

      setTimeout(() => {
        setSuccessMsg(null);
        setIsModalOpen(false);
      }, 1500);
    } catch (err) {
      setFormError(err.message || 'Failed to submit leave request');
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
        await approveLeaveRequest(request.id, adminComment);
      } else {
        await rejectLeaveRequest(request.id, adminComment);
      }
      setActionTarget(null);
      setAdminComment('');
      await fetchRequests();
    } catch (err) {
      alert(err.message || 'Failed to process leave request');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            <span>✓ Approved</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            <span>✕ Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span>Pending</span>
          </span>
        );
    }
  };

  const getTypeBadge = (type) => {
    const colors = {
      CASUAL: 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
      SICK: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60',
      ANNUAL: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
      UNPAID: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    };
    return (
      <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold border ${colors[type] || colors.CASUAL}`}>
        {type}
      </span>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {isAdmin ? 'Leave Requests Management' : 'My Leave Requests'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAdmin ? 'Review and process employee leave applications' : 'Submit and track your leave applications'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isAdmin ? (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-500 transition-colors"
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
              <span>Apply for Leave</span>
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
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Main Table */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50/70 dark:bg-slate-850/60">
                {isAdmin && <th className="py-3.5 px-5">Employee</th>}
                <th className="py-3.5 px-5">Leave Type</th>
                <th className="py-3.5 px-5">Dates (From - To)</th>
                <th className="py-3.5 px-5">Reason</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Admin Comment</th>
                {isAdmin && <th className="py-3.5 px-5 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {isAdmin && <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-32" /></td>}
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-36" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-48" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                    <td className="py-4 px-5"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                    {isAdmin && <td className="py-4 px-5 text-right"><div className="h-6 bg-slate-200 rounded w-24 ml-auto" /></td>}
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
                    <td className="py-4 px-5">{getTypeBadge(item.leave_type)}</td>
                    <td className="py-4 px-5 whitespace-nowrap text-xs font-medium text-slate-700 dark:text-slate-300">
                      {item.start_date} <span className="text-slate-400 dark:text-slate-500 font-normal">to</span> {item.end_date}
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
                  <td colSpan={isAdmin ? 7 : 5} className="py-12 text-center text-slate-400 dark:text-slate-500 text-sm">
                    No leave requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Apply Leave Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="glass-modal rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Apply for Leave</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 text-xs rounded-xl font-medium">
                {formError}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 text-xs rounded-xl font-medium">
                {successMsg}
              </div>
            )}

            <form onSubmit={handleSubmitLeave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Leave Type
                </label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value)}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 transition-colors"
                >
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="ANNUAL">Annual Leave</option>
                  <option value="UNPAID">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    End Date
                  </label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Reason for Leave
                </label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Explain the purpose for your leave request..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-800">
              {actionTarget.type === 'APPROVE' ? 'Approve Leave Request' : 'Reject Leave Request'}
            </h3>
            <p className="text-xs text-slate-500">
              Request by <strong>{actionTarget.request.employee_name}</strong> for {actionTarget.request.start_date} to {actionTarget.request.end_date}.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Admin Comment / Note (Optional)
              </label>
              <textarea
                rows={3}
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                placeholder="E.g., Approved as per department schedule / Rejected due to project deadline..."
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex justify-end space-x-3 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setActionTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
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
                {processing ? 'Processing...' : actionTarget.type === 'APPROVE' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
