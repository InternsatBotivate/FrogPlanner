// =====================================================================
// FrogPlanner — Send email verification (Vercel Serverless Node.js Function)
// Location: api/send-verification.js
// ---------------------------------------------------------------------
// Mints a single-use, 24h verification token for an email, stores it, and
// emails a verify link via Resend SMTP. Also upserts the email
// into user_emails as unverified.
//
// Auth: caller sends their FrogPlanner session token
//   Authorization: Bearer <fp_session_token>
// validated against public.user_sessions (custom auth — no Supabase Auth).
//
// Required server env (Vercel, never in the bundle):
//   RESEND_API_KEY
//   SUPABASE_SERVICE_ROLE_KEY
//   VITE_SUPABASE_URL (or SUPABASE_URL)
// Optional:
//   APP_BASE_URL          — public origin for the verify link
//                           (defaults to the request origin, then frogplanner.com)
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import { sendMail, emailShell } from '../mailer.js';
import { randomBytes } from 'node:crypto';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handler(req, res) {
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

    // ── Authenticate the caller by session token ────────────────────────
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Sign in to verify your email.' });

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: session, error: sessionError } = await supabase
      .from('user_sessions')
      .select('user_id, expires_at')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    if (sessionError || !session) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    const userId = session.user_id;

    // ── Validate the target email ───────────────────────────────────────
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

    // ── Ensure the email row exists (unverified). First email → primary. ─
    const { data: existingEmails } = await supabase
      .from('user_emails')
      .select('id, email, is_primary')
      .eq('user_id', userId);
    const alreadyHas = (existingEmails || []).some((e) => String(e.email || '').toLowerCase() === email);
    if (!alreadyHas) {
      await supabase.from('user_emails').insert({
        user_id: userId,
        email,
        is_verified: false,
        is_primary: !existingEmails || existingEmails.length === 0,
      });
    }

    // ── Mint a single-use token (24h) ───────────────────────────────────
    const verifyToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();
    const { error: insErr } = await supabase.from('email_verifications').insert({
      token: verifyToken,
      user_id: userId,
      email,
      expires_at: expiresAt,
    });
    if (insErr) throw insErr;

    // ── Build the verify link ───────────────────────────────────────────
    const base =
      process.env.APP_BASE_URL ||
      originFromReq(req) ||
      'https://www.frogplanner.com';
    const verifyUrl = `${base.replace(/\/$/, '')}/api/verify-email?token=${verifyToken}`;

    // ── Send via Resend SMTP ─────────────────────────────────────────────
    await sendMail({
      to: email,
      subject: 'Verify your email for Frog Planner',
      text:
        `Verify your email to enable Frog Planner reminders:\n${verifyUrl}\n\n` +
        `This link expires in 24 hours. If you didn't request this, you can ignore it.\n\n` +
        `\u00A9 ${new Date().getUTCFullYear()} Botivate. All rights reserved.`,
      html: verificationEmailHtml(verifyUrl),
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[API send-verification] Error:', error);
    return res.status(500).json({ error: 'Could not send the verification email. Please try again.' });
  }
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}

function originFromReq(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return host ? `${proto}://${host}` : '';
}

function verificationEmailHtml(url) {
  return emailShell(`
    <h1 class="email-heading" style="margin:0 0 10px;color:#102118;font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.7px;">Verify your email</h1>
    <p class="email-copy" style="margin:0 0 24px;color:#526158;font-size:15px;line-height:24px;">Confirm this address to receive task deadlines, weather-aware nudges, and the reminders you choose.</p>
    <table role="presentation" class="cta-table" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
      <tr>
        <td bgcolor="#1f6f4b" style="border-radius:10px;">
          <a class="cta-link" href="${url}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:14px;line-height:18px;font-weight:800;">Verify email address&nbsp;&nbsp;&rarr;</a>
        </td>
      </tr>
    </table>
    <div style="margin:0 0 18px;padding:14px 16px;background:#f3f7f4;border:1px solid #dce7e0;border-radius:12px;">
      <p style="margin:0 0 5px;color:#617268;font-size:10px;line-height:14px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">Button not working?</p>
      <p style="margin:0;word-break:break-all;font-size:11px;line-height:18px;"><a href="${url}" style="color:#1f6f4b;text-decoration:underline;">${url}</a></p>
    </div>
    <p style="margin:0;padding:13px 15px;border-left:3px solid #f2c94c;background:#fffaf0;color:#65746b;font-size:12px;line-height:19px;">This link expires in <strong style="color:#425249;">24 hours</strong>. If you didn’t request it, you can safely ignore this email.</p>
  `, { eyebrow: 'Email verification', previewText: 'Confirm your email address for Frog Planner reminders.' });
}
