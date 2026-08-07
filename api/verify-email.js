// =====================================================================
// FrogPlanner — Verify email (Vercel Serverless Node.js Function)
// Location: api/verify-email.js
// ---------------------------------------------------------------------
// GET /api/verify-email?token=<hex> — the link emailed by send-verification.
// Validates the single-use token (unexpired, unused), marks the email verified
// in user_emails, flips users.email_verified/reminders_enabled when this is the
// user's verified email, and returns a small HTML confirmation page.
//
// Required server env:
//   SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL)
// =====================================================================

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const token = String((req.query && req.query.token) || '').trim();

  try {
    if (!supabaseUrl || !serviceRoleKey) return page(res, 500, 'error', 'Server not configured.');
    if (!token) return page(res, 400, 'error', 'Missing verification token.');

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: row, error } = await supabase
      .from('email_verifications')
      .select('token, user_id, email, expires_at, verified_at')
      .eq('token', token)
      .maybeSingle();

    if (error || !row) return page(res, 400, 'error', 'This verification link is invalid.');
    if (row.verified_at) return page(res, 200, 'ok', 'This email is already verified. You’re all set!');
    if (new Date(row.expires_at) < new Date()) {
      return page(res, 400, 'error', 'This link has expired. Request a new one from FrogPlanner settings.');
    }

    const nowIso = new Date().toISOString();
    // Mark the token used.
    await supabase.from('email_verifications').update({ verified_at: nowIso }).eq('token', token);
    // Mark this email verified.
    await supabase
      .from('user_emails')
      .update({ is_verified: true })
      .eq('user_id', row.user_id)
      .ilike('email', row.email);
    // Flip the user-level flag + enable reminders (opt-in default on first verify).
    await supabase
      .from('users')
      .update({ email_verified: true, reminders_enabled: true })
      .eq('id', row.user_id);

    return page(res, 200, 'ok', 'Your email is verified — FrogPlanner reminders are now enabled.');
  } catch (e) {
    console.error('[API verify-email] Error:', e);
    return page(res, 500, 'error', 'Something went wrong verifying your email.');
  }
}

function page(res, status, kind, message) {
  const ok = kind === 'ok';
  const html = `<!doctype html><html><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>FrogPlanner — Email verification</title></head>
    <body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f7f6;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:420px;margin:24px;background:#fff;border:1px solid #e5e7eb;border-radius:18px;overflow:hidden;text-align:center;">
        <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:26px;color:#fff;font-size:22px;font-weight:800;"><img src="https://www.frogplanner.in/favicon.png" width="26" height="26" alt="" style="vertical-align:middle;border-radius:7px;margin-right:8px;" />FrogPlanner</div>
        <div style="padding:28px 24px;">
          <div style="font-size:44px;margin-bottom:10px;">${ok ? '✅' : '⚠️'}</div>
          <p style="margin:0 0 20px;color:#374151;font-size:15px;line-height:1.6;">${message}</p>
          <a href="https://www.frogplanner.in" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:11px 22px;border-radius:10px;">Open FrogPlanner</a>
        </div>
      </div>
    </body></html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(html);
}
