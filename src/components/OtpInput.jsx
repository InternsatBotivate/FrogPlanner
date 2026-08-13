import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

const RESEND_COOLDOWN_SEC = 60;

/**
 * OtpInput — a 6-digit code entry box with a "Confirm" button and a
 * "Resend" link that respects a 60s cooldown. Used by the signup email
 * verification step and the forgot/change-password flows.
 *
 * Props:
 *   onConfirm(code) => Promise<{ ok, error }>  — called when the user submits
 *   onResend()      => Promise<{ ok, error }>  — called when Resend is clicked
 *   confirmLabel    — button text (default "Confirm")
 */
export default function OtpInput({ onConfirm, onResend, confirmLabel = 'Confirm' }) {
  const [code, setCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleConfirm = async () => {
    if (code.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setError('');
    setConfirming(true);
    const res = await onConfirm(code);
    setConfirming(false);
    if (!res.ok) setError(res.error || 'Incorrect code. Please try again.');
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    const res = await onResend();
    setResending(false);
    if (res.ok) {
      setCooldown(RESEND_COOLDOWN_SEC);
      setCode('');
    } else {
      setError(res.error || 'Could not resend the code.');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
          placeholder="6-digit code"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white tracking-[0.3em] text-center font-bold focus:outline-none focus:border-green-500"
        />
        <button
          type="button"
          onClick={handleConfirm}
          disabled={confirming}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
        >
          {confirming ? <Loader2 size={14} className="animate-spin" /> : null}
          {confirming ? 'Checking…' : confirmLabel}
        </button>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <button
        type="button"
        onClick={handleResend}
        disabled={cooldown > 0 || resending}
        className="text-xs font-semibold text-gray-500 hover:text-green-700 disabled:text-gray-400 disabled:cursor-not-allowed"
      >
        {resending ? 'Resending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
      </button>
    </div>
  );
}
