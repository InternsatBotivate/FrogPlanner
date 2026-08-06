/**
 * verificationService.js — client calls to the email-verification backend.
 * The proxy holds Gmail creds server-side; we only send the session token.
 */
const SESSION_KEY = 'fp_session_token';
const SEND_URL = import.meta.env.VITE_VERIFY_SEND_URL || '/api/send-verification';
const EMAILS_URL = import.meta.env.VITE_USER_EMAILS_URL || '/api/user-emails';

function authHeaders() {
  const token = localStorage.getItem(SESSION_KEY);
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : null;
}

async function emailsRequest(method, bodyObj) {
  const headers = authHeaders();
  if (!headers) return { ok: false, error: 'Please sign in again.' };
  try {
    const res = await fetch(EMAILS_URL, {
      method,
      headers,
      ...(bodyObj ? { body: JSON.stringify(bodyObj) } : {}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: json?.error || `Failed (${res.status}).` };
    return { ok: true, emails: json?.emails || [] };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

/** List the signed-in user's reminder emails. */
export const listUserEmails = () => emailsRequest('GET');
/** Add an email (unverified); follow with sendVerificationEmail to verify it. */
export const addUserEmail = (email) => emailsRequest('POST', { email: String(email || '').trim() });
/** Remove an email by id (cannot remove the last one). */
export const removeUserEmail = (id) => emailsRequest('DELETE', { id });
/** Mark an email as the primary address. */
export const setPrimaryEmail = (id) => emailsRequest('PATCH', { id });

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
