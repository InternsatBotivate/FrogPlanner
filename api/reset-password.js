// =====================================================================
// FrogPlanner — Reset password via verified OTP (Vercel Serverless Function)
// Location: api/reset-password.js
// ---------------------------------------------------------------------
// Logged-out "forgot password" completion step. Re-validates the OTP is
// verified and unexpired (defense in depth — doesn't trust a client-side
// "already verified" flag alone), resolves the user from the OTP row
// (purpose='password_reset' OTPs always carry a user_id — see send-otp.js),
// and writes ONLY password_hash — intentionally narrower than
// authService.js's updateUserProfile, which unconditionally rewrites the
// whole profile row. Identified by otpId (not email) — the client only
// ever supplied a username, never the resolved email address.
//
//   POST /api/reset-password { otpId, code, newPassword }
//
// Env: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL).
// =====================================================================

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
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
    const newPassword = String(body.newPassword || '');

    if (!otpId || !code) return res.status(400).json({ error: 'Missing verification details.' });
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const { data: otp, error: fetchErr } = await supabase
      .from('email_otps')
      .select('id, code, user_id, purpose, expires_at, verified_at')
      .eq('id', otpId)
      .eq('purpose', 'password_reset')
      .maybeSingle();

    if (fetchErr || !otp) return res.status(400).json({ error: 'Request a new code and try again.' });
    if (!otp.verified_at || otp.code !== code) {
      return res.status(400).json({ error: 'Verify your code before setting a new password.' });
    }
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Request a new one.' });
    }
    if (!otp.user_id) return res.status(400).json({ error: 'Could not resolve the account. Try again.' });

    const { error: updateErr } = await supabase
      .from('users')
      .update({ password_hash: newPassword })
      .eq('id', otp.user_id);
    if (updateErr) throw updateErr;

    // Single-use — clear it so it can't be replayed.
    await supabase.from('email_otps').delete().eq('id', otp.id);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[API reset-password] Error:', error);
    return res.status(500).json({ error: 'Could not reset your password. Please try again.' });
  }
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}
