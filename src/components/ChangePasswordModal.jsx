import React, { useState } from 'react';
import { KeyRound, Lock, Loader2, ShieldAlert, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { sendChangePasswordOtp, verifyOtp, changePassword } from '../lib/otpService';
import { useAuthStore } from '../store/authStore';
import OtpInput from './OtpInput';

/**
 * ChangePasswordModal — Settings-page "Change Password" flow. Gated on
 * user.email_verified: unverified users are pointed at the existing
 * verify-email UI (ReminderEmails/VerifyEmailBanner) instead of a second
 * verification path being built here.
 */
export default function ChangePasswordModal({ isOpen, onClose }) {
  const user = useAuthStore((state) => state.user);

  const [step, setStep] = useState('start'); // 'start' | 'otp' | 'reset'
  const [otpId, setOtpId] = useState(null);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep('start');
    setOtpId(null);
    setCode('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSendOtp = async () => {
    setSending(true);
    const res = await sendChangePasswordOtp();
    setSending(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setOtpId(res.otpId);
    setStep('otp');
  };

  const handleResend = () => sendChangePasswordOtp().then((res) => {
    if (res.ok) setOtpId(res.otpId);
    return res;
  });

  const handleOtpConfirm = async (enteredCode) => {
    const res = await verifyOtp(otpId, enteredCode);
    if (res.ok) {
      setCode(enteredCode);
      setStep('reset');
    }
    return res;
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setSaving(true);
    const res = await changePassword(otpId, code, newPassword);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success('Password changed!');
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-[200] p-3 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-black text-gray-800">Change Password</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {!user?.email_verified ? (
            <div className="flex flex-col items-center gap-2 text-center py-4">
              <ShieldAlert className="text-amber-500" size={28} />
              <p className="text-sm font-bold text-gray-700">Verify your email first</p>
              <p className="text-xs text-gray-500">
                For your account's security, you need a verified email before changing your password.
                Add and verify one in the Reminder Emails section below, then come back here.
              </p>
            </div>
          ) : step === 'start' ? (
            <div className="flex flex-col items-center gap-2 text-center py-2">
              <KeyRound className="text-green-500" size={28} />
              <p className="text-sm text-gray-600">
                We'll email a verification code to your verified address to confirm it's you.
              </p>
              <button
                onClick={handleSendOtp}
                disabled={sending}
                className="w-full flex items-center justify-center gap-2 py-2 mt-2 bg-green-600 hover:bg-green-700 rounded-lg text-xs text-white transition font-bold uppercase tracking-wider disabled:opacity-60"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : null}
                {sending ? 'Sending…' : 'Send Code'}
              </button>
            </div>
          ) : step === 'otp' ? (
            <OtpInput onConfirm={handleOtpConfirm} onResend={handleResend} confirmLabel="Confirm" />
          ) : (
            <form onSubmit={handleReset} className="flex flex-col gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">New Password</label>
                <div className="relative">
                  <Lock className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-green-500"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Confirm Password</label>
                <div className="relative">
                  <Lock className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat password"
                    className={`w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-green-500 ${
                      confirmPassword && newPassword !== confirmPassword ? 'border-rose-300' : 'border-gray-300'
                    }`}
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[10px] text-rose-500 font-semibold">Passwords don't match</p>
                )}
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-xs text-white transition font-bold uppercase tracking-wider disabled:opacity-60"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
