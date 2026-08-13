/**
 * otpService.js — client calls to the 6-digit email-OTP backend
 * (api/send-otp.js, api/verify-otp.js, api/reset-password.js,
 * api/change-password.js). Separate from verificationService.js (the
 * existing link-based flow), since signup and forgot-password both need to
 * work WITHOUT a session token — only 'change_password' sends one.
 *
 * Every send/verify/consume call after the initial send is keyed by an
 * opaque `otpId` (the email_otps row id), NOT the email address — the
 * client never needs to know the resolved email for forgot-password
 * (it only ever supplies a username; the server resolves the verified
 * email on file and keeps it server-side).
 */
const SESSION_KEY = 'fp_session_token';
const SEND_OTP_URL = '/api/send-otp';
const VERIFY_OTP_URL = '/api/verify-otp';
const RESET_PASSWORD_URL = '/api/reset-password';
const CHANGE_PASSWORD_URL = '/api/change-password';

function authHeaders() {
  const token = localStorage.getItem(SESSION_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function post(url, bodyObj, { requireAuth = false } = {}) {
  if (requireAuth && !localStorage.getItem(SESSION_KEY)) {
    return { ok: false, error: 'Please sign in again.' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(bodyObj),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: json?.error || `Failed (${res.status}).` };
    return { ok: true, ...json };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
  }
}

/** Send a signup-verification OTP to `email` (no account/session yet). Returns { ok, otpId }. */
export const sendSignupOtp = (email) => post(SEND_OTP_URL, { purpose: 'signup', email });

/** Send a password-reset OTP to the verified email on file for `username`. Returns { ok, otpId }. */
export const sendPasswordResetOtp = (username) => post(SEND_OTP_URL, { purpose: 'password_reset', username });

/** Send a change-password OTP to the signed-in user's verified email. Returns { ok, otpId }. */
export const sendChangePasswordOtp = () =>
  post(SEND_OTP_URL, { purpose: 'change_password' }, { requireAuth: true });

/** Verify a code for the given otpId (returned by the corresponding send call). */
export const verifyOtp = (otpId, code) => post(VERIFY_OTP_URL, { otpId, code });

/** Complete a logged-out password reset once the OTP is verified. */
export const resetPassword = (otpId, code, newPassword) =>
  post(RESET_PASSWORD_URL, { otpId, code, newPassword });

/** Complete a logged-in password change once the OTP is verified. */
export const changePassword = (otpId, code, newPassword) =>
  post(CHANGE_PASSWORD_URL, { otpId, code, newPassword }, { requireAuth: true });
