import React, { useState } from 'react';
import { MailCheck, Send, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { sendVerificationEmail } from '../lib/verificationService';

/**
 * VerifyEmailBanner — shown when the signed-in user hasn't verified an email.
 * Prompts them to confirm/enter an email to enable reminders. Sends the link
 * via the backend; hides itself if the user is already verified or dismisses.
 */
export default function VerifyEmailBanner() {
  const { user } = useAuthStore();
  const [email, setEmail] = useState(user?.email || '');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [error, setError] = useState('');
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.email_verified || dismissed) return null;

  const handleSend = async () => {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setStatus('error');
      setError('Enter a valid email address.');
      return;
    }
    setStatus('sending');
    setError('');
    const result = await sendVerificationEmail(value);
    if (result.ok) {
      setStatus('sent');
    } else {
      setStatus('error');
      setError(result.error);
    }
  };

  return (
    <div className="relative bg-amber-50 border border-amber-200 rounded-2xl p-4 md:p-5 shadow-sm">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 right-3 text-amber-400 hover:text-amber-600"
        title="Dismiss"
      >
        <X size={16} />
      </button>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
          <MailCheck size={18} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-extrabold text-amber-900">Verify your email to enable reminders</h3>
          {status === 'sent' ? (
            <p className="text-xs text-amber-800 mt-1 leading-relaxed">
              Verification link sent to <span className="font-bold">{email}</span>. Check your inbox
              (and spam) and click the link. This banner disappears once verified.
            </p>
          ) : (
            <>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Confirm an email to receive weather-aware nudges and task deadline reminders.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 mt-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="flex-1 border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-amber-500"
                />
                <button
                  onClick={handleSend}
                  disabled={status === 'sending'}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold px-4 py-1.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60"
                >
                  <Send size={14} />
                  {status === 'sending' ? 'Sending…' : 'Send link'}
                </button>
              </div>
              {status === 'error' && <p className="text-xs text-red-600 mt-1.5 font-medium">{error}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
