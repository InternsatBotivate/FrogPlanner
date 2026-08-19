// =====================================================================
// FrogPlanner — Verify a 6-digit email OTP (Vercel Serverless Function)
// Location: api/verify-otp.js
// ---------------------------------------------------------------------
// Checks a code against an email_otps row, identified by otpId — the
// opaque row id returned by send-otp.js. Using otpId (not email) means the
// client never needs to know the resolved email address, which matters for
// forgot-password: the client only ever supplies a username, and the
// server resolves+hides the actual email on file.
// On match, marks it verified_at — this is a CHECK step; the actual account
// mutation (create user_emails row, reset password, etc.) happens in the
// caller (signup flow) or in reset-password.js / change-password.js, which
// re-validate verified_at themselves.
//
//   POST /api/verify-otp { otpId, code }
//
// Env: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL).
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const MAX_ATTEMPTS = 5;

export async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Server misconfigured (missing Supabase env).' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
    const otpId = String(body.otpId || '').trim();
    const code = String(body.code || '').trim();

    if (!otpId || !code) return res.status(400).json({ error: 'Enter the code sent to your email.' });

    const { data: otp, error: fetchErr } = await supabase
      .from('email_otps')
      .select('id, code, expires_at, verified_at, attempts')
      .eq('id', otpId)
      .maybeSingle();

    if (fetchErr || !otp) return res.status(400).json({ error: 'Request a new code and try again.' });
    if (otp.verified_at) return res.status(200).json({ verified: true }); // already confirmed, idempotent
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Request a new one.' });
    }
    if (otp.attempts >= MAX_ATTEMPTS) {
      return res.status(400).json({ error: 'Too many incorrect attempts. Request a new code.' });
    }

    if (otp.code !== code) {
      await supabase.from('email_otps').update({ attempts: otp.attempts + 1 }).eq('id', otp.id);
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    await supabase.from('email_otps').update({ verified_at: new Date().toISOString() }).eq('id', otp.id);
    return res.status(200).json({ verified: true });
  } catch (error) {
    console.error('[API verify-otp] Error:', error);
    return res.status(500).json({ error: 'Could not verify the code. Please try again.' });
  }
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}
