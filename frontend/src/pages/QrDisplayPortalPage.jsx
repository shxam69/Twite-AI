import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateQrCode } from '../services/api';

export default function QrDisplayPortalPage() {
  const [statusState, setStatusState] = useState('IDLE'); // 'IDLE' | 'ACTIVE' | 'EXPIRED'
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  const handleGenerateQr = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await generateQrCode();
      if (response.success && response.data) {
        setQrData(response.data);
        const duration = response.data.validity_seconds || 30;
        setTimeLeft(duration);
        setStatusState('ACTIVE');
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
    if (statusState !== 'ACTIVE') return;

    if (timeLeft <= 0) {
      setStatusState('EXPIRED');
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          setStatusState('EXPIRED');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [statusState, timeLeft]);

  const validityTotal = qrData?.validity_seconds || 30;
  const progressPercent = Math.max(0, Math.min(100, (timeLeft / validityTotal) * 100));

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between bg-slate-950 text-white rounded-3xl p-6 sm:p-10 shadow-2xl border border-slate-800 relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-6 relative z-10">
        <div className="flex items-center space-x-3 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shadow-inner">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Office Attendance Terminal</h1>
            <p className="text-xs text-slate-400">Scan QR Code using your Employee Mobile Portal</p>
          </div>
        </div>

        {/* Status Badge & Fullscreen controls */}
        <div className="flex items-center space-x-3">
          <div className={`px-3 py-1.5 rounded-full border text-xs font-semibold uppercase tracking-wider flex items-center space-x-2 ${
            statusState === 'ACTIVE'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : statusState === 'EXPIRED'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              statusState === 'ACTIVE'
                ? 'bg-emerald-400 animate-ping'
                : statusState === 'EXPIRED'
                ? 'bg-rose-400'
                : 'bg-slate-500'
            }`}></span>
            <span>{statusState === 'ACTIVE' ? 'Live Challenge' : statusState === 'EXPIRED' ? 'Expired' : 'Idle Terminal'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 transition-colors"
            title="Toggle Fullscreen"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Terminal Viewport */}
      <div className="my-auto py-8 flex flex-col items-center justify-center text-center relative z-10">
        {loading ? (
          <div className="space-y-4 py-12">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-400 text-sm font-medium animate-pulse">Generating Secure Cryptographic Token...</p>
          </div>
        ) : error ? (
          <div className="bg-rose-950/40 border border-rose-800/60 p-8 rounded-2xl max-w-md w-full space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-900/50 text-rose-400 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-rose-200 font-medium">{error}</p>
            <button
              onClick={handleGenerateQr}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition-all shadow-lg cursor-pointer"
            >
              Retry Generation
            </button>
          </div>
        ) : statusState === 'IDLE' ? (
          /* IDLE STATE */
          <div className="space-y-6 max-w-lg">
            <div className="w-24 h-24 rounded-3xl bg-blue-900/20 border border-blue-500/30 flex items-center justify-center mx-auto text-blue-400 shadow-2xl">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight">Attendance QR Code Portal</h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Click below to initialize the rotating cryptographic challenge. Once active, employees can scan the code with their mobile devices to check in.
              </p>
            </div>
            <button
              onClick={handleGenerateQr}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-lg rounded-2xl transition-all shadow-xl hover:shadow-blue-600/30 transform hover:-translate-y-0.5 cursor-pointer"
            >
              Generate QR
            </button>
          </div>
        ) : statusState === 'ACTIVE' && qrData ? (
          /* ACTIVE STATE */
          <div className="space-y-6 max-w-md w-full">
            {/* Live Countdown Header */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-inner">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Token Active</span>
              </div>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xs text-slate-400">Expires in:</span>
                <span className={`text-2xl font-black font-mono tracking-tight ${timeLeft <= 5 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                  {timeLeft}s
                </span>
              </div>
            </div>

            {/* Countdown Progress Bar */}
            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-800">
              <div
                className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                  timeLeft <= 5 ? 'bg-rose-500' : timeLeft <= 10 ? 'bg-amber-500' : 'bg-blue-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* Scannable QR Container */}
            <div className="bg-white p-7 rounded-3xl border-4 border-blue-500/20 shadow-2xl inline-block">
              <QRCodeSVG
                value={qrData.token}
                size={280}
                bgColor="#FFFFFF"
                fgColor="#0F172A"
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-300">Point your phone camera to scan</p>
              <button
                onClick={handleGenerateQr}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-all cursor-pointer"
              >
                Refresh Token Now
              </button>
            </div>
          </div>
        ) : statusState === 'EXPIRED' ? (
          /* EXPIRED STATE */
          <div className="space-y-6 max-w-md w-full">
            <div className="bg-rose-950/30 border border-rose-800/50 p-8 rounded-3xl text-center space-y-4 shadow-xl">
              <div className="w-16 h-16 rounded-2xl bg-rose-900/40 border border-rose-700/50 text-rose-400 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-rose-200">QR Challenge Expired</h3>
                <p className="text-xs text-rose-300/70 mt-1 leading-relaxed">
                  The active token has expired after its rotation window. Click below to generate a new active challenge for employees.
                </p>
              </div>
              <button
                onClick={handleGenerateQr}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-600/30 cursor-pointer"
              >
                Generate New QR
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer Instructions */}
      <div className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 relative z-10 gap-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Geofence & Replay Protection Enforced</span>
        </div>
        <span>Attendance System v1.0 • Phase 8C</span>
      </div>
    </div>
  );
}
