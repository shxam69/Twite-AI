import React, { useState, useEffect } from 'react';
import { getEmployees, adminMarkAttendance, adminUpdateAttendance } from '../services/api';

export default function AdminManualAttendanceModal({
  isOpen,
  onClose,
  onSuccess,
  recordToEdit = null,
}) {
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    employee_id: '',
    attendance_date: new Date().toISOString().split('T')[0],
    check_in: '09:00:00',
    check_out: '18:00:00',
    status: 'present',
    reason: '',
  });

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    // Load active employees list for selection
    const loadEmployees = async () => {
      try {
        setLoadingEmployees(true);
        const res = await getEmployees({ limit: 500 });
        if (res.success && Array.isArray(res.data)) {
          setEmployees(res.data);
        }
      } catch (err) {
        console.error('Failed to load employees:', err);
      } finally {
        setLoadingEmployees(false);
      }
    };

    loadEmployees();

    if (recordToEdit) {
      setFormData({
        employee_id: recordToEdit.employee_id || '',
        attendance_date: recordToEdit.attendance_date || new Date().toISOString().split('T')[0],
        check_in: recordToEdit.check_in || '',
        check_out: recordToEdit.check_out || '',
        status: recordToEdit.status || 'present',
        reason: recordToEdit.remarks || '',
      });
    } else {
      setFormData({
        employee_id: '',
        attendance_date: new Date().toISOString().split('T')[0],
        check_in: '09:00:00',
        check_out: '18:00:00',
        status: 'present',
        reason: '',
      });
    }
  }, [isOpen, recordToEdit]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.employee_id) {
      setError('Please select an employee.');
      return;
    }

    if (!formData.attendance_date) {
      setError('Please select an attendance date.');
      return;
    }

    const trimmedReason = (formData.reason || '').trim();
    if (!trimmedReason) {
      setError('An administrative reason/remark is required for manual attendance override.');
      return;
    }

    // Time format normalization
    let normCheckIn = formData.check_in?.trim() || null;
    let normCheckOut = formData.check_out?.trim() || null;

    if (normCheckIn && normCheckIn.length === 5) normCheckIn = `${normCheckIn}:00`;
    if (normCheckOut && normCheckOut.length === 5) normCheckOut = `${normCheckOut}:00`;

    // Time ordering validation
    if (normCheckIn && normCheckOut) {
      if (normCheckOut <= normCheckIn) {
        setError('Check-out time must be after check-in time.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        employee_id: parseInt(formData.employee_id, 10),
        attendance_date: formData.attendance_date,
        check_in: normCheckIn,
        check_out: normCheckOut,
        status: formData.status,
        remarks: trimmedReason,
        reason: trimmedReason,
      };

      let res;
      if (recordToEdit?.id) {
        res = await adminUpdateAttendance(recordToEdit.id, payload);
      } else {
        res = await adminMarkAttendance(payload);
      }

      if (res.success) {
        onSuccess(res.message || (recordToEdit ? 'Attendance updated.' : 'Attendance marked.'));
        onClose();
      } else {
        setError(res.message || 'Operation failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save administrative attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Modal Header: Clear Admin Override Designation */}
        <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-indigo-800 p-5 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-xl font-bold">
              🛡️
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold">
                  {recordToEdit ? 'Modify Attendance (Admin Override)' : 'Mark Attendance (Admin Override)'}
                </h3>
                <span className="bg-purple-300/30 text-purple-100 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-purple-300/50">
                  Admin Only
                </span>
              </div>
              <p className="text-xs text-purple-200 mt-0.5">
                Authorized override with mandatory reason & audit trail logging
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white text-xl font-bold p-1 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-purple-50 border-b border-purple-100 px-5 py-3 text-xs text-purple-900 flex items-start space-x-2">
          <span className="text-purple-600 font-bold text-sm shrink-0">ℹ️</span>
          <span>
            This administrative action manually overrides standard employee self-service QR & GPS geofencing. 
            The record will be marked with verification method <strong className="font-mono bg-purple-200/70 px-1 py-0.5 rounded">ADMIN</strong> and logged in audit events.
          </span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2 animate-in fade-in duration-150">
              <span className="font-bold">✕</span>
              <span>{error}</span>
            </div>
          )}

          {/* Employee Select */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Select Employee <span className="text-rose-500">*</span>
            </label>
            <select
              name="employee_id"
              value={formData.employee_id}
              onChange={handleChange}
              disabled={loadingEmployees || Boolean(recordToEdit)}
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100 cursor-pointer"
              required
            >
              <option value="">-- Choose Employee --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.employee_id || emp.id}) — {emp.department || 'General'}
                </option>
              ))}
            </select>
          </div>

          {/* Attendance Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Attendance Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                name="attendance_date"
                value={formData.attendance_date}
                onChange={handleChange}
                disabled={Boolean(recordToEdit)}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-slate-100"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Status <span className="text-rose-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 cursor-pointer"
                required
              >
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
              </select>
            </div>
          </div>

          {/* Check-In & Check-Out Times */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Check-In Time (HH:MM:SS)
              </label>
              <input
                type="text"
                name="check_in"
                placeholder="09:00:00"
                value={formData.check_in}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Check-Out Time (HH:MM:SS)
              </label>
              <input
                type="text"
                name="check_out"
                placeholder="18:00:00"
                value={formData.check_out}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-mono bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Mandatory Reason / Remarks */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Administrative Reason / Remarks <span className="text-rose-500">* (Required)</span>
              </label>
              <span className="text-[11px] text-purple-600 font-semibold">Audit Mandatory</span>
            </div>
            <textarea
              name="reason"
              rows="3"
              value={formData.reason}
              onChange={handleChange}
              placeholder="Provide a mandatory administrative reason (e.g. Employee phone unavailable, QR scanner malfunction, Approved by manager, Present but unable to check in)..."
              className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Blank reasons are strictly forbidden. This remark will be attached to the attendance record and preserved in audit events.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? '⏳' : '🛡️'}</span>
              <span>{submitting ? 'Saving Override...' : (recordToEdit ? 'Save Override Changes' : 'Confirm Admin Override')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
