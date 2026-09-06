import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateQrCode } from '../services/api';

export default function AdminQrPage() {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  const fetchNextQr = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await generateQrCode();
      if (response.success && response.data) {
        setQrData(response.data);
        setTimeLeft(response.data.validity_seconds || 30);
      } else {
        setError('Failed to generate QR challenge.');
      }
    } catch (err) {
      setError(err.message || 'Error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNextQr();
  }, []);

  useEffect(() => {
    if (timeLeft <= 0 && qrData) {
      fetchNextQr();
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [timeLeft, qrData]);

  const validityTotal = qrData?.validity_seconds || 30;
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / validityTotal) * 100));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Dynamic QR Code Generator
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Display this active QR code on the office screen for employee attendance check-in.
          </p>
        </div>

        <button
          onClick={fetchNextQr}
          disabled={loading}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-medium text-sm rounded-xl transition-all shadow-sm hover:shadow disabled:opacity-50 cursor-pointer"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh QR</span>
        </button>
      </div>

      {/* Main Display Area */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center flex flex-col items-center justify-center">
        {loading && !qrData ? (
          <div className="py-16 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-slate-500 font-medium">Generating cryptographic QR challenge...</p>
          </div>
        ) : error ? (
          <div className="py-12 space-y-4 max-w-md">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-base font-semibold text-slate-800">{error}</p>
            <button
              onClick={fetchNextQr}
              className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : qrData ? (
          <div className="space-y-6 max-w-md w-full">
            {/* Status Badge & Timer */}
            <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center space-x-2">
                <span className={`w-3 h-3 rounded-full ${timeLeft > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  {timeLeft > 0 ? 'Active QR' : 'Expired'}
                </span>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-500 font-medium block">Expires in</span>
                <span className="text-lg font-bold font-mono text-slate-900">{timeLeft}s</span>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 transition-all duration-1000 ease-linear rounded-full ${
                  progressPercent > 30 ? 'bg-blue-600' : 'bg-amber-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* QR Code Container */}
            <div className="bg-white p-6 rounded-2xl border-2 border-dashed border-slate-300 inline-block shadow-md my-4">
              <QRCodeSVG
                value={qrData.token}
                size={260}
                bgColor="#FFFFFF"
                fgColor="#0F172A"
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Info cards */}
            <div className="text-xs text-slate-500 space-y-1 bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-left">
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Challenge ID:</span>
                <span className="font-mono text-slate-800 truncate max-w-[200px]">{qrData.challenge_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Rotation Policy:</span>
                <span className="text-slate-800 font-semibold">{qrData.validity_seconds} Seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-slate-600">Geofence Verified:</span>
                <span className="text-emerald-700 font-semibold">Active</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
