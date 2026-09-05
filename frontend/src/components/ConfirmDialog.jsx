import React from 'react';

/**
 * ConfirmDialog – lightweight modal for destructive action confirmations.
 * Props:
 *   isOpen      {boolean}
 *   title       {string}
 *   message     {string|ReactNode}
 *   confirmLabel {string}   default: "Confirm"
 *   cancelLabel  {string}   default: "Cancel"
 *   onConfirm   {function}
 *   onCancel    {function}
 *   danger      {boolean}   use red confirm button
 *   loading     {boolean}   disable buttons while processing
 */
export default function ConfirmDialog({
  isOpen,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  danger = false,
  loading = false,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={!loading ? onCancel : undefined}
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6 z-10">
        <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
        {message && (
          <p className="mt-2 text-sm text-slate-600">{message}</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 transition-colors ${
              danger
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
