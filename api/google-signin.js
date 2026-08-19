// =====================================================================
// FrogPlanner — Google sign-in / sign-up (Vercel Serverless Function)
// Location: api/google-signin.js
// ---------------------------------------------------------------------
// THE TRUST BOUNDARY for Google auth. The client sends a Google ID token;
// this verifies it against Google's public keys and only then resolves or
// creates an account and mints a session.
//
// Why this cannot live client-side: an ID token is only meaningful once its
// signature, issuer, audience and expiry have been checked. A browser or app
// asserting "I am alice@gmail.com" proves nothing — anyone could POST that.
// The existing Google Calendar integration uses access tokens for
// AUTHORIZATION (what the app may read) and is unrelated to AUTHENTICATION
// (who the user is), so none of it is reusable here.
//
//   POST /api/google-signin { idToken }
//   → 200 { ok: true, token, user, isNewUser }
//
// Account resolution order — google_id first, then email:
//   1. users.google_id = sub      → returning Google user
//   2. users.email    = email     → LINK Google to an existing password
//                                   account (password keeps working)
//   3. otherwise                  → create, auth_provider='google',
//                                   password_hash NULL, onboarding_complete
//                                   FALSE, username auto-generated
//
// Requires db_scripts/google_auth_and_onboarding.sql to have been run.
//
// Env: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL),
//      VITE_GOOGLE_CLIENT_ID, and optionally GOOGLE_CLIENT_ID_IOS /
//      GOOGLE_CLIENT_ID_ANDROID (each native platform mints tokens for its
//      own client, so every ID we accept must be in the audience list).
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import { OAuth2Client } from 'google-auth-library';
import { randomBytes } from 'node:crypto';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Reused across warm invocations so Google's signing certs are fetched once
// rather than on every sign-in.
const googleClient = new OAuth2Client();

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

    const audience = [
      process.env.VITE_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_ID_IOS,
      process.env.GOOGLE_CLIENT_ID_ANDROID,
    ].filter(Boolean);
    if (audience.length === 0) {
      return res.status(500).json({ error: 'Server misconfigured (missing Google client ID).' });
    }

    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
    const idToken = String(body.idToken || '').trim();
    if (!idToken) return res.status(400).json({ error: 'Missing Google credential.' });

    // ── Verify the token ────────────────────────────────────────────────
    // Checks signature against Google's JWKS, plus iss/aud/exp. Throws on any
    // failure — a forged, expired, or wrong-audience token never gets past here.
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch (err) {
      console.warn('[API google-signin] Token verification failed:', err?.message);
      return res.status(401).json({ error: 'Could not verify your Google sign-in. Please try again.' });
    }

    const googleId = payload?.sub;
    const email = String(payload?.email || '').trim().toLowerCase();
    if (!googleId || !email) {
      return res.status(400).json({ error: 'Google did not return an email for this account.' });
    }
    // Google sets this false for unconfirmed addresses on some workspace
    // configurations. Trusting an unverified address would let someone claim an
    // email they don't own — and our linking step matches on email.
    if (payload.email_verified !== true) {
      return res.status(400).json({ error: 'Your Google email is not verified. Verify it with Google first.' });
    }

    const fullName = String(payload.name || '').trim() || email.split('@')[0];
    const avatarUrl = String(payload.picture || '').trim() || null;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Returning Google user ────────────────────────────────────────
    let user = null;
    let isNewUser = false;

    const { data: byGoogleId, error: googleIdErr } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .maybeSingle();
    if (googleIdErr) throw googleIdErr;

    if (byGoogleId) {
      user = byGoogleId;
      // Keep the Google-sourced profile fresh, but never overwrite an avatar
      // the user has since uploaded themselves.
      const patch = {};
      if (byGoogleId.email !== email) patch.email = email;
      if (!byGoogleId.avatar_url && avatarUrl) patch.avatar_url = avatarUrl;
      if (Object.keys(patch).length > 0) {
        const { data: updated } = await supabase
          .from('users').update(patch).eq('id', byGoogleId.id).select().single();
        if (updated) user = updated;
      }
    } else {
      // ── 2. Link to an existing password account with the same email ───
      const { data: byEmail, error: emailErr } = await supabase
        .from('users')
        .select('*')
        .ilike('email', email)
        .maybeSingle();
      if (emailErr) throw emailErr;

      if (byEmail) {
        // Deliberately does NOT touch auth_provider or password_hash: this
        // account keeps its password and gains Google as a second way in.
        const patch = { google_id: googleId, email_verified: true };
        if (!byEmail.avatar_url && avatarUrl) patch.avatar_url = avatarUrl;
        const { data: linked, error: linkErr } = await supabase
          .from('users').update(patch).eq('id', byEmail.id).select().single();
        if (linkErr) throw linkErr;
        user = linked;
      } else {
        // ── 3. Brand new Google account ────────────────────────────────
        const username = await generateUniqueUsername(supabase, email);
        const { data: created, error: createErr } = await supabase
          .from('users')
          .insert({
            username,
            full_name: fullName,
            email,
            google_id: googleId,
            auth_provider: 'google',
            password_hash: null, // set later via Settings → Set password
            avatar_url: avatarUrl,
            email_verified: true,
            reminders_enabled: true,
            onboarding_complete: false, // sends them into the onboarding quiz
            role: 'USER',
          })
          .select()
          .single();
        if (createErr) throw createErr;
        user = created;
        isNewUser = true;

        // Mirrors authService.signUp: the address is already Google-verified,
        // so reminder emails can go out without a second confirmation step.
        await supabase.from('user_emails').insert({
          user_id: created.id, email, is_verified: true, is_primary: true,
        });
      }
    }

    // ── Mint a session ──────────────────────────────────────────────────
    // Same 64-hex token / 7-day expiry as authService.createSession. Both
    // clients read this shape, so it must not drift.
    const token = randomBytes(32).toString('hex');
    const { error: sessionErr } = await supabase.from('user_sessions').insert({
      user_id: user.id,
      token,
      expires_at: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
    });
    if (sessionErr) throw sessionErr;

    return res.status(200).json({
      ok: true,
      token,
      user: stripSecrets(user),
      // Drives the client's redirect: onboarding vs straight to the dashboard.
      // Reads the column rather than isNewUser so someone who abandoned
      // onboarding earlier is picked back up on their next sign-in.
      isNewUser: user.onboarding_complete === false,
    });
  } catch (error) {
    console.error('[API google-signin] Error:', error);
    return res.status(500).json({ error: 'Could not complete Google sign-in. Please try again.' });
  }
}

// Derives a username from the email local-part, then disambiguates on
// collision. Server-side so uniqueness is checked with the service-role key
// (the anon client cannot see other users' rows).
async function generateUniqueUsername(supabase, email) {
  const base =
    email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 20) || 'frog';

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}${attempt + 1}`;
    const { data } = await supabase
      .from('users').select('id').eq('username', candidate).maybeSingle();
    if (!data) return candidate;
  }
  // Fall back to a random suffix rather than looping forever.
  return `${base}${randomBytes(4).toString('hex')}`;
}

// The users table has no RLS, so anything returned here is fully readable by
// the client. Never let the password out.
function stripSecrets(user) {
  const { password_hash: _ignored, ...safe } = user;
  return safe;
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}
