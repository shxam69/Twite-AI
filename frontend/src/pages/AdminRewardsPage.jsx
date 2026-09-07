import React, { useState, useEffect } from 'react';
import {
  getRewardStats,
  getRewardsCatalog,
  createRewardItem,
  updateRewardItem,
  getAllRedemptions,
  updateRedemptionStatus,
} from '../services/api';

export default function AdminRewardsPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState(null);

  // Modals & form state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    points_cost: 100,
    stock_quantity: 50,
    status: 'active',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, catalogRes, redemptionsRes] = await Promise.all([
        getRewardStats(),
        getRewardsCatalog(true), // include inactive
        getAllRedemptions(statusFilter || undefined),
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (catalogRes.success) setCatalog(catalogRes.data);
      if (redemptionsRes.success) setRedemptions(redemptionsRes.data);
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load rewards dashboard data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      title: '',
      description: '',
      points_cost: 100,
      stock_quantity: 50,
      status: 'active',
    });
    setShowAddModal(true);
  };

  const handleOpenEdit = (item) => {
    setEditingItem(item);
    setFormData({
      title: item.title || item.name,
      description: item.description || '',
      points_cost: item.points_cost,
      stock_quantity: item.stock_quantity ?? 100,
      status: item.status,
    });
    setShowAddModal(true);
  };

  const handleSaveReward = async (e) => {
    e.preventDefault();
    setFormSubmitting(true);
    setMessage(null);

    try {
      if (editingItem) {
        await updateRewardItem(editingItem.id, formData);
        setMessage({ type: 'success', text: `Reward item "${formData.title}" updated successfully.` });
      } else {
        await createRewardItem(formData);
        setMessage({ type: 'success', text: `New reward item "${formData.title}" added to catalog.` });
      }
      setShowAddModal(false);
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save reward item.' });
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const newStatus = item.status === 'active' ? 'inactive' : 'active';
      await updateRewardItem(item.id, { status: newStatus });
      setMessage({
        type: 'success',
        text: `Reward "${item.title || item.name}" marked as ${newStatus}.`,
      });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update reward status.' });
    }
  };

  const handleUpdateRedemption = async (id, newStatus) => {
    try {
      await updateRedemptionStatus(id, newStatus);
      setMessage({
        type: 'success',
        text: `Redemption #${id} marked as ${newStatus}.${newStatus === 'CANCELLED' ? ' Points were automatically refunded to employee wallet.' : ''}`,
      });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update redemption.' });
    }
  };

  // Filter redemptions by search
  const filteredRedemptions = redemptions.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.employee_name && r.employee_name.toLowerCase().includes(q)) ||
      (r.employee_code && r.employee_code.toLowerCase().includes(q)) ||
      (r.reward_name && r.reward_name.toLowerCase().includes(q)) ||
      String(r.id).includes(q)
    );
  });

  if (loading && !stats) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-medium text-slate-500">Loading Rewards & Points Management Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg shadow-xs">
              🎁
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                Rewards & Points Management
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Workforce reward balances, catalog configuration, extra hours incentives, and redemption fulfillment.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={loadData}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            ↻ Refresh Data
          </button>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
          >
            <span>➕</span>
            <span>Add Catalog Item</span>
          </button>
        </div>
      </div>

      {/* Message Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-150 ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Points Issued</span>
          <div className="text-2xl font-extrabold text-blue-600 font-mono">
            {stats?.total_points_issued?.toLocaleString() ?? 0}
          </div>
          <p className="text-[11px] text-slate-500">From verified extra shift hours</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Points Redeemed</span>
          <div className="text-2xl font-extrabold text-amber-600 font-mono">
            {stats?.total_points_redeemed?.toLocaleString() ?? 0}
          </div>
          <p className="text-[11px] text-slate-500">Spent on catalog vouchers</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Active Participants</span>
          <div className="text-2xl font-extrabold text-emerald-600 font-mono">
            {stats?.total_active_participants?.toLocaleString() ?? 0}
          </div>
          <p className="text-[11px] text-slate-500">Employees earning/redeeming points</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Redemptions</span>
          <div className="text-2xl font-extrabold text-purple-600 font-mono">
            {stats?.total_redemptions?.toLocaleString() ?? 0}
          </div>
          <p className="text-[11px] text-slate-500">Fulfillment order requests</p>
        </div>
      </div>

      {/* Points Analytics: Weekly Points Trend Chart & Top Earners */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Trend Bar Chart (Real DB Data) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">Weekly Points Trend (Last 7 Days)</h2>
              <p className="text-xs text-slate-500">Real points awarded daily based on verified checkout extra hours</p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">7-Day Total</span>
              <span className="text-base font-extrabold text-blue-600 font-mono">
                {stats?.points_this_week?.toLocaleString() ?? 0} pts
              </span>
            </div>
          </div>

          {/* Bar chart representation */}
          <div className="space-y-3 pt-2">
            {stats?.weekly_trend && stats.weekly_trend.length > 0 ? (
              stats.weekly_trend.map((day) => {
                const maxPoints = Math.max(...stats.weekly_trend.map((d) => d.points), 100);
                const percent = Math.min(100, Math.round((day.points / maxPoints) * 100));
                return (
                  <div key={day.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 w-28 truncate">
                        {day.day_name} <span className="text-slate-400 text-[10px]">({day.date.slice(5)})</span>
                      </span>
                      <span className="font-mono font-bold text-slate-800">
                        {day.points} pts
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          day.points > 0 ? 'bg-blue-600' : 'bg-transparent'
                        }`}
                        style={{ width: `${day.points > 0 ? Math.max(percent, 4) : 0}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400 py-6 text-center">No trend data available.</p>
            )}
          </div>
        </div>

        {/* Top Earners Leaderboard */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-800">🏆 Top Point Earners</h2>
            <p className="text-xs text-slate-500">Highest all-time extra shift contributors</p>
          </div>

          <div className="divide-y divide-slate-100">
            {!stats?.top_earners || stats.top_earners.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No earners recorded yet.</p>
            ) : (
              stats.top_earners.map((emp, index) => (
                <div key={emp.id} className="py-2.5 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-5 text-center text-xs font-bold text-slate-400 font-mono">
                      #{index + 1}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{emp.name}</h4>
                      <p className="text-[10px] text-slate-400">{emp.department} &bull; {emp.employee_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold font-mono text-amber-600 block">
                      {emp.balance} <span className="text-[10px] font-normal text-slate-500">pts</span>
                    </span>
                    <span className="text-[10px] text-slate-400">Total: {emp.total_earned}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Rewards Catalog Management */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Rewards Catalog</h2>
            <p className="text-xs text-slate-500">
              Create, edit, adjust points cost, manage stock availability, and activate/archive catalog items.
            </p>
          </div>

          <span className="text-xs font-bold text-slate-500">
            {catalog.length} Total Items
          </span>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Title & Item</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Points Cost</th>
                <th className="py-3 px-4">Stock Available</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {catalog.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    No reward catalog items created yet. Click "Add Catalog Item" above.
                  </td>
                </tr>
              ) : (
                catalog.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {item.title || item.name}
                    </td>
                    <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                      {item.description || '—'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-600">
                      {item.points_cost} pts
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-700">
                      {item.stock_quantity ?? 100}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {item.status === 'active' ? 'Active' : 'Archived / Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-semibold cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer ${
                          item.status === 'active'
                            ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        {item.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Redemptions Management Table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800">Employee Point Redemptions</h2>
            <p className="text-xs text-slate-500">
              Review, fulfill, or cancel employee redemption orders with transactional balance protection.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <input
              type="text"
              placeholder="Search employee or reward..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">PENDING</option>
              <option value="APPROVED">APPROVED</option>
              <option value="FULFILLED">FULFILLED</option>
              <option value="CANCELLED">CANCELLED</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Reward Item</th>
                <th className="py-3 px-4">Points Spent</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRedemptions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-400">
                    No redemption records found.
                  </td>
                </tr>
              ) : (
                filteredRedemptions.map((red) => (
                  <tr key={red.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono text-slate-500">#{red.id}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-800 block">{red.employee_name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{red.employee_code}</span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-700">{red.reward_name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-600">{red.points_spent} pts</td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {new Date(red.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          red.status === 'FULFILLED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : red.status === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {red.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      {red.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleUpdateRedemption(red.id, 'FULFILLED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold text-[10px] cursor-pointer"
                          >
                            Fulfill
                          </button>
                          <button
                            onClick={() => handleUpdateRedemption(red.id, 'CANCELLED')}
                            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold text-[10px] cursor-pointer"
                            title="Cancel and refund points to employee"
                          >
                            Cancel & Refund
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Reward Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-base">
                {editingItem ? 'Edit Reward Item' : 'Add New Catalog Reward'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveReward} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ☕ Gourmet Coffee Voucher"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Reward item perks and redemption details..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Points Cost</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.points_cost}
                    onChange={(e) => setFormData((prev) => ({ ...prev, points_cost: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, stock_quantity: e.target.value }))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs bg-white"
                >
                  <option value="active">Active (Visible in Employee Catalog)</option>
                  <option value="inactive">Inactive / Archived</option>
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Saving...' : editingItem ? 'Update Reward' : 'Create Reward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
