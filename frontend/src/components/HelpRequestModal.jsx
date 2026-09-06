import React, { useState } from 'react';
import { createHelpRequest } from '../services/api';

export default function HelpRequestModal({ isOpen, onClose, onSuccess }) {
  const [requestType, setRequestType] = useState('QR_SCAN');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      setSuccessMsg(null);

      await createHelpRequest({
        request_type: requestType,
        message,
      });

      setSuccessMsg('Help request submitted successfully. HR/Admin will review it.');
      setMessage('');
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setSuccessMsg(null);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Failed to submit help request');
    } finally {
      setSubmitting(false);
    }
  };

  const options = [
    { value: 'QR_SCAN', label: 'QR Scanner / Camera Issues', desc: 'Camera not opening, unable to scan, or invalid QR code.' },
    { value: 'LOCATION_FAILED', label: 'GPS / Geofence Failed', desc: 'Outside office location radius or GPS signal lost.' },
    { value: 'CHECKIN_FAILED', label: 'Check-in Error', desc: 'System rejected check-in attempt.' },
    { value: 'CHECKOUT_FAILED', label: 'Check-out Error', desc: 'System rejected check-out attempt.' },
    { value: 'OTHER', label: 'Other Support Required', desc: 'Any other issue regarding your attendance.' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">Submit Support Request</h3>
              <p className="text-xs text-slate-500">Notify Admin / HR about attendance issues</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-medium text-red-700">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-medium text-emerald-700">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Issue Category Radio Group */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Select Issue Type
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {options.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start p-3 rounded-xl border transition-all cursor-pointer ${
                    requestType === opt.value
                      ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="request_type"
                    value={opt.value}
                    checked={requestType === opt.value}
                    onChange={(e) => setRequestType(e.target.value)}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="ml-3 text-left">
                    <span className="text-xs font-semibold text-slate-800 block">
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      {opt.desc}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Additional Details Textarea */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Describe details (Optional)
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="E.g., Camera permission was granted but scanner failed to detect QR..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs rounded-xl shadow-xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
