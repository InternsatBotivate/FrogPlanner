import React, { useState } from 'react';
import { AlertTriangle, Loader2, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { usePlannerStore } from '../store/plannerStore';

/**
 * DeleteAccountModal — Settings-page "Delete Account" flow.
 *
 * Two steps: a plain-language warning ('confirm'), then password
 * re-entry ('password'). Deliberately step-based so later additions (a
 * "why are you leaving?" feedback form, an export-my-data offer) drop in as
 * extra steps without reworking the flow.
 *
 * The actual deletion runs server-side — see api/delete-account.js.
 */
export default function DeleteAccountModal({ isOpen, onClose }) {
  const removeAccount = useAuthStore((state) => state.removeAccount);
  const resetPlanner = usePlannerStore((state) => state.resetStore);
  const navigate = useNavigate();

  const [step, setStep] = useState('confirm'); // 'confirm' | 'password'
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleClose = () => {
    if (deleting) return; // don't let a half-finished delete be dismissed
    setStep('confirm');
    setPassword('');
    onClose();
  };

  const handleDelete = async (e) => {
    e.preventDefault();
    if (!password) {
      toast.error('Enter your password to confirm.');
      return;
    }

    setDeleting(true);
    const res = await removeAccount(password);

    if (!res.ok) {
      setDeleting(false);
      toast.error(res.error);
      return;
    }

    // Drop the cached planner data so nothing from the deleted account can
    // linger if someone signs in again in this tab.
    resetPlanner();
    toast.success('Your account has been deleted.');
    navigate('/login', { replace: true });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-[200] p-3 animate-in fade-in duration-200">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-black text-gray-800">Delete Account</h2>
          <button
            onClick={handleClose}
            disabled={deleting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {step === 'confirm' ? (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-center gap-2 text-center py-2">
                <AlertTriangle className="text-rose-500" size={28} />
                <p className="text-sm font-bold text-gray-700">This can't be undone</p>
                <p className="text-xs text-gray-500">
                  Deleting your account permanently removes your profile, tasks, recurring
                  tasks, projects, reminders, and health log. We can't recover any of it
                  afterwards.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 uppercase tracking-wider hover:bg-gray-50 transition"
                >
                  Keep Account
                </button>
                <button
                  type="button"
                  onClick={() => setStep('password')}
                  className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-xs text-white font-bold uppercase tracking-wider transition"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleDelete} className="flex flex-col gap-3">
              <p className="text-xs text-gray-500">
                Enter your password to confirm you want to delete this account.
              </p>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                  Account Password
                </label>
                <div className="relative">
                  <Lock className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep('confirm')}
                  disabled={deleting}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 uppercase tracking-wider hover:bg-gray-50 transition disabled:opacity-60"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={deleting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-xs text-white font-bold uppercase tracking-wider transition disabled:opacity-60"
                >
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : null}
                  {deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
