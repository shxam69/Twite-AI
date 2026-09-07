import React, { useState, useEffect } from 'react';
import {
  getAttendancePolicies,
  updateAttendancePolicy,
  getRewardsCatalog,
  createRewardItem,
  getAllRedemptions,
  updateRedemptionStatus,
} from '../services/api';

const ALLOWED_POLICY_KEYS = [
  'workplace_latitude',
  'workplace_longitude',
  'workplace_radius_meters',
  'qr_validity_seconds',
  'office_start_time',
  'grace_period_minutes',
  'minimum_checkout_hours',
  'temporary_exit_enabled',
  'monthly_exit_allowance',
  'auto_checkout_enabled',
  'standard_work_hours',
  'reward_points_per_extra_hour',
];

export default function AttendanceSettingsPage() {
  const [policies, setPolicies] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState(null);
  const [saveAllLoading, setSaveAllLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }
  const [locating, setLocating] = useState(false);

  // Rewards Management State
  const [catalogItems, setCatalogItems] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [showAddRewardModal, setShowAddRewardModal] = useState(false);
  const [newReward, setNewReward] = useState({ title: '', description: '', points_cost: 100, stock_quantity: 10 });
  const [rewardSubmitting, setRewardSubmitting] = useState(false);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      const res = await getAttendancePolicies();
      if (res.success && Array.isArray(res.data)) {
        const policyMap = {};
        res.data.forEach((p) => {
          const key = p.key || p.policy_key;
          if (key && ALLOWED_POLICY_KEYS.includes(key)) {
            policyMap[key] = p.value !== undefined ? p.value : p.policy_value || '';
          }
        });
        setPolicies(policyMap);
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to load attendance policies.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchRewardsData = async () => {
    try {
      const catalogRes = await getRewardsCatalog(true);
      if (catalogRes.success) setCatalogItems(catalogRes.data || []);
      const redemptionsRes = await getAllRedemptions();
      if (redemptionsRes.success) setRedemptions(redemptionsRes.data || []);
    } catch (err) {
      console.error('Error fetching rewards admin data:', err);
    }
  };

  useEffect(() => {
    fetchPolicies();
    fetchRewardsData();
  }, []);

  const handleChange = (key, value) => {
    if (!key || !ALLOWED_POLICY_KEYS.includes(key)) return;
    setPolicies((prev) => ({ ...prev, [key]: value }));
  };

  const handleSaveSingle = async (key) => {
    if (!key || key === 'undefined' || !ALLOWED_POLICY_KEYS.includes(key)) {
      setMessage({ type: 'error', text: 'Invalid policy key.' });
      return;
    }

    try {
      setSavingKey(key);
      setMessage(null);
      const val = policies[key] !== undefined && policies[key] !== null ? String(policies[key]) : '';
      await updateAttendancePolicy(key, val);
      setMessage({ type: 'success', text: `Policy '${key}' updated successfully!` });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || `Failed to update '${key}'.` });
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveAll = async () => {
    try {
      setSaveAllLoading(true);
      setMessage(null);

      // Explicitly iterate over allowed keys only to ensure no undefined or invalid keys are sent
      for (const key of ALLOWED_POLICY_KEYS) {
        const val = policies[key] !== undefined && policies[key] !== null ? String(policies[key]) : '';
        await updateAttendancePolicy(key, val);
      }

      setMessage({ type: 'success', text: 'All attendance & reward policies saved successfully!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to save one or more policies.' });
    } finally {
      setSaveAllLoading(false);
    }
  };

  const handleCreateReward = async (e) => {
    e.preventDefault();
    if (!newReward.title || !newReward.points_cost) return;
    setRewardSubmitting(true);
    try {
      const res = await createRewardItem(newReward);
      if (res.success) {
        setMessage({ type: 'success', text: 'New reward catalog item created successfully!' });
        setShowAddRewardModal(false);
        setNewReward({ title: '', description: '', points_cost: 100, stock_quantity: 10 });
        await fetchRewardsData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to create reward.' });
    } finally {
      setRewardSubmitting(false);
    }
  };

  const handleUpdateRedemption = async (id, status) => {
    try {
      const res = await updateRedemptionStatus(id, status);
      if (res.success) {
        setMessage({ type: 'success', text: `Redemption marked as ${status}.` });
        await fetchRewardsData();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to update redemption status.' });
    }
  };

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser.' });
      return;
    }

    setLocating(true);
    setMessage(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lon = pos.coords.longitude.toFixed(6);
        setPolicies((prev) => ({
          ...prev,
          workplace_latitude: lat,
          workplace_longitude: lon,
        }));
        setLocating(false);
        setMessage({
          type: 'success',
          text: `Acquired current device location: Lat ${lat}, Lon ${lon}. Click "Save All Settings" to store in DB.`,
        });
      },
      (err) => {
        setLocating(false);
        setMessage({ type: 'error', text: `Location permission error: ${err.message}` });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
        <p className="text-sm font-medium text-slate-500">Loading attendance policy configuration...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Attendance & Security Settings
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configure workplace geofencing, QR rotation policies, and attendance business rules.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={saveAllLoading}
          className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
        >
          {saveAllLoading ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span>Save All Settings</span>
        </button>
      </div>

      {/* Alert Notification Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {message.type === 'success' ? (
              <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Group 1: Workplace GPS Geofencing */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <span>Workplace GPS Geofence</span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-md">Authoritative</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set the exact office coordinates and allowed radius in meters. Check-ins outside this radius are rejected.
            </p>
          </div>

          <button
            onClick={handleGetCurrentLocation}
            disabled={locating}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <svg className={`w-3.5 h-3.5 ${locating ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{locating ? 'Locating...' : 'Use Current Device Location'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Workplace Latitude
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="e.g. 28.613939"
                value={policies.workplace_latitude || ''}
                onChange={(e) => handleChange('workplace_latitude', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleSaveSingle('workplace_latitude')}
                disabled={savingKey === 'workplace_latitude'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Workplace Longitude
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="e.g. 77.209021"
                value={policies.workplace_longitude || ''}
                onChange={(e) => handleChange('workplace_longitude', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleSaveSingle('workplace_longitude')}
                disabled={savingKey === 'workplace_longitude'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Allowed Radius (Meters)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                min="1"
                placeholder="100"
                value={policies.workplace_radius_meters || '100'}
                onChange={(e) => handleChange('workplace_radius_meters', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleSaveSingle('workplace_radius_meters')}
                disabled={savingKey === 'workplace_radius_meters'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Group 2: Dynamic QR Security */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Dynamic Rotating QR Security</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure how frequently office QR challenges automatically expire and rotate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              QR Validity Duration (Seconds)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                min="5"
                max="600"
                value={policies.qr_validity_seconds || '30'}
                onChange={(e) => handleChange('qr_validity_seconds', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleSaveSingle('qr_validity_seconds')}
                disabled={savingKey === 'qr_validity_seconds'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Default: 30 seconds. Minimum allowed: 5 seconds.</p>
          </div>
        </div>
      </div>

      {/* Group 3: Office Attendance Business Rules */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Office Attendance Business Rules</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure working hours, office start time, and grace period rules.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Office Start Time (HH:MM:SS)
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                placeholder="09:00:00"
                value={policies.office_start_time || '09:00:00'}
                onChange={(e) => handleChange('office_start_time', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
              <button
                onClick={() => handleSaveSingle('office_start_time')}
                disabled={savingKey === 'office_start_time'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Grace Period (Minutes)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                min="0"
                value={policies.grace_period_minutes || '15'}
                onChange={(e) => handleChange('grace_period_minutes', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleSaveSingle('grace_period_minutes')}
                disabled={savingKey === 'grace_period_minutes'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Min Working Hours (Checkout)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                min="0"
                value={policies.minimum_checkout_hours || '4'}
                onChange={(e) => handleChange('minimum_checkout_hours', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleSaveSingle('minimum_checkout_hours')}
                disabled={savingKey === 'minimum_checkout_hours'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Group 4: Temporary Exit & Automation Policies */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800">Temporary Exit & EOD Automation</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure system automation features and exit allowances.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Temporary Exit Allowed
            </label>
            <div className="flex space-x-2">
              <select
                value={policies.temporary_exit_enabled || 'true'}
                onChange={(e) => handleChange('temporary_exit_enabled', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="true">Enabled (True)</option>
                <option value="false">Disabled (False)</option>
              </select>
              <button
                onClick={() => handleSaveSingle('temporary_exit_enabled')}
                disabled={savingKey === 'temporary_exit_enabled'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Monthly Exit Allowance
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                min="0"
                value={policies.monthly_exit_allowance || '2'}
                onChange={(e) => handleChange('monthly_exit_allowance', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              <button
                onClick={() => handleSaveSingle('monthly_exit_allowance')}
                disabled={savingKey === 'monthly_exit_allowance'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Auto EOD Checkout
            </label>
            <div className="flex space-x-2">
              <select
                value={policies.auto_checkout_enabled || 'false'}
                onChange={(e) => handleChange('auto_checkout_enabled', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
              >
                <option value="false">Disabled (False)</option>
                <option value="true">Enabled (True)</option>
              </select>
              <button
                onClick={() => handleSaveSingle('auto_checkout_enabled')}
                disabled={savingKey === 'auto_checkout_enabled'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Group 5: Extra Hours & Reward System Policies */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div className="pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
            <span>Extra Hours Reward System Policies</span>
            <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-md">Reward Policy</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Set standard shift hours and points multiplier per extra hour worked beyond standard duration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Standard Shift Hours (Daily)
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                min="1"
                max="24"
                placeholder="8"
                value={policies.standard_work_hours || '8'}
                onChange={(e) => handleChange('standard_work_hours', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
              <button
                onClick={() => handleSaveSingle('standard_work_hours')}
                disabled={savingKey === 'standard_work_hours'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Hours worked past this value earn extra hours points.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
              Points Per Extra Hour
            </label>
            <div className="flex space-x-2">
              <input
                type="number"
                min="0"
                placeholder="100"
                value={policies.reward_points_per_extra_hour || '100'}
                onChange={(e) => handleChange('reward_points_per_extra_hour', e.target.value)}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
              <button
                onClick={() => handleSaveSingle('reward_points_per_extra_hour')}
                disabled={savingKey === 'reward_points_per_extra_hour'}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium rounded-lg cursor-pointer"
              >
                Save
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Points automatically awarded to employee wallet on QR check-out.</p>
          </div>
        </div>
      </div>

      {/* Group 6: Rewards Catalog & Employee Redemptions Admin Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Rewards Catalog & Redemptions Manager</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage rewards offered in catalog and fulfill employee point redemptions.
            </p>
          </div>

          <button
            onClick={() => setShowAddRewardModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer shrink-0"
          >
            <span>➕</span>
            <span>Add Catalog Item</span>
          </button>
        </div>

        {/* Catalog Table */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Catalog Items</h3>
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                <tr>
                  <th className="py-2.5 px-4">Title</th>
                  <th className="py-2.5 px-4">Description</th>
                  <th className="py-2.5 px-4">Points Cost</th>
                  <th className="py-2.5 px-4">Stock</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {catalogItems.length === 0 ? (
                  <tr><td colSpan={5} className="py-4 text-center text-slate-400">No reward items created yet.</td></tr>
                ) : (
                  catalogItems.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-semibold text-slate-800">{item.title}</td>
                      <td className="py-2.5 px-4 text-slate-600 max-w-xs truncate">{item.description}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-600">{item.points_cost} pts</td>
                      <td className="py-2.5 px-4 font-mono">{item.stock_quantity}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${item.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Redemptions Management Table */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Employee Redemptions</h3>
          <div className="overflow-x-auto border border-slate-100 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-100 font-bold text-slate-400 uppercase">
                <tr>
                  <th className="py-2.5 px-4">Redemption ID</th>
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-4">Reward Item</th>
                  <th className="py-2.5 px-4">Points Spent</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {redemptions.length === 0 ? (
                  <tr><td colSpan={6} className="py-4 text-center text-slate-400">No redemptions submitted yet.</td></tr>
                ) : (
                  redemptions.map((red) => (
                    <tr key={red.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono text-slate-500">#{red.id}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {red.employee_name} <span className="text-[10px] text-slate-400">({red.employee_code})</span>
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-700">{red.reward_title}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-amber-600">{red.points_spent} pts</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          red.status === 'fulfilled' ? 'bg-emerald-100 text-emerald-800' :
                          red.status === 'cancelled' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {red.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-2">
                        {red.status === 'requested' && (
                          <>
                            <button
                              onClick={() => handleUpdateRedemption(red.id, 'fulfilled')}
                              className="px-2 py-1 bg-emerald-600 text-white rounded font-semibold text-[10px] hover:bg-emerald-700 cursor-pointer"
                            >
                              Fulfill
                            </button>
                            <button
                              onClick={() => handleUpdateRedemption(red.id, 'cancelled')}
                              className="px-2 py-1 bg-rose-600 text-white rounded font-semibold text-[10px] hover:bg-rose-700 cursor-pointer"
                            >
                              Cancel
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
      </div>

      {/* Add Reward Modal */}
      {showAddRewardModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-base">Add New Catalog Reward</h3>
              <button onClick={() => setShowAddRewardModal(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateReward} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Starbucks Gift Card"
                  value={newReward.title}
                  onChange={(e) => setNewReward((r) => ({ ...r, title: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Reward details..."
                  value={newReward.description}
                  onChange={(e) => setNewReward((r) => ({ ...r, description: e.target.value }))}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Points Cost</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newReward.points_cost}
                    onChange={(e) => setNewReward((r) => ({ ...r, points_cost: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newReward.stock_quantity}
                    onChange={(e) => setNewReward((r) => ({ ...r, stock_quantity: Number(e.target.value) }))}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddRewardModal(false)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rewardSubmitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {rewardSubmitting ? 'Creating...' : 'Create Reward'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
