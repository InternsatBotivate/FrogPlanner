// =====================================================================
// FrogPlanner — Change password via verified OTP (Vercel Serverless Function)
// Location: api/change-password.js
// ---------------------------------------------------------------------
// Settings-page "Change Password" completion step. Requires a live session
// AND a verified OTP for THAT session's own account — deliberately scoped
// to the session's user_id (not the OTP row's user_id), so a stale or
// mismatched OTP can never be used to change a different account's
// password. Writes ONLY password_hash, same narrow-write pattern as
// reset-password.js.
//
//   POST /api/change-password { otpId, code, newPassword }
//   Authorization: Bearer <fp_session_token>
//
// Env: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL).
// =====================================================================

import { createClient } from '@supabase/supabase-js';

export async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Server misconfigured (missing Supabase env).' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Sign in to change your password.' });

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

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
    const otpId = String(body.otpId || '').trim();
    const code = String(body.code || '').trim();
    const newPassword = String(body.newPassword || '');

    if (!otpId || !code) return res.status(400).json({ error: 'Enter the code sent to your email.' });
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    // Scoped to THIS session's own user_id, not just the OTP row's user_id
    // — a stale/mismatched otpId for a different account is rejected here.
    const { data: otp, error: fetchErr } = await supabase
      .from('email_otps')
      .select('id, code, user_id, expires_at, verified_at')
      .eq('id', otpId)
      .eq('user_id', userId)
      .eq('purpose', 'change_password')
      .maybeSingle();

    if (fetchErr || !otp) return res.status(400).json({ error: 'Request a new code and try again.' });
    if (!otp.verified_at || otp.code !== code) {
      return res.status(400).json({ error: 'Verify your code before setting a new password.' });
    }
    if (new Date(otp.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This code has expired. Request a new one.' });
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({ password_hash: newPassword })
      .eq('id', userId);
    if (updateErr) throw updateErr;

    await supabase.from('email_otps').delete().eq('id', otp.id);

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[API change-password] Error:', error);
    return res.status(500).json({ error: 'Could not change your password. Please try again.' });
  }
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}
