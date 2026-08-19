// =====================================================================
// FrogPlanner — Send a 6-digit email OTP (Vercel Serverless Node.js Function)
// Location: api/send-otp.js
// ---------------------------------------------------------------------
// Mints a 6-digit, 10-minute one-time code and emails it via Resend SMTP.
// Separate from api/send-verification.js (the existing 24h link-based
// flow used by the Settings-page "add a reminder email" feature) because
// this needs to work BEFORE an account/session exists (signup) and WITHOUT
// a session at all (forgot password) — see .claude plan for why.
//
//   POST /api/send-otp { purpose: 'signup', email }
//   POST /api/send-otp { purpose: 'password_reset', username }
//   POST /api/send-otp { purpose: 'change_password' }   (needs Bearer token)
//
// Rate limit (per email+purpose, enforced against email_otps rows):
//   60s cooldown between sends, max 5 sends per rolling hour.
//
// Required server env (Vercel, never in the bundle):
//   RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   VITE_SUPABASE_URL (or SUPABASE_URL)
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import { sendMail } from './_lib/mailer.js';

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_SENDS_PER_HOUR = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PURPOSES = ['signup', 'password_reset', 'change_password'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'Email is not configured (missing Resend API key).' });
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Server misconfigured (missing Supabase env).' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
    const purpose = String(body.purpose || '');
    if (!PURPOSES.includes(purpose)) return res.status(400).json({ error: 'Invalid purpose.' });

    // ── Resolve the target email + optional user_id per purpose ─────────
    let email;
    let userId = null;

    if (purpose === 'signup') {
      email = String(body.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

      // Don't let someone re-verify an email that's already a registered
      // account's primary address — steer them to sign in instead.
      const { data: existing } = await supabase
        .from('user_emails')
        .select('id')
        .eq('is_primary', true)
        .ilike('email', email)
        .maybeSingle();
      if (existing) {
        return res.status(400).json({ error: 'An account already uses this email. Try signing in instead.' });
      }
    } else if (purpose === 'password_reset') {
      const identifier = String(body.username || '').trim();
      if (!identifier) return res.status(400).json({ error: 'Enter your User ID or email.' });

      // Neutral message either way — don't reveal whether the account
      // exists, only whether we could send a code.
      const notFoundMsg = 'No verified email on file for that account. Contact support.';
      const isEmailIdentifier = identifier.includes('@');

      let resolvedUserId = null;
      if (isEmailIdentifier) {
        const lower = identifier.toLowerCase();
        // Try users.email first, then user_emails (an address added later
        // via Settings can diverge from users.email).
        const { data: byUsersEmail } = await supabase
          .from('users')
          .select('id')
          .ilike('email', lower)
          .maybeSingle();
        if (byUsersEmail) {
          resolvedUserId = byUsersEmail.id;
        } else {
          const { data: emailRow } = await supabase
            .from('user_emails')
            .select('user_id')
            .ilike('email', lower)
            .maybeSingle();
          if (emailRow) resolvedUserId = emailRow.user_id;
        }
      } else {
        const { data: byUsername } = await supabase
          .from('users')
          .select('id')
          .eq('username', identifier)
          .maybeSingle();
        if (byUsername) resolvedUserId = byUsername.id;
      }
      if (!resolvedUserId) return res.status(400).json({ error: notFoundMsg });

      const { data: primaryEmail } = await supabase
        .from('user_emails')
        .select('email')
        .eq('user_id', resolvedUserId)
        .eq('is_primary', true)
        .eq('is_verified', true)
        .maybeSingle();
      if (!primaryEmail) return res.status(400).json({ error: notFoundMsg });

      userId = resolvedUserId;
      email = primaryEmail.email.toLowerCase();
    } else {
      // change_password — requires a live session.
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      if (!token) return res.status(401).json({ error: 'Sign in to change your password.' });

      const { data: session } = await supabase
        .from('user_sessions')
        .select('user_id, expires_at')
        .eq('token', token)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (!session) return res.status(401).json({ error: 'Session expired. Please sign in again.' });

      const { data: primaryEmail } = await supabase
        .from('user_emails')
        .select('email')
        .eq('user_id', session.user_id)
        .eq('is_primary', true)
        .eq('is_verified', true)
        .maybeSingle();
      if (!primaryEmail) {
        return res.status(400).json({ error: 'Verify your email before changing your password.' });
      }

      userId = session.user_id;
      email = primaryEmail.email.toLowerCase();
    }

    // ── Rate limit: 60s cooldown + 5/hour, per email+purpose ─────────────
    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const { data: recent } = await supabase
      .from('email_otps')
      .select('last_sent_at, send_count_hour')
      .eq('email', email)
      .eq('purpose', purpose)
      .gte('created_at', hourAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let sendCountHour = 1;
    if (recent) {
      const sinceLastSend = now - new Date(recent.last_sent_at).getTime();
      if (sinceLastSend < RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((RESEND_COOLDOWN_MS - sinceLastSend) / 1000);
        return res.status(429).json({ error: `Please wait ${waitSec}s before requesting another code.` });
      }
      if (recent.send_count_hour >= MAX_SENDS_PER_HOUR) {
        return res.status(429).json({ error: 'Too many codes requested. Please try again later.' });
      }
      sendCountHour = recent.send_count_hour + 1;
    }

    // ── Mint + store the code ─────────────────────────────────────────────
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
    const { data: inserted, error: insErr } = await supabase
      .from('email_otps')
      .insert({
        email,
        code,
        purpose,
        user_id: userId,
        expires_at: expiresAt,
        last_sent_at: new Date(now).toISOString(),
        send_count_hour: sendCountHour,
      })
      .select('id')
      .single();
    if (insErr) throw insErr;

    // ── Send via Resend SMTP ─────────────────────────────────────────────
    await sendMail({
      to: email,
      subject: 'Your Frog Planner verification code',
      text: `Your Frog Planner verification code is ${code}. It expires in 10 minutes. If you didn't request this, you can ignore it.`,
      html: otpEmailHtml(code),
    });

    // otpId is an opaque, unguessable UUID (not the code) — safe to return
    // to the client so it doesn't need to know the target email/username to
    // verify/consume the code later (important for forgot-password, where
    // the client only ever provides a username, never sees the resolved
    // email address).
    return res.status(200).json({ ok: true, otpId: inserted.id });
  } catch (error) {
    console.error('[API send-otp] Error:', error);
    return res.status(500).json({ error: 'Could not send the verification code. Please try again.' });
  }
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

function otpEmailHtml(code) {
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:22px 24px;color:#fff;">
        <div style="font-size:20px;font-weight:800;"><img src="https://www.frogplanner.in/favicon.png" width="24" height="24" alt="" style="vertical-align:middle;border-radius:6px;margin-right:8px;" />Frog Planner</div>
      </div>
      <div style="padding:24px;color:#374151;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 14px;">Here's your verification code:</p>
        <p style="text-align:center;margin:22px 0;">
          <span style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;color:#16a34a;font-weight:800;font-size:28px;letter-spacing:6px;padding:14px 26px;border-radius:12px;">${code}</span>
        </p>
        <p style="margin:0;color:#9ca3af;font-size:12px;">This code expires in 10 minutes. If you didn't request it, ignore this email.</p>
      </div>
    </div>
  </body></html>`;
}
