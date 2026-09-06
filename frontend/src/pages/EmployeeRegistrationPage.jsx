import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { validateInviteToken, registerEmployee } from '../services/api';

export default function EmployeeRegistrationPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [invalidError, setInvalidError] = useState(null);
  const [employeeInfo, setEmployeeInfo] = useState(null);

  // Form states
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Validate token on mount
  useEffect(() => {
    let isMounted = true;
    async function checkToken() {
      setLoading(true);
      setInvalidError(null);
      try {
        const res = await validateInviteToken(token);
        if (isMounted) {
          setEmployeeInfo(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setInvalidError(err.message || 'Invitation token is invalid or expired.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (token) {
      checkToken();
    } else {
      setInvalidError('No invitation token provided.');
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!password || password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await registerEmployee({
        token,
        password,
        confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      setFormError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-bold text-xl shadow-md mb-3">
            AMS
          </div>
          <h1 className="text-xl font-bold text-slate-800">Employee Registration</h1>
          <p className="text-xs text-slate-500 mt-1">
            Complete your account setup using your one-time invitation
          </p>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="space-y-4 py-8 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-3/4 mx-auto" />
            <div className="h-10 bg-slate-100 rounded-lg w-full" />
            <div className="h-10 bg-slate-100 rounded-lg w-full" />
            <div className="h-10 bg-blue-200 rounded-lg w-full" />
          </div>
        )}

        {/* Invalid / Expired Invitation Error */}
        {!loading && invalidError && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
              &times;
            </div>
            <h2 className="text-lg font-semibold text-slate-800 mb-1">Invitation Link Invalid</h2>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              {invalidError}
            </p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center w-full px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition-colors"
            >
              Back to Login
            </Link>
          </div>
        )}

        {/* Success State */}
        {!loading && success && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3 text-2xl">
              &#10003;
            </div>
            <h2 className="text-lg font-bold text-slate-800 mb-1">Account Created!</h2>
            <p className="text-xs text-slate-600 mb-2">
              Your employee account has been created successfully.
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 my-4">
              <span className="text-xs text-slate-400 block uppercase font-medium">Your Login Username</span>
              <span className="text-base font-mono font-bold text-blue-600">{employeeInfo?.employee_id}</span>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              Proceed to Login
            </button>
          </div>
        )}

        {/* Valid Registration Form */}
        {!loading && !invalidError && !success && employeeInfo && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Employee Info Summary Card */}
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3.5 space-y-1 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Employee ID:</span>
                <span className="font-mono font-bold text-blue-700 px-2 py-0.5 bg-blue-100 rounded-md">
                  {employeeInfo.employee_id}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Name:</span>
                <span className="font-semibold text-slate-800">{employeeInfo.name}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="text-slate-600 truncate max-w-[180px]">{employeeInfo.email}</span>
              </div>
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {formError}
              </div>
            )}

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Set Account Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors pr-16"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Confirm Password <span className="text-rose-500">*</span>
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
                className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
              />
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer mt-2"
            >
              {submitting ? 'Creating Account...' : 'Create Employee Account'}
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                Already registered? Go to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
