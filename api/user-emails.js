// =====================================================================
// FrogPlanner — Manage a user's reminder emails (Vercel Serverless Function)
// Location: api/user-emails.js
// ---------------------------------------------------------------------
// CRUD over public.user_emails for the signed-in user. Reminders (later
// phases) fan out to every VERIFIED email here.
//
//   GET    /api/user-emails                 → list this user's emails
//   POST   /api/user-emails {email}         → add (unverified); caller then
//                                             calls /api/send-verification
//   DELETE /api/user-emails {id}            → remove an email (not the last)
//   PATCH  /api/user-emails {id}            → set as primary
//
// Auth: Authorization: Bearer <fp_session_token> (custom auth).
// Env: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL).
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Server misconfigured (missing Supabase env).' });
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) return res.status(401).json({ error: 'Sign in to manage your emails.' });

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

    // ── LIST ────────────────────────────────────────────────────────────
    if (req.method === 'GET') {
      const emails = await listEmails(supabase, userId);
      return res.status(200).json({ emails });
    }

    // ── ADD ─────────────────────────────────────────────────────────────
    if (req.method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });

      const existing = await listEmails(supabase, userId);
      if (existing.some((e) => e.email.toLowerCase() === email)) {
        return res.status(409).json({ error: 'That email is already on your account.' });
      }
      const { error } = await supabase.from('user_emails').insert({
        user_id: userId,
        email,
        is_verified: false,
        is_primary: existing.length === 0, // first email becomes primary
      });
      if (error) throw error;
      return res.status(201).json({ emails: await listEmails(supabase, userId) });
    }

    // ── DELETE ──────────────────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const existing = await listEmails(supabase, userId);
      if (existing.length <= 1) {
        return res.status(400).json({ error: 'You must keep at least one email.' });
      }
      const target = existing.find((e) => e.id === id);
      if (!target) return res.status(404).json({ error: 'Email not found.' });

      await supabase.from('user_emails').delete().eq('id', id).eq('user_id', userId);
      // If we removed the primary, promote another one.
      if (target.is_primary) {
        const remaining = existing.filter((e) => e.id !== id);
        if (remaining[0]) {
          await supabase.from('user_emails').update({ is_primary: true }).eq('id', remaining[0].id);
        }
      }
      return res.status(200).json({ emails: await listEmails(supabase, userId) });
    }

    // ── SET PRIMARY ─────────────────────────────────────────────────────
    if (req.method === 'PATCH') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ error: 'id is required.' });
      const existing = await listEmails(supabase, userId);
      if (!existing.some((e) => e.id === id)) return res.status(404).json({ error: 'Email not found.' });

      await supabase.from('user_emails').update({ is_primary: false }).eq('user_id', userId);
      await supabase.from('user_emails').update({ is_primary: true }).eq('id', id).eq('user_id', userId);
      return res.status(200).json({ emails: await listEmails(supabase, userId) });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (error) {
    console.error('[API user-emails] Error:', error);
    return res.status(500).json({ error: 'Could not update your emails. Please try again.' });
  }
}

async function listEmails(supabase, userId) {
  const { data } = await supabase
    .from('user_emails')
    .select('id, email, is_verified, is_primary, created_at')
    .eq('user_id', userId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  return data || [];
}

function safeParse(v) {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}
