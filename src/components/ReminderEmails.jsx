import React, { useEffect, useState } from 'react';
import { Mail, Plus, Trash2, Star, BadgeCheck, Clock, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  listUserEmails,
  addUserEmail,
  removeUserEmail,
  setPrimaryEmail,
  sendVerificationEmail,
} from '../lib/verificationService';

/**
 * ReminderEmails — Settings section to manage the addresses that receive
 * FrogPlanner reminders. Add / remove / set-primary / (re)send verification.
 * Reminders (later phases) go to every VERIFIED email here.
 */
export default function ReminderEmails() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await listUserEmails();
    if (res.ok) setEmails(res.emails);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleAdd = async (e) => {
    e?.preventDefault?.();
    const value = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      toast.error('Enter a valid email address.');
      return;
    }
    setBusy(true);
    const add = await addUserEmail(value);
    if (!add.ok) {
      toast.error(add.error);
      setBusy(false);
      return;
    }
    setEmails(add.emails);
    setNewEmail('');
    const sent = await sendVerificationEmail(value);
    toast[sent.ok ? 'success' : 'error'](
      sent.ok ? `Verification link sent to ${value}.` : sent.error,
    );
    setBusy(false);
  };

  const handleResend = async (email) => {
    const sent = await sendVerificationEmail(email);
    toast[sent.ok ? 'success' : 'error'](sent.ok ? `Verification link sent to ${email}.` : sent.error);
  };

  const handleRemove = async (id) => {
    const res = await removeUserEmail(id);
    if (res.ok) setEmails(res.emails);
    else toast.error(res.error);
  };

  const handleSetPrimary = async (id) => {
    const res = await setPrimaryEmail(id);
    if (res.ok) setEmails(res.emails);
    else toast.error(res.error);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
        <Mail size={15} className="text-indigo-600" />
        <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide">Reminder Emails</h3>
      </div>
      <p className="text-[11px] text-gray-500 leading-relaxed">
        Reminders are sent to every <span className="font-semibold">verified</span> address below.
        Add work or personal emails and verify each one.
      </p>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : emails.length === 0 ? (
        <p className="text-xs text-gray-400">No emails yet. Add one below to enable reminders.</p>
      ) : (
        <ul className="space-y-2">
          {emails.map((em) => (
            <li
              key={em.id}
              className="flex items-center gap-2 border border-gray-150 rounded-lg px-3 py-2 bg-gray-50/40"
            >
              <span className="flex-1 min-w-0 truncate text-sm text-gray-800">{em.email}</span>

              {em.is_primary && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">
                  <Star size={10} /> Primary
                </span>
              )}
              {em.is_verified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-green-700 bg-green-50 border border-green-100 px-2 py-0.5 rounded-full">
                  <BadgeCheck size={10} /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                  <Clock size={10} /> Pending
                </span>
              )}

              {!em.is_verified && (
                <button
                  onClick={() => handleResend(em.email)}
                  title="Resend verification"
                  className="p-1 text-gray-400 hover:text-indigo-600"
                >
                  <Send size={14} />
                </button>
              )}
              {!em.is_primary && em.is_verified && (
                <button
                  onClick={() => handleSetPrimary(em.id)}
                  title="Make primary"
                  className="p-1 text-gray-400 hover:text-indigo-600"
                >
                  <Star size={14} />
                </button>
              )}
              {emails.length > 1 && (
                <button
                  onClick={() => handleRemove(em.id)}
                  title="Remove"
                  className="p-1 text-gray-400 hover:text-red-600"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 pt-1">
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="Add another email…"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-1.5 rounded-lg flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Plus size={14} />
          {busy ? 'Adding…' : 'Add & verify'}
        </button>
      </form>
    </div>
  );
}
