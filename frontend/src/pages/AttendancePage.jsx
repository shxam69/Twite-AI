import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import QrScannerModal from '../components/QrScannerModal';
import HelpRequestModal from '../components/HelpRequestModal';
import AdminManualAttendanceModal from '../components/AdminManualAttendanceModal';
import {
  checkIn,
  checkOut,
  getAttendanceRecords,
  getAttendanceSummary,
  exportAttendanceCsv,
  getMyRewardAccount,
  getRewardsCatalog,
  redeemRewardItem,
  getPointsHistory,
  getWebAuthnRegisterOptions,
  verifyWebAuthnRegistration,
} from '../services/api';
import {
  isPlatformAuthenticatorAvailable,
  createPlatformCredential,
} from '../services/webauthnClient';


// --- Helper Functions ---

function formatTimeString(timeStr) {
  if (!timeStr) return '--';
  const todayStr = new Date().toISOString().split('T')[0];
  const d = new Date(`${todayStr}T${timeStr}`);
  if (isNaN(d.getTime())) return timeStr;
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

function formatWorkingDuration(checkInStr, checkOutStr, nowMs) {
  if (!checkInStr) return '--';

  const todayStr = new Date().toISOString().split('T')[0];
  const start = new Date(`${todayStr}T${checkInStr}`).getTime();
  const end = checkOutStr ? new Date(`${todayStr}T${checkOutStr}`).getTime() : (nowMs || Date.now());

  let diffMs = end - start;
  if (isNaN(diffMs) || diffMs < 0) diffMs = 0;

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (!checkOutStr) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${hours}h ${minutes}m`;
}

// --- Status Badge ---

function StatusBadge({ status }) {
  const norm = status?.toLowerCase();
  switch (norm) {
    case 'present':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          Present
        </span>
      );
    case 'late':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          Late
        </span>
      );
    case 'half_day':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
          Half Day
        </span>
      );
    case 'absent':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          Absent
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          Not Checked In
        </span>
      );
  }
}

// --- Verification Badge ---

function VerificationBadge({ method }) {
  const norm = method ? method.toUpperCase() : 'MANUAL';
  switch (norm) {
    case 'ADMIN':
      return (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 shadow-2xs">
          <span>🛡️</span>
          <span>ADMIN</span>
        </span>
      );
    case 'QR_WEBAUTHN':
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span>🔐</span>
          <span>QR + Passkey</span>
        </span>
      );
    case 'QR':
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
          <span>📷</span>
          <span>QR</span>
        </span>
      );
    case 'AUTO_LOCATION':
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800 border border-cyan-200">
          <span>📍</span>
          <span>Geofence</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <span>📝</span>
          <span>{norm}</span>
        </span>
      );
  }
}

// --- Interactive Month Calendar Component ---
function AttendanceCalendarView({ records, currentYear, currentMonth, onMonthChange }) {
  const [selectedDayRecords, setSelectedDayRecords] = useState(null);

  // Month navigation helpers
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

  // Map records by YYYY-MM-DD
  const recordMap = {};
  records.forEach((r) => {
    const dStr = r.attendance_date;
    if (!recordMap[dStr]) recordMap[dStr] = [];
    recordMap[dStr].push(r);
  });

  const prevMonth = () => {
    if (currentMonth === 0) {
      onMonthChange(currentYear - 1, 11);
    } else {
      onMonthChange(currentYear, currentMonth - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      onMonthChange(currentYear + 1, 0);
    } else {
      onMonthChange(currentYear, currentMonth + 1);
    }
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header Controls */}
      <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-200">
        <button
          onClick={prevMonth}
          className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          &larr; Prev Month
        </button>
        <span className="text-base font-bold text-slate-800">
          {monthNames[currentMonth]} {currentYear}
        </span>
        <button
          onClick={nextMonth}
          className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
        >
          Next Month &rarr;
        </button>
      </div>

      {/* Grid Header (Sun - Sat) */}
      <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 uppercase tracking-wider">
        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
      </div>

      {/* Grid Days */}
      <div className="grid grid-cols-7 gap-1.5">
        {/* Blank cells for offset */}
        {[...Array(firstDayOfWeek)].map((_, i) => (
          <div key={`blank-${i}`} className="h-20 bg-slate-50/50 rounded-lg border border-dashed border-slate-100" />
        ))}

        {/* Days of month */}
        {[...Array(daysInMonth)].map((_, i) => {
          const dayNum = i + 1;
          const monthStr = String(currentMonth + 1).padStart(2, '0');
          const dayStr = String(dayNum).padStart(2, '0');
          const dateKey = `${currentYear}-${monthStr}-${dayStr}`;
          const dayRecs = recordMap[dateKey] || [];

          return (
            <div
              key={dateKey}
              onClick={() => dayRecs.length > 0 && setSelectedDayRecords({ date: dateKey, records: dayRecs })}
              className={`h-24 p-2 rounded-lg border flex flex-col justify-between transition-all ${
                dayRecs.length > 0
                  ? 'bg-white border-blue-200 shadow-2xs hover:border-blue-400 hover:shadow-xs cursor-pointer'
                  : 'bg-white/60 border-slate-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{dayNum}</span>
                {dayRecs.length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                )}
              </div>

              {dayRecs.length > 0 && (
                <div className="space-y-1 overflow-hidden">
                  <StatusBadge status={dayRecs[0].status} />
                  <span className="text-[10px] text-slate-400 block truncate">
                    {dayRecs[0].employee_name || dayRecs[0].check_in}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Day Details Modal */}
      {selectedDayRecords && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                Attendance Details: {selectedDayRecords.date}
              </h3>
              <button
                onClick={() => setSelectedDayRecords(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {selectedDayRecords.records.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span>{r.employee_name || 'Employee'} ({r.employee_code || r.employee_id})</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="flex justify-between text-slate-600 pt-1">
                    <span>In: {r.check_in || '--'}</span>
                    <span>Out: {r.check_out || '--'}</span>
                  </div>
                  {r.remarks && (
                    <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-200/60">
                      Remark: {r.remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedDayRecords(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Attendance Page ---

export default function AttendancePage() {
  const { user } = useAuth();
  const isEmployee = user?.role === 'employee';
  const isAdmin = user?.role === 'admin';
  const hasLinkedProfile = Boolean(user?.employee_id);

  // View Mode: 'table' or 'calendar'
  const [viewMode, setViewMode] = useState('table');
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  // Live clock state (updated every 1s)
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Today's record state
  const [todayRecord, setTodayRecord] = useState(null);
  const [todayLoading, setTodayLoading] = useState(true);

  // Summary state
  const [summary, setSummary] = useState(null);

  // History / Records Table state
  const [records, setRecords] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ start_date: '', end_date: '', status: '' });
  const [tableLoading, setTableLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // QR Scanner & Help Request & Rewards Modal States
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrPurpose, setQrPurpose] = useState('CHECK_IN');
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [rewardModalOpen, setRewardModalOpen] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Rewards State
  const [rewardAccount, setRewardAccount] = useState(null);
  const [rewardsCatalog, setRewardsCatalog] = useState([]);
  const [redeemLoadingId, setRedeemLoadingId] = useState(null);
  const [pointsHistory, setPointsHistory] = useState(null);
  const [historyDays, setHistoryDays] = useState(7);
  const [hasAuthenticator, setHasAuthenticator] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);

  // Check platform authenticator
  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setHasAuthenticator);
  }, []);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Clear feedback after 6 seconds
  const showFeedback = (type, message) => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback({ type: '', message: '' });
    }, 6000);
  };

  const todayStr = now.toISOString().split('T')[0];

  const fetchRewardAccount = useCallback(async () => {
    if (!isEmployee) return;
    try {
      const res = await getMyRewardAccount();
      if (res.success) {
        setRewardAccount(res.data);
      }
    } catch (err) {
      console.error('Error fetching reward account:', err);
    }
  }, [isEmployee]);

  const fetchPointsHistory = useCallback(async (days = historyDays) => {
    if (!isEmployee) return;
    try {
      const res = await getPointsHistory({ days });
      if (res.success) {
        setPointsHistory(res.data);
      }
    } catch (err) {
      console.error('Error fetching points history:', err);
    }
  }, [isEmployee, historyDays]);

  const handleEnrollDevice = async () => {
    setEnrollLoading(true);
    try {
      const optRes = await getWebAuthnRegisterOptions();
      if (!optRes.success || !optRes.data) {
        throw new Error('Failed to obtain registration options.');
      }

      const { sessionKey, ...creationOptions } = optRes.data;
      const credentialResponse = await createPlatformCredential(creationOptions);

      const verifyRes = await verifyWebAuthnRegistration({
        sessionKey,
        credentialResponse,
      });

      if (verifyRes.success) {
        showFeedback('success', 'Device platform passkey enrolled successfully! Biometric/PIN verification will now be used during QR check-in.');
      }
    } catch (err) {
      if (err.message === 'WEBAUTHN_CANCELLED') {
        showFeedback('error', 'Device passkey enrollment was cancelled.');
      } else {
        showFeedback('error', err.message || 'Passkey enrollment failed.');
      }
    } finally {
      setEnrollLoading(false);
    }
  };

  const openRewardsCatalog = async () => {
    setRewardModalOpen(true);
    try {
      const res = await getRewardsCatalog(false);
      if (res.success) {
        setRewardsCatalog(res.data || []);
      }
    } catch (err) {
      showFeedback('error', 'Failed to load rewards catalog.');
    }
  };

  const handleRedeem = async (rewardId) => {
    setRedeemLoadingId(rewardId);
    try {
      const res = await redeemRewardItem(rewardId);
      showFeedback('success', res.message || 'Reward redeemed successfully!');
      await fetchRewardAccount();
      const updatedCatalog = await getRewardsCatalog(false);
      setRewardsCatalog(updatedCatalog.data || []);
    } catch (err) {
      showFeedback('error', err.message || 'Failed to redeem reward.');
    } finally {
      setRedeemLoadingId(null);
    }
  };

  // Fetch today's record for employee
  const fetchTodayRecord = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await getAttendanceRecords({ start_date: todayStr, end_date: todayStr, limit: 1 });
      const rec = res.data && res.data.length > 0 ? res.data[0] : null;
      setTodayRecord(rec);
    } catch (err) {
      console.error('Error fetching today record:', err);
    } finally {
      setTodayLoading(false);
    }
  }, [todayStr]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const res = await getAttendanceSummary();
      setSummary(res.data);
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, []);

  // Fetch history table records
  const fetchHistory = useCallback(async (page = 1, filterState = filters) => {
    setTableLoading(true);
    try {
      const params = {
        page,
        limit: viewMode === 'calendar' ? 100 : 10,
        ...filterState,
      };
      const res = await getAttendanceRecords(params);
      setRecords(res.data || []);
      setPagination(res.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setTableLoading(false);
    }
  }, [filters, viewMode]);

  // Initial load
  useEffect(() => {
    fetchTodayRecord();
    fetchSummary();
    fetchHistory(1, filters);
    if (isEmployee) {
      fetchRewardAccount();
      fetchPointsHistory(historyDays);
    }
  }, [fetchTodayRecord, fetchSummary, fetchHistory, fetchRewardAccount, fetchPointsHistory, filters, isEmployee, historyDays]);


  // Handle Check In
  const handleCheckInAction = async () => {
    if (!hasLinkedProfile && isEmployee) return;
    setActionLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await checkIn();
      showFeedback('success', res.message || 'Check-in recorded successfully.');
      await fetchTodayRecord();
      await fetchSummary();
      await fetchHistory(1, filters);
      await fetchRewardAccount();
    } catch (err) {
      showFeedback('error', err.message || 'Check-in failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Check Out
  const handleCheckOutAction = async () => {
    if (!hasLinkedProfile && isEmployee) return;
    setActionLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const res = await checkOut();
      showFeedback('success', res.message || 'Check-out recorded successfully.');
      await fetchTodayRecord();
      await fetchSummary();
      await fetchHistory(1, filters);
      await fetchRewardAccount();
    } catch (err) {
      showFeedback('error', err.message || 'Check-out failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleQrSuccess = async (message) => {
    showFeedback('success', message);
    await fetchTodayRecord();
    await fetchSummary();
    await fetchHistory(1, filters);
    await fetchRewardAccount();
  };

  // Handle CSV Export
  const handleExportCsv = async () => {
    try {
      setExporting(true);
      const blobData = await exportAttendanceCsv(filters);
      const url = window.URL.createObjectURL(new Blob([blobData]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `attendance_report_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      showFeedback('success', 'Attendance CSV report downloaded successfully!');
    } catch (err) {
      showFeedback('error', 'Failed to export CSV report: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // State calculations for today's card
  const isCheckedIn = Boolean(todayRecord && todayRecord.check_in && !todayRecord.check_out);
  const isCheckedOut = Boolean(todayRecord && todayRecord.check_in && todayRecord.check_out);
  const isNotCheckedIn = !todayRecord || !todayRecord.check_in;

  const currentDuration = todayRecord
    ? formatWorkingDuration(todayRecord.check_in, todayRecord.check_out, now.getTime())
    : '--';

  const dateFormatted = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const timeFormatted = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <div className="space-y-6">
      {/* Modals for Employee */}
      {isEmployee && (
        <>
          <QrScannerModal
            isOpen={qrModalOpen}
            onClose={() => setQrModalOpen(false)}
            onSuccess={handleQrSuccess}
            purpose={qrPurpose}
          />
          <HelpRequestModal
            isOpen={helpModalOpen}
            onClose={() => setHelpModalOpen(false)}
          />
        </>
      )}

      {/* Admin Manual Attendance Override Modal */}
      {isAdmin && (
        <AdminManualAttendanceModal
          isOpen={adminModalOpen}
          onClose={() => {
            setAdminModalOpen(false);
            setEditingRecord(null);
          }}
          onSuccess={(msg) => {
            showFeedback('success', msg);
            fetchHistory(pagination.page, filters);
            fetchSummary();
          }}
          recordToEdit={editingRecord}
        />
      )}

      {/* Header & Live Clock */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isAdmin ? 'Attendance Overview' : 'My Attendance'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{dateFormatted}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Admin Mark Attendance Override Button */}
          {isAdmin && (
            <button
              onClick={() => {
                setEditingRecord(null);
                setAdminModalOpen(true);
              }}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <span>🛡️</span>
              <span>Mark Attendance</span>
            </button>
          )}

          <div className="text-right">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Live Clock</span>
            <span className="text-xl font-mono font-bold text-blue-600">{timeFormatted}</span>
          </div>
          <button
            onClick={() => {
              fetchTodayRecord();
              fetchSummary();
              fetchHistory(pagination.page, filters);
            }}
            className="p-2 text-slate-500 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Refresh Data"
          >
            &#8635;
          </button>
        </div>
      </div>

      {/* Unlinked Employee Profile Warning Banner */}
      {isEmployee && !hasLinkedProfile && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-4 flex items-start gap-3 text-sm">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold">Account Not Linked</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Your account is not linked to an employee profile. Check In and Check Out actions are disabled.
              Please contact your system administrator.
            </p>
          </div>
        </div>
      )}

      {/* Feedback Banner */}
      {feedback.message && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <span>{feedback.type === 'success' ? '✅' : '❌'}</span>
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback({ type: '', message: '' })}
            className="text-xs font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Employee Today's Attendance Card */}
      {isEmployee && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-800">Today's Attendance Status</h2>
              <p className="text-xs text-slate-400 mt-0.5">Server time records attendance status</p>
            </div>
            {todayLoading ? (
              <span className="text-xs text-slate-400 animate-pulse">Loading status...</span>
            ) : (
              <StatusBadge status={todayRecord?.status} />
            )}
          </div>

          {/* Time & Duration Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Check-In Time</span>
              <span className="text-lg font-bold text-slate-700 mt-1 block">
                {formatTimeString(todayRecord?.check_in)}
              </span>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider block">Check-Out Time</span>
              <span className="text-lg font-bold text-slate-700 mt-1 block">
                {formatTimeString(todayRecord?.check_out)}
              </span>
            </div>

            <div className="bg-blue-50/50 rounded-lg p-4 border border-blue-100">
              <span className="text-xs font-medium text-blue-500 uppercase tracking-wider block">Working Duration</span>
              <span className="text-lg font-bold text-blue-700 mt-1 block font-mono">
                {currentDuration}
              </span>
            </div>
          </div>

          {/* Primary Action: QR Code Check-In */}
          {isNotCheckedIn && hasLinkedProfile && (
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-200 block">Dynamic QR Verification</span>
                <p className="text-base font-bold">Check In with Dynamic Rotating QR Code</p>
                <p className="text-xs text-blue-100">Scans office Check-In QR code & verifies workplace GPS geofence.</p>
              </div>

              <button
                onClick={() => {
                  setQrPurpose('CHECK_IN');
                  setQrModalOpen(true);
                }}
                className="px-5 py-2.5 bg-white text-blue-700 hover:bg-blue-50 font-bold text-sm rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
              >
                <span>📷</span>
                <span>Scan QR & Check In</span>
              </button>
            </div>
          )}

          {/* Primary Action: QR Code Check-Out */}
          {isCheckedIn && hasLinkedProfile && (
            <div className="p-4 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200 block">Dynamic QR Verification & Rewards</span>
                <p className="text-base font-bold">Check Out with Dynamic Check-Out QR Code</p>
                <p className="text-xs text-emerald-100">Verifies location geofence & automatically awards extra hours reward points.</p>
              </div>

              <button
                onClick={() => {
                  setQrPurpose('CHECK_OUT');
                  setQrModalOpen(true);
                }}
                className="px-5 py-2.5 bg-white text-emerald-800 hover:bg-emerald-50 font-bold text-sm rounded-lg shadow-sm transition-all flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
              >
                <span>📷</span>
                <span>Scan QR & Check Out</span>
              </button>
            </div>
          )}

          {/* Shift Complete Status */}
          {isCheckedOut && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Shift Completed</span>
              <p className="text-sm font-bold text-slate-700 mt-0.5">You have checked out for today. See you tomorrow!</p>
            </div>
          )}

          {/* Help Support Request Link */}
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => setHelpModalOpen(true)}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <span>💬</span>
              <span>Need Help / Having Issues?</span>
            </button>
          </div>
        </div>
      )}

      {/* Employee Rewards, Points Wallet & Device Passkey Hub */}
      {isEmployee && (
        <div className="space-y-4">
          {/* Main Wallet Banner */}
          <div className="bg-gradient-to-br from-amber-50 via-amber-100/40 to-orange-50 border border-amber-200/80 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-2xl font-bold shadow-sm shrink-0">
                🪙
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-slate-800 text-base">Extra Hours Reward Wallet</h3>
                  <span className="bg-amber-200/80 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                    Active
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Earn points automatically for every verified extra hour worked beyond standard shift duration.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <div className="text-right border-r border-amber-200 pr-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">Available Balance</span>
                <span className="text-2xl font-extrabold text-amber-600 font-mono">
                  {rewardAccount?.points_balance ?? 0} <span className="text-xs font-semibold text-amber-700">pts</span>
                </span>
              </div>
              <div className="text-right border-r border-amber-200 pr-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Earned</span>
                <span className="text-base font-bold text-slate-700 font-mono">
                  {rewardAccount?.total_earned ?? 0} pts
                </span>
              </div>

              <button
                onClick={openRewardsCatalog}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span>🎁</span>
                <span>Redeem Rewards</span>
              </button>
            </div>
          </div>

          {/* Grid: Weekly Points Chart (Real DB Data) + Device Authenticator Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Real Data Points Chart (7 / 30 / 90 Days) */}
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                    <span>Points History Chart</span>
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold">Real DB Data</span>
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Points earned per individual calendar day (including zero-point days)
                  </p>
                </div>

                <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                  {[7, 30, 90].map((d) => (
                    <button
                      key={d}
                      onClick={() => {
                        setHistoryDays(d);
                        fetchPointsHistory(d);
                      }}
                      className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                        historyDays === d
                          ? 'bg-white text-blue-600 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {d} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* Total for period */}
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 text-xs">
                <span className="text-slate-600 font-medium">Points earned in selected {historyDays}-day window:</span>
                <span className="font-mono font-bold text-blue-600 text-sm">
                  {pointsHistory?.total_period_earned ?? 0} pts
                </span>
              </div>

              {/* Chart Bars */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {!pointsHistory?.history || pointsHistory.history.length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No points earned in this period.</p>
                ) : (
                  pointsHistory.history.map((item) => {
                    const maxPts = Math.max(...pointsHistory.history.map((h) => h.points), 100);
                    const pct = Math.min(100, Math.round((item.points / maxPts) * 100));
                    return (
                      <div key={item.date} className="flex items-center space-x-3 text-xs">
                        <span className="w-24 text-slate-600 font-medium shrink-0 truncate">
                          {item.day_name.slice(0, 3)} <span className="text-[10px] text-slate-400">{item.date.slice(5)}</span>
                        </span>
                        <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              item.points > 0 ? 'bg-amber-500' : 'bg-transparent'
                            }`}
                            style={{ width: `${item.points > 0 ? Math.max(pct, 5) : 0}%` }}
                          ></div>
                        </div>
                        <span className="w-16 text-right font-mono font-bold text-slate-700 shrink-0">
                          {item.points} pts
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Device Authenticator (WebAuthn) Card */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-3 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h4 className="text-sm font-bold text-slate-800">🔐 Device Passkey</h4>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    hasAuthenticator ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {hasAuthenticator ? 'Supported' : 'Unavailable'}
                  </span>
                </div>

                <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                  WebAuthn enables biometric login (Touch ID, Windows Hello, Face ID, Android Biometrics, or device PIN). No raw biometric data is ever stored on servers.
                </p>

                <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Platform Sensor:</span>
                    <span className="font-bold text-slate-800">
                      {hasAuthenticator ? '✅ Available' : '❌ Not Detected'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Attendance Rule:</span>
                    <span className="text-[10px] font-mono text-blue-600">
                      {hasAuthenticator ? 'Passkey + QR + GPS' : 'QR + GPS (Bypass)'}
                    </span>
                  </div>
                </div>
              </div>

              {hasAuthenticator && (
                <button
                  onClick={handleEnrollDevice}
                  disabled={enrollLoading}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer flex items-center justify-center space-x-1.5 disabled:opacity-50"
                >
                  <span>🔑</span>
                  <span>{enrollLoading ? 'Enrolling...' : 'Enroll This Device Passkey'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Rewards Catalog Redemption Modal */}
      {rewardModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-lg">
                  🎁
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Employee Rewards Catalog</h3>
                  <p className="text-xs text-slate-500">Your Balance: <strong className="text-amber-600">{rewardAccount?.points_balance ?? 0} pts</strong></p>
                </div>
              </div>
              <button onClick={() => setRewardModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {rewardsCatalog.length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No rewards currently available in catalog.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {rewardsCatalog.map((item) => {
                    const canAfford = (rewardAccount?.points_balance ?? 0) >= item.points_cost;
                    const hasStock = item.stock_quantity > 0;
                    const isLoadingThis = redeemLoadingId === item.id;
                    return (
                      <div key={item.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-2 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between">
                            <h4 className="font-bold text-slate-800 text-sm">{item.title}</h4>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              {item.points_cost} pts
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{item.description}</p>
                        </div>

                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[11px] text-slate-400 font-medium">
                            Stock: {item.stock_quantity} left
                          </span>

                          <button
                            onClick={() => handleRedeem(item.id)}
                            disabled={!canAfford || !hasStock || isLoadingThis}
                            className={`px-3 py-1.5 rounded-lg font-semibold text-xs transition-all ${
                              canAfford && hasStock && !isLoadingThis
                                ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-2xs'
                                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                            }`}
                          >
                            {isLoadingThis ? 'Redeeming...' : !hasStock ? 'Out of Stock' : !canAfford ? 'Need More Points' : 'Redeem Now'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setRewardModalOpen(false)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                Close Catalog
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal Summary Cards */}
      {isEmployee && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-2xs">
            <span className="text-xs text-slate-400 font-medium block">Total Days</span>
            <span className="text-2xl font-bold text-slate-800 mt-1 block">{summary?.total_records ?? 0}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-2xs border-l-4 border-l-emerald-500">
            <span className="text-xs text-slate-400 font-medium block">Present</span>
            <span className="text-2xl font-bold text-emerald-600 mt-1 block">{summary?.present_count ?? 0}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-2xs border-l-4 border-l-amber-500">
            <span className="text-xs text-slate-400 font-medium block">Late</span>
            <span className="text-2xl font-bold text-amber-600 mt-1 block">{summary?.late_count ?? 0}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-2xs border-l-4 border-l-indigo-500">
            <span className="text-xs text-slate-400 font-medium block">Half Day</span>
            <span className="text-2xl font-bold text-indigo-600 mt-1 block">{summary?.half_day_count ?? 0}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-2xs border-l-4 border-l-rose-500">
            <span className="text-xs text-slate-400 font-medium block">Absent</span>
            <span className="text-2xl font-bold text-rose-600 mt-1 block">{summary?.absent_count ?? 0}</span>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 text-center shadow-2xs border-l-4 border-l-purple-500">
            <span className="text-xs text-slate-400 font-medium block">Attendance %</span>
            <span className="text-2xl font-bold text-purple-600 mt-1 block">{summary?.attendance_percentage ?? 0}%</span>
          </div>
        </div>
      )}

      {/* Attendance Records Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-bold text-slate-800">
              {isAdmin ? 'All Employee Attendance Records' : 'My Attendance History'}
            </h2>

            {/* View Mode Toggle Button */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'table' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                📋 Table
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  viewMode === 'calendar' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                📅 Calendar
              </button>
            </div>
          </div>

          {/* Filters & Admin CSV Export Button */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
              placeholder="Start Date"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
              placeholder="End Date"
            />
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700"
            >
              <option value="">All Statuses</option>
              <option value="present">Present</option>
              <option value="late">Late</option>
              <option value="half_day">Half Day</option>
              <option value="absent">Absent</option>
            </select>
            {(filters.start_date || filters.end_date || filters.status) && (
              <button
                onClick={() => setFilters({ start_date: '', end_date: '', status: '' })}
                className="text-xs text-blue-600 hover:underline px-2 py-1 cursor-pointer"
              >
                Clear
              </button>
            )}

            {/* Admin Export CSV Button */}
            {isAdmin && (
              <button
                onClick={handleExportCsv}
                disabled={exporting}
                className="ml-auto flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                <span>📥</span>
                <span>{exporting ? 'Exporting...' : 'Export Report (CSV)'}</span>
              </button>
            )}
          </div>
        </div>

        {/* View Mode Content: Calendar vs Table */}
        {viewMode === 'calendar' ? (
          <AttendanceCalendarView
            records={records}
            currentYear={calendarYear}
            currentMonth={calendarMonth}
            onMonthChange={(y, m) => {
              setCalendarYear(y);
              setCalendarMonth(m);
            }}
          />
        ) : (
          <>
            {/* History Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider bg-slate-50">
                    <th className="py-3 px-4">Date</th>
                    {isAdmin && <th className="py-3 px-4">Employee</th>}
                    <th className="py-3 px-4">Check In</th>
                    <th className="py-3 px-4">Check Out</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Verification</th>
                    <th className="py-3 px-4">Remarks</th>
                    {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tableLoading ? (
                    [...Array(5)].map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                        {isAdmin && <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-32" /></td>}
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                        <td className="py-3 px-4"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                        {isAdmin && <td className="py-3 px-4 text-right"><div className="h-4 bg-slate-200 rounded w-14 ml-auto" /></td>}
                      </tr>
                    ))
                  ) : records.length > 0 ? (
                    records.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 font-medium text-slate-700">{rec.attendance_date}</td>
                        {isAdmin && (
                          <td className="py-3 px-4 font-medium text-slate-800">
                            {rec.employee_name} <span className="text-xs text-slate-400">({rec.employee_code})</span>
                          </td>
                        )}
                        <td className="py-3 px-4 text-slate-600">{formatTimeString(rec.check_in)}</td>
                        <td className="py-3 px-4 text-slate-600">{formatTimeString(rec.check_out)}</td>
                        <td className="py-3 px-4">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-600">
                          {formatWorkingDuration(rec.check_in, rec.check_out)}
                        </td>
                        <td className="py-3 px-4">
                          <VerificationBadge method={rec.verification_method} />
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500 italic max-w-xs truncate" title={rec.remarks || ''}>
                          {rec.remarks || '—'}
                        </td>
                        {isAdmin && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setEditingRecord(rec);
                                setAdminModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                              title="Modify Attendance via Admin Override"
                            >
                              ✏️ Override
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 7} className="py-8 text-center text-slate-400 text-sm">
                        No attendance records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 text-xs text-slate-500">
                <span>
                  Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} records total)
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => fetchHistory(pagination.page - 1, filters)}
                    disabled={pagination.page <= 1 || tableLoading}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => fetchHistory(pagination.page + 1, filters)}
                    disabled={pagination.page >= pagination.totalPages || tableLoading}
                    className="px-3 py-1.5 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

