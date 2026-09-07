import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  createEmployeeInvite,
  getEmployeeInviteStatus,
  revokeEmployeeInvite,
} from '../services/api';
import EmployeeForm from '../components/EmployeeForm';
import ConfirmDialog from '../components/ConfirmDialog';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_LIMIT = 10;
const DEBOUNCE_MS = 400;

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const SORT_OPTIONS = [
  { value: 'created_at:desc', label: 'Newest First' },
  { value: 'created_at:asc', label: 'Oldest First' },
  { value: 'name:asc', label: 'Name (A–Z)' },
  { value: 'name:desc', label: 'Name (Z–A)' },
  { value: 'employee_id:asc', label: 'Employee ID (A–Z)' },
  { value: 'department:asc', label: 'Department (A–Z)' },
];

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const styles =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-slate-100 text-slate-500 border-slate-200';
  return (
    <span className={`inline-block px-2.5 py-0.5 text-xs font-medium rounded-full border ${styles}`}>
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // List state
  const [employees, setEmployees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState(null);

  // Filter / sort / page state
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('created_at:desc');
  const [page, setPage] = useState(1);

  // Add/Edit modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);   // null = add, object = edit
  const [formError, setFormError] = useState(null);
  const [formLoading, setFormLoading] = useState(false);

  // Deactivate confirm state
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // Debounce: update searchQuery after DEBOUNCE_MS of no typing
  const debounceTimer = useRef(null);
  const handleSearchInput = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(val);
      setPage(1);
    }, DEBOUNCE_MS);
  };

  // Reset page when filters change
  const handleDepartment = (e) => { setDepartment(e.target.value); setPage(1); };
  const handleStatus = (e) => { setStatus(e.target.value); setPage(1); };
  const handleSort = (e) => { setSort(e.target.value); setPage(1); };

  // Fetch employees list
  const fetchEmployees = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const [sortBy, sortOrder] = sort.split(':');
      const params = {
        page,
        limit: DEFAULT_LIMIT,
        sortBy,
        sortOrder,
      };
      if (searchQuery.trim()) params.search = searchQuery.trim();
      if (department) params.department = department;
      if (status) params.status = status;

      const res = await getEmployees(params);
      const employeeData = Array.isArray(res.data)
        ? res.data
        : (res.data?.employees || res.employees || []);
      const paginationData = res.pagination || res.data?.pagination || {};

      setEmployees(employeeData);
      setPagination({
        page: paginationData.page ?? 1,
        totalPages: paginationData.totalPages ?? 1,
        total: paginationData.total ?? 0,
      });
    } catch (err) {
      setListError(err.message || 'Failed to load employees.');
    } finally {
      setListLoading(false);
    }
  }, [page, searchQuery, department, status, sort]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // ── Add ──
  function openAdd() {
    setEditTarget(null);
    setFormError(null);
    setFormOpen(true);
  }

  // ── Edit ──
  function openEdit(emp) {
    setEditTarget(emp);
    setFormError(null);
    setFormOpen(true);
  }

  // ── Form submit (create or update) ──
  async function handleFormSubmit(payload) {
    setFormLoading(true);
    setFormError(null);
    try {
      if (editTarget) {
        await updateEmployee(editTarget.id, payload);
      } else {
        await createEmployee(payload);
      }
      setFormOpen(false);
      fetchEmployees();
    } catch (err) {
      setFormError(err.message || 'An error occurred. Please try again.');
    } finally {
      setFormLoading(false);
    }
  }

  // ── Deactivate ──
  function openDeactivate(emp) {
    setDeactivateTarget(emp);
  }

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    setDeactivateLoading(true);
    try {
      await deleteEmployee(deactivateTarget.id);
      setDeactivateTarget(null);
      fetchEmployees();
    } catch (err) {
      // Show error in a simple alert for simplicity; page will stay open
      alert(err.message || 'Failed to deactivate employee.');
    } finally {
      setDeactivateLoading(false);
    }
  }

  // ── Invitation handlers ──
  const [inviteActionLoading, setInviteActionLoading] = useState(null);

  async function handleInviteEmployee(emp) {
    setInviteActionLoading(emp.id);
    try {
      const res = await createEmployeeInvite(emp.id);
      const url = res.data.registration_url;
      try {
        await navigator.clipboard.writeText(url);
        alert(`Invitation link created & copied to clipboard!\n\nRegistration URL:\n${url}`);
      } catch (_) {
        alert(`Invitation link created successfully!\n\nRegistration URL:\n${url}`);
      }
      fetchEmployees();
    } catch (err) {
      alert(err.message || 'Failed to generate invitation link.');
    } finally {
      setInviteActionLoading(null);
    }
  }

  async function handleCopyInviteLink(emp) {
    setInviteActionLoading(emp.id);
    try {
      const res = await getEmployeeInviteStatus(emp.id);
      const resInvite = await createEmployeeInvite(emp.id);
      const url = resInvite.data.registration_url;
      try {
        await navigator.clipboard.writeText(url);
        alert(`Registration link copied to clipboard!\n\n${url}`);
      } catch (_) {
        alert(`Registration link:\n\n${url}`);
      }
    } catch (err) {
      alert(err.message || 'Failed to retrieve invitation link.');
    } finally {
      setInviteActionLoading(null);
    }
  }

  async function handleRevokeInvite(emp) {
    if (!window.confirm(`Revoke active invitation link for ${emp.name}?`)) return;
    setInviteActionLoading(emp.id);
    try {
      await revokeEmployeeInvite(emp.id);
      alert('Invitation link revoked successfully.');
      fetchEmployees();
    } catch (err) {
      alert(err.message || 'Failed to revoke invitation.');
    } finally {
      setInviteActionLoading(null);
    }
  }

  // ── Pagination buttons ──
  function renderPagination() {
    if (pagination.totalPages <= 1) return null;

    const pages = [];
    const { totalPages } = pagination;

    // Build page number list: always show first, last, current ± 1
    const visible = new Set([1, totalPages, page, page - 1, page + 1].filter(
      (p) => p >= 1 && p <= totalPages
    ));
    const sorted = [...visible].sort((a, b) => a - b);

    let prev = null;
    for (const p of sorted) {
      if (prev !== null && p - prev > 1) {
        pages.push(<span key={`ellipsis-${p}`} className="px-2 text-slate-400 text-sm">…</span>);
      }
      pages.push(
        <button
          key={p}
          onClick={() => setPage(p)}
          className={`w-8 h-8 text-sm rounded-lg font-medium transition-colors ${
            p === page
              ? 'bg-blue-600 text-white'
              : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          {p}
        </button>
      );
      prev = p;
    }

    return (
      <div className="flex items-center justify-between mt-4 gap-2 flex-wrap">
        <p className="text-xs text-slate-500">
          Showing {employees.length === 0 ? 0 : (page - 1) * DEFAULT_LIMIT + 1}–
          {(page - 1) * DEFAULT_LIMIT + employees.length} of {pagination.total} employee
          {pagination.total !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          {pages}
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= pagination.totalPages}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Employees</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Employee directory and management</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 shadow-sm transition-colors self-start sm:self-auto cursor-pointer"
          >
            + Add Employee
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="lg:col-span-2">
            <input
              type="search"
              value={searchInput}
              onChange={handleSearchInput}
              placeholder="Search by name, email, ID, department..."
              className="w-full border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition-colors"
            />
          </div>

          {/* Department filter */}
          <select
            value={department}
            onChange={handleDepartment}
            className="border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            <option value="">All Departments</option>
            <option value="Engineering">Engineering</option>
            <option value="HR">HR</option>
            <option value="Finance">Finance</option>
            <option value="Marketing">Marketing</option>
            <option value="Sales">Sales</option>
            <option value="Operations">Operations</option>
            <option value="IT">IT</option>
          </select>

          {/* Status filter */}
          <select
            value={status}
            onChange={handleStatus}
            className="border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 rounded-xl px-3 py-2 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Sort + result count */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mt-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {listLoading ? 'Loading...' : `${pagination.total} employee${pagination.total !== 1 ? 's' : ''} found`}
          </p>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">Sort by:</label>
            <select
              value={sort}
              onChange={handleSort}
              className="border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 rounded-lg px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {listError && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 rounded-xl p-4 text-sm">
          <span>&#9888;&#65039;</span>
          <div>
            <p className="font-semibold">Failed to load employees</p>
            <p className="text-xs text-red-500 dark:text-red-400 mt-0.5">{listError}</p>
          </div>
          <button onClick={fetchEmployees} className="ml-auto text-xs underline text-red-600 dark:text-red-400 hover:text-red-800">
            Retry
          </button>
        </div>
      )}

      {/* Table Card */}
      <div className="glass-card rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Emp ID</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Mobile</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Department</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Designation</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Status</th>
                {isAdmin && (
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Account / Invitation</th>
                )}
                {isAdmin && (
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {/* Loading skeletons */}
              {listLoading &&
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800/50 animate-pulse">
                    {[...Array(isAdmin ? 9 : 7)].map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))}

              {/* Data rows */}
              {!listLoading &&
                employees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-slate-100 dark:border-slate-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{emp.employee_id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{emp.name}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-[200px] truncate">{emp.email}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{emp.mobile || '—'}</td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{emp.department}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{emp.designation}</td>
                    <td className="px-4 py-3"><StatusBadge status={emp.status} /></td>
                    {isAdmin && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {emp.has_account ? (
                          <span className="inline-block px-2.5 py-0.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                            Account Created
                          </span>
                        ) : emp.pending_invitation ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleCopyInviteLink(emp)}
                              disabled={inviteActionLoading === emp.id}
                              className="text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                            >
                              Copy Link
                            </button>
                            <button
                              onClick={() => handleRevokeInvite(emp)}
                              disabled={inviteActionLoading === emp.id}
                              className="text-xs text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            >
                              Revoke
                            </button>
                          </div>
                        ) : emp.status === 'active' ? (
                          <button
                            onClick={() => handleInviteEmployee(emp)}
                            disabled={inviteActionLoading === emp.id}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
                          >
                            + Invite Employee
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEdit(emp)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800 mr-3 transition-colors"
                        >
                          Edit
                        </button>
                        {emp.status === 'active' && (
                          <button
                            onClick={() => openDeactivate(emp)}
                            className="text-xs font-medium text-rose-600 hover:text-rose-800 transition-colors"
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}

              {/* Empty state */}
              {!listLoading && employees.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 9 : 7} className="px-4 py-14 text-center">
                    <div className="text-3xl mb-2">&#128101;</div>
                    <p className="font-semibold text-slate-600">
                      {searchQuery || department || status
                        ? 'No employees match your filters'
                        : 'No employees yet'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery || department || status
                        ? 'Try adjusting the search or filters above.'
                        : isAdmin
                          ? 'Click "+ Add Employee" to add the first employee.'
                          : 'No employee records have been added yet.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!listLoading && employees.length > 0 && (
          <div className="px-4 pb-4">{renderPagination()}</div>
        )}
      </div>

      {/* Add / Edit Form Modal */}
      <EmployeeForm
        isOpen={formOpen}
        onClose={() => !formLoading && setFormOpen(false)}
        onSubmit={handleFormSubmit}
        initial={editTarget}
        error={formError}
        loading={formLoading}
      />

      {/* Deactivate Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deactivateTarget)}
        title="Deactivate Employee?"
        message={
          deactivateTarget
            ? `This will mark "${deactivateTarget.name}" (${deactivateTarget.employee_id}) as inactive. Their historical attendance records will be preserved. You can reactivate them later by editing the employee.`
            : ''
        }
        confirmLabel="Deactivate"
        cancelLabel="Cancel"
        onConfirm={handleDeactivate}
        onCancel={() => !deactivateLoading && setDeactivateTarget(null)}
        danger
        loading={deactivateLoading}
      />
    </div>
  );
}
