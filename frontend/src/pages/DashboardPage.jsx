import React, { useEffect, useState } from 'react';
import { checkHealth } from '../services/api';

export default function DashboardPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    checkHealth()
      .then((data) => {
        if (isMounted) {
          setHealth(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">System Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time metrics & core system operational status
        </p>
      </div>

      {/* Health Status Banner */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Backend API Connectivity
        </h2>
        {loading ? (
          <div className="flex items-center space-x-2 text-slate-600 text-sm">
            <div className="w-3 h-3 rounded-full bg-amber-400 animate-pulse"></div>
            <span>Checking backend health...</span>
          </div>
        ) : error ? (
          <div className="flex items-start space-x-3 text-red-600 bg-red-50 p-3 rounded-lg border border-red-200 text-sm">
            <span className="text-base">⚠️</span>
            <div>
              <p className="font-semibold">Backend Unreachable</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-xs text-slate-500">API Status</span>
              <p className="text-sm font-semibold text-emerald-600 flex items-center space-x-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                <span>{health?.status?.toUpperCase()} (Online)</span>
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-xs text-slate-500">Service</span>
              <p className="text-sm font-semibold text-slate-700 mt-0.5">
                {health?.service}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <span className="text-xs text-slate-500">Database</span>
              <p className={`text-sm font-semibold mt-0.5 ${health?.database?.connected ? 'text-emerald-600' : 'text-amber-600'}`}>
                {health?.database?.connected ? 'Connected' : 'Pending Configuration'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Placeholders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: '--', color: 'border-blue-500' },
          { label: "Today's Present", value: '--', color: 'border-emerald-500' },
          { label: "Today's Absent", value: '--', color: 'border-rose-500' },
          { label: 'Late Check-ins', value: '--', color: 'border-amber-500' },
        ].map((item, idx) => (
          <div
            key={idx}
            className={`bg-white p-5 rounded-xl border-l-4 ${item.color} border border-slate-200 shadow-sm`}
          >
            <span className="text-xs font-medium text-slate-500">{item.label}</span>
            <p className="text-2xl font-bold text-slate-800 mt-1">{item.value}</p>
            <span className="text-xs text-slate-400 mt-2 block">
              Feature module coming soon
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
