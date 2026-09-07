import React, { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateQrCode } from '../services/api';

export default function QrDisplayPortalPage() {
  const [selectedPurpose, setSelectedPurpose] = useState('CHECK_IN'); // 'CHECK_IN' | 'CHECK_OUT'
  const [statusState, setStatusState] = useState('IDLE'); // 'IDLE' | 'ACTIVE' | 'EXPIRED'
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  const handleGenerateQr = async (purposeToUse = selectedPurpose) => {
    try {
      setLoading(true);
      setError(null);
      const response = await generateQrCode(purposeToUse);
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

  const handlePurposeChange = (newPurpose) => {
    if (newPurpose === selectedPurpose && statusState === 'ACTIVE') return;
    setSelectedPurpose(newPurpose);
    handleGenerateQr(newPurpose);
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
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-950 text-white p-6 sm:p-10 relative overflow-hidden select-none">
      {/* Ambient Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-800 pb-6 relative z-10">
        <div className="flex items-center space-x-3 text-center sm:text-left">
          <div className="w-12 h-12 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold shadow-inner">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-white uppercase">OFFICE ATTENDANCE TERMINAL</h1>
            <p className="text-xs text-slate-400">Scan QR Code using your Employee Mobile Portal</p>
          </div>
        </div>

        {/* Mode Toggle & Status Badge */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {/* Mode Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex space-x-1">
            <button
              onClick={() => handlePurposeChange('CHECK_IN')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedPurpose === 'CHECK_IN'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              CHECK-IN MODE
            </button>
            <button
              onClick={() => handlePurposeChange('CHECK_OUT')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedPurpose === 'CHECK_OUT'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              CHECK-OUT MODE
            </button>
          </div>

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
            <span>{statusState === 'ACTIVE' ? `${selectedPurpose.replace('_', '-')} LIVE` : statusState === 'EXPIRED' ? 'Expired' : 'Idle Kiosk'}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-slate-300 transition-colors cursor-pointer"
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
            <p className="text-slate-400 text-sm font-medium animate-pulse">Generating Cryptographic Token...</p>
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
              onClick={() => handleGenerateQr(selectedPurpose)}
              className="px-6 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl transition-all shadow-lg cursor-pointer"
            >
              Retry Generation
            </button>
          </div>
        ) : statusState === 'IDLE' ? (
          /* IDLE STATE */
          <div className="space-y-6 max-w-lg">
            <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto border shadow-2xl ${
              selectedPurpose === 'CHECK_IN'
                ? 'bg-blue-900/20 border-blue-500/30 text-blue-400'
                : 'bg-purple-900/20 border-purple-500/30 text-purple-400'
            }`}>
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-3xl font-extrabold text-white tracking-tight uppercase">
                {selectedPurpose === 'CHECK_IN' ? 'Check-In QR Kiosk' : 'Check-Out QR Kiosk'}
              </h2>
              <p className="text-slate-400 text-sm mt-2 leading-relaxed">
                Click below to initialize the dynamic rotating {selectedPurpose.replace('_', '-')} QR code challenge.
              </p>
            </div>
            <button
              onClick={() => handleGenerateQr(selectedPurpose)}
              className={`px-8 py-4 text-white font-bold text-lg rounded-2xl transition-all shadow-xl transform hover:-translate-y-0.5 cursor-pointer ${
                selectedPurpose === 'CHECK_IN'
                  ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 shadow-blue-600/30'
                  : 'bg-purple-600 hover:bg-purple-500 active:bg-purple-700 shadow-purple-600/30'
              }`}
            >
              Start {selectedPurpose.replace('_', '-')} Challenge
            </button>
          </div>
        ) : statusState === 'ACTIVE' && qrData ? (
          /* ACTIVE STATE */
          <div className="space-y-6 max-w-md w-full">
            {/* Purpose Badge & Live Countdown */}
            <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-2xl shadow-inner">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                <span className={`text-xs font-bold uppercase tracking-widest ${selectedPurpose === 'CHECK_IN' ? 'text-blue-400' : 'text-purple-400'}`}>
                  {selectedPurpose.replace('_', '-')} QR
                </span>
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
                  timeLeft <= 5 ? 'bg-rose-500' : timeLeft <= 10 ? 'bg-amber-500' : selectedPurpose === 'CHECK_IN' ? 'bg-blue-500' : 'bg-purple-500'
                }`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>

            {/* Scannable High-Contrast Crisp QR Code */}
            <div className="bg-white p-7 rounded-3xl border-4 border-slate-800 shadow-2xl inline-block">
              {qrData?.token ? (
                <QRCodeSVG
                  value={qrData.token}
                  size={260}
                  bgColor="#FFFFFF"
                  fgColor="#000000"
                  level="H"
                  marginSize={4}
                />
              ) : null}
            </div>

            <div className="space-y-1">
              <p className="text-base font-bold text-white tracking-wide">
                {selectedPurpose === 'CHECK_IN' ? 'CHECK-IN QR CODE' : 'CHECK-OUT QR CODE'}
              </p>
              <p className="text-xs font-medium text-slate-400">Scan with your phone camera</p>
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
                  The active token has expired after its rotation window. Click below to generate a new active challenge.
                </p>
              </div>
              <button
                onClick={() => handleGenerateQr(selectedPurpose)}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-blue-600/30 cursor-pointer"
              >
                Generate New {selectedPurpose.replace('_', '-')} QR
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer Instructions */}
      <div className="border-t border-slate-800/80 pt-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 relative z-10 gap-2">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>✓ Secure Attendance Session &bull; Geofence & Replay Protection Enabled</span>
        </div>
        <span>AttendanceMS Workforce Platform</span>
      </div>
    </div>
  );
}
