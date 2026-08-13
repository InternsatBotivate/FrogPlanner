// =====================================================================
// FrogPlanner — Delete account and all associated data (Vercel Serverless Function)
// Location: api/delete-account.js
// ---------------------------------------------------------------------
// Settings-page "Delete Account" completion step. Requires a live session
// and the account's own password as confirmation. Everything is scoped to
// THAT session's user_id — a caller can only ever delete themselves.
//
// Deletes child rows before the users row, because the shared schema has no
// guaranteed ON DELETE CASCADE. Ordering matters: project children before
// projects, task_completions before tasks.
//
//   POST /api/delete-account { password }
//   Authorization: Bearer <fp_session_token>
//
// Env: SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL).
// =====================================================================

import { createClient } from '@supabase/supabase-js';

// Order is significant — children first, `users` last.
const USER_SCOPED_TABLES = [
  'project_files',
  'project_notes',
  'project_tasks',
  'projects',
  'task_completions',
  'tasks',
  'recurring_tasks',
  'reminders',
  'user_emails',
  'user_google_connections',
  'user_sessions',
];

export default async function handler(req, res) {
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
    if (!token) return res.status(401).json({ error: 'Sign in to delete your account.' });

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
    const password = String(body.password || '');
    if (!password) return res.status(400).json({ error: 'Enter your password to confirm.' });

    // Re-authenticate: deletion is irreversible, so a live session alone is
    // not enough. Matches authService.signIn's plain-text comparison — see
    // the auth note in CLAUDE.md.
    const { data: account, error: accountError } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', userId)
      .maybeSingle();
    if (accountError || !account) {
      return res.status(404).json({ error: 'Account not found.' });
    }
    if (account.password_hash !== password) {
      return res.status(403).json({ error: 'Incorrect password.' });
    }

    // ── Purge user-owned rows ────────────────────────────────────────────
    // A missing table (schema drift between environments) shouldn't strand a
    // half-deleted account, so per-table failures are collected and reported
    // rather than aborting the run.
    const failures = [];
    for (const table of USER_SCOPED_TABLES) {
      const { error } = await supabase.from(table).delete().eq('user_id', userId);
      if (error) failures.push(`${table}: ${error.message}`);
    }

    const { error: userError } = await supabase.from('users').delete().eq('id', userId);
    if (userError) {
      console.error('[API delete-account] Failed to delete users row:', userError, failures);
      return res.status(500).json({
        error: 'Could not fully delete your account. Contact support and we will finish it manually.',
      });
    }

    if (failures.length) {
      // The account is gone, so the user is effectively deleted; log the
      // leftovers for manual cleanup instead of failing the request.
      console.error('[API delete-account] Orphaned rows after deleting user', userId, failures);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[API delete-account] Error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
