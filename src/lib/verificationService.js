/**
 * verificationService.js — client calls to the email-verification backend.
 * The proxy holds Gmail creds server-side; we only send the session token.
 */
const SESSION_KEY = 'fp_session_token';
const SEND_URL = import.meta.env.VITE_VERIFY_SEND_URL || '/api/send-verification';

/**
 * Ask the backend to email a verification link to `email`.
 * @returns {Promise<{ ok: true } | { ok: false, error: string }>}
 */
export async function sendVerificationEmail(email) {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return { ok: false, error: 'Please sign in again.' };

  try {
    const res = await fetch(SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ email: String(email || '').trim() }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: json?.error || `Failed (${res.status}).` };
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}
