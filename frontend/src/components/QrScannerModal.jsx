import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  checkInWithQr,
  checkOutWithQr,
  getWebAuthnAuthOptions,
  verifyWebAuthnAuthentication,
  logWebAuthnStatus,
} from '../services/api';
import {
  isPlatformAuthenticatorAvailable,
  getPlatformAssertion,
} from '../services/webauthnClient';

export default function QrScannerModal({ isOpen, onClose, onSuccess, purpose = 'CHECK_IN' }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [gpsStatus, setGpsStatus] = useState('Acquiring GPS...');
  const [currentCoords, setCurrentCoords] = useState(null);
  const [authenticatorStatus, setAuthenticatorStatus] = useState('Checking device authenticator...');
  const [hasAuthenticator, setHasAuthenticator] = useState(false);

  const html5QrcodeRef = useRef(null);
  const isScanningRef = useRef(false);

  // Check WebAuthn platform authenticator availability
  useEffect(() => {
    async function checkAuth() {
      const available = await isPlatformAuthenticatorAvailable();
      setHasAuthenticator(available);
      if (available) {
        setAuthenticatorStatus('Platform Authenticator Available (Biometric / Passkey / PIN)');
      } else {
        setAuthenticatorStatus('No suitable platform authenticator available (WebAuthn will be skipped)');
      }
    }
    checkAuth();
  }, []);

  // Acquire current GPS location
  const acquireLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('Geolocation not supported by browser.');
      return;
    }
    setGpsStatus('Acquiring GPS location...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setCurrentCoords({ latitude: lat, longitude: lon });
        setManualLat(lat.toFixed(6));
        setManualLon(lon.toFixed(6));
        setGpsStatus(`GPS Acquired: ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
      },
      (err) => {
        setGpsStatus(`GPS Error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      acquireLocation();
    } else {
      stopScanner();
    }
  }, [isOpen]);

  // Start html5-qrcode camera scanner
  useEffect(() => {
    if (isOpen && !manualMode) {
      const qrRegionId = 'html5qr-code-full-region';
      const timer = setTimeout(() => {
        startScanner(qrRegionId);
      }, 100);
      return () => {
        clearTimeout(timer);
        stopScanner();
      };
    } else {
      stopScanner();
    }
  }, [isOpen, manualMode]);

  const startScanner = async (regionId) => {
    try {
      if (html5QrcodeRef.current && isScanningRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(regionId);
      html5QrcodeRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 250, height: 250 } };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScannedToken(decodedText);
        },
        () => {
          // ignore frame decode errors
        }
      );
      isScanningRef.current = true;
    } catch (err) {
      setError('Unable to access camera. Please allow camera permissions or use manual code entry.');
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && isScanningRef.current) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (err) {
        // ignore stop errors
      }
      isScanningRef.current = false;
      html5QrcodeRef.current = null;
    }
  };

  /**
   * Complete attendance with QR + GPS + optional WebAuthn
   */
  const processAttendanceSubmission = async (token, latitude, longitude) => {
    // 1. Determine WebAuthn layer:
    let verificationMethod = 'QR';

    if (hasAuthenticator) {
      try {
        // Request authentication options from backend
        const optRes = await getWebAuthnAuthOptions();
        if (optRes.success && optRes.data) {
          const { sessionKey, ...authOptions } = optRes.data;
          
          // Trigger browser platform authenticator
          const assertionResponse = await getPlatformAssertion(authOptions);

          // Verify with backend
          const verifyRes = await verifyWebAuthnAuthentication({
            sessionKey,
            assertionResponse,
          });

          if (verifyRes.success) {
            verificationMethod = 'QR_WEBAUTHN';
          }
        }
      } catch (authErr) {
        if (authErr.message === 'WEBAUTHN_CANCELLED') {
          await logWebAuthnStatus({ status: 'WEBAUTHN_CANCELLED', reason: 'User cancelled biometric prompt' });
          throw new Error('Biometric / Device authentication was cancelled. Attendance cannot be submitted without completing device verification when an authenticator is present.');
        } else if (authErr.message === 'WEBAUTHN_FAILED') {
          await logWebAuthnStatus({ status: 'WEBAUTHN_FAILED', reason: 'Biometric verification failed' });
          throw new Error('Biometric / Device verification failed. Please try again.');
        } else if (authErr.message === 'WEBAUTHN_UNAVAILABLE') {
          // Device reported unavailable
          verificationMethod = 'QR';
          await logWebAuthnStatus({ status: 'WEBAUTHN_UNAVAILABLE', reason: 'No suitable platform authenticator found' });
        } else {
          // Re-throw specific errors
          throw authErr;
        }
      }
    } else {
      // No platform authenticator available -> skip WebAuthn
      verificationMethod = 'QR';
      await logWebAuthnStatus({ status: 'WEBAUTHN_UNAVAILABLE', reason: 'Platform authenticator unsupported on device' }).catch(() => {});
    }

    // 2. Submit attendance with authoritative token, GPS coordinates, and verification method
    const payload = {
      token,
      latitude,
      longitude,
      verification_method: verificationMethod,
    };

    const apiFn = purpose === 'CHECK_OUT' ? checkOutWithQr : checkInWithQr;
    const response = await apiFn(payload);

    if (response.success) {
      let msg = response.message || `${purpose === 'CHECK_OUT' ? 'Check-out' : 'Check-in'} recorded successfully via QR!`;
      if (verificationMethod === 'QR_WEBAUTHN') {
        msg += ' 🔐 (Verified with Device Passkey)';
      }
      if (purpose === 'CHECK_OUT' && response.points_awarded > 0) {
        msg += ` 🎉 Earned ${response.points_awarded} Reward Points!`;
      }
      onSuccess(msg);
      onClose();
    }
  };

  const handleScannedToken = async (rawToken) => {
    if (submitting) return;

    await stopScanner();
    setSubmitting(true);
    setError(null);

    try {
      let lat = currentCoords?.latitude;
      let lon = currentCoords?.longitude;

      if (lat === undefined || lon === undefined) {
        await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve();
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              lat = pos.coords.latitude;
              lon = pos.coords.longitude;
              resolve();
            },
            () => resolve(),
            { timeout: 3000 }
          );
        });
      }

      await processAttendanceSubmission(rawToken, lat, lon);
    } catch (err) {
      setError(err.message || `QR ${purpose === 'CHECK_OUT' ? 'Check-out' : 'Check-in'} failed.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!manualToken.trim()) {
      setError('Please enter a valid QR token.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const lat = manualLat ? Number(manualLat) : currentCoords?.latitude;
      const lon = manualLon ? Number(manualLon) : currentCoords?.longitude;

      await processAttendanceSubmission(manualToken.trim(), lat, lon);
    } catch (err) {
      setError(err.message || `QR ${purpose === 'CHECK_OUT' ? 'Check-out' : 'Check-in'} failed.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;


  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <h3 className="font-bold text-slate-800 text-base">
              QR Code {purpose === 'CHECK_OUT' ? 'Check-Out' : 'Check-In'} Scanner
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-header Mode Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-semibold">
          <button
            onClick={() => setManualMode(false)}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
              !manualMode
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            📷 Camera Scanner
          </button>
          <button
            onClick={() => setManualMode(true)}
            className={`flex-1 py-2.5 text-center transition-colors border-b-2 ${
              manualMode
                ? 'border-blue-600 text-blue-700 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            ⌨️ Manual Code Entry (Dev/Testing)
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* GPS Status Indicator */}
          <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600">
            <span className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${currentCoords ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`}></span>
              <span>{gpsStatus}</span>
            </span>
            <button onClick={acquireLocation} className="text-blue-600 font-semibold hover:underline cursor-pointer">
              Retry GPS
            </button>
          </div>

          {/* WebAuthn Platform Authenticator Indicator */}
          <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-600">
            <span className="flex items-center space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${hasAuthenticator ? 'bg-indigo-500' : 'bg-slate-400'}`}></span>
              <span>{authenticatorStatus}</span>
            </span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
              {hasAuthenticator ? 'BIOMETRIC / PASSKEY' : 'BYPASS ACTIVE'}
            </span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start space-x-2">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{error}</p>
              </div>
            </div>
          )}

          {/* Camera Scanner View */}
          {!manualMode ? (
            <div className="space-y-3 text-center">
              <div
                id="html5qr-code-full-region"
                className="w-full h-64 bg-slate-900 rounded-xl overflow-hidden shadow-inner flex items-center justify-center"
              ></div>
              <p className="text-xs text-slate-500">
                Point your phone camera at the active QR code displayed on the Admin laptop.
              </p>
            </div>
          ) : (
            /* Manual Input Fallback Form */
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                  Raw QR Token / Code
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Paste 64-character hex QR token..."
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Latitude (Optional override)
                  </label>
                  <input
                    type="text"
                    placeholder="28.6139"
                    value={manualLat}
                    onChange={(e) => setManualLat(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1">
                    Longitude (Optional override)
                  </label>
                  <input
                    type="text"
                    placeholder="77.2090"
                    value={manualLon}
                    onChange={(e) => setManualLon(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-xl shadow-sm transition-all disabled:opacity-50"
              >
                {submitting ? 'Verifying Attendance...' : 'Submit QR Code Check-In'}
              </button>
            </form>
          )}

          {submitting && (
            <div className="py-4 text-center space-y-2">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-blue-600 font-semibold">Validating token & GPS geofence on server...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
