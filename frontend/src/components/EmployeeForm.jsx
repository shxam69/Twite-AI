import React, { useEffect, useState } from 'react';

const EMPTY_FORM = {
  employee_id: '',
  name: '',
  email: '',
  mobile: '',
  department: '',
  designation: '',
  status: 'active',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * EmployeeForm – modal for creating or editing an employee.
 *
 * Props:
 *   isOpen     {boolean}
 *   onClose    {function}
 *   onSubmit   {function(formData): Promise}  – caller handles API call
 *   initial    {object|null}   – employee data for edit; null for create
 *   error      {string|null}   – server-side error message from parent
 *   loading    {boolean}
 */
export default function EmployeeForm({
  isOpen,
  onClose,
  onSubmit,
  initial = null,
  error = null,
  loading = false,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});

  // Populate form when modal opens (edit mode) or reset (create mode)
  useEffect(() => {
    if (isOpen) {
      if (initial) {
        setForm({
          employee_id: initial.employee_id || '',
          name: initial.name || '',
          email: initial.email || '',
          mobile: initial.mobile || '',
          department: initial.department || '',
          designation: initial.designation || '',
          status: initial.status || 'active',
        });
      } else {
        setForm(EMPTY_FORM);
      }
      setFieldErrors({});
    }
  }, [isOpen, initial]);

  if (!isOpen) return null;

  const isEdit = Boolean(initial);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({ ...prev, [name]: '' }));
    }
  }

  const PHONE_RE = /^[0-9]{10}$/;

  function validate() {
    const errors = {};
    if (!form.employee_id.trim()) errors.employee_id = 'Employee ID is required.';
    if (!form.name.trim()) errors.name = 'Name is required.';
    if (!form.email.trim()) {
      errors.email = 'Email is required.';
    } else if (!EMAIL_RE.test(form.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (form.mobile && form.mobile.trim() && !PHONE_RE.test(form.mobile.trim())) {
      errors.mobile = 'Mobile number must be exactly 10 digits.';
    }
    if (!form.department.trim()) errors.department = 'Department is required.';
    if (!form.designation.trim()) errors.designation = 'Designation is required.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    // Build payload – trim strings, empty mobile sent as null
    const payload = {
      employee_id: form.employee_id.trim(),
      name: form.name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim() || null,
      department: form.department.trim(),
      designation: form.designation.trim(),
      status: form.status,
    };
    await onSubmit(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-xs"
        onClick={!loading ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative glass-modal rounded-2xl shadow-2xl w-full max-w-lg z-10 max-h-[90vh] overflow-y-auto border border-slate-200/80 dark:border-slate-800">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-200/80 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {isEdit ? 'Edit Employee' : 'Add Employee'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors text-xl leading-none disabled:opacity-50 cursor-pointer"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Server error */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-xl text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="px-6 py-4 space-y-4">
            {/* Row 1: Employee ID + Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Employee ID"
                name="employee_id"
                value={form.employee_id}
                onChange={handleChange}
                error={fieldErrors.employee_id}
                disabled={isEdit || loading}
                placeholder="e.g. EMP001"
                required
              />
              <Field
                label="Full Name"
                name="name"
                value={form.name}
                onChange={handleChange}
                error={fieldErrors.name}
                disabled={loading}
                placeholder="e.g. John Smith"
                required
              />
            </div>

            {/* Row 2: Email + Mobile */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                error={fieldErrors.email}
                disabled={loading}
                placeholder="john@example.com"
                required
              />
              <Field
                label="Mobile"
                name="mobile"
                type="tel"
                maxLength={10}
                value={form.mobile}
                onChange={handleChange}
                error={fieldErrors.mobile}
                disabled={loading}
                placeholder="10 digits (Optional)"
              />
            </div>

            {/* Row 3: Department + Designation */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Department"
                name="department"
                value={form.department}
                onChange={handleChange}
                error={fieldErrors.department}
                disabled={loading}
                placeholder="e.g. Engineering"
                required
              />
              <Field
                label="Designation"
                name="designation"
                value={form.designation}
                onChange={handleChange}
                error={fieldErrors.designation}
                disabled={loading}
                placeholder="e.g. Software Engineer"
                required
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Status
              </label>
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={loading}
                className="w-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 transition-colors"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-5 pt-2 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {loading ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Small helper input component ─────────────────────────────────────────────
function Field({ label, name, value, onChange, error, disabled, placeholder, type = 'text', maxLength, required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        className={`w-full border rounded-xl px-3.5 py-2 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800/90 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 dark:disabled:bg-slate-900 disabled:text-slate-400 transition-colors ${
          error ? 'border-red-400 dark:border-red-500 bg-red-50/50 dark:bg-red-950/30' : 'border-slate-200 dark:border-slate-700'
        }`}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
