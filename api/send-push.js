// api/send-push.js
// ---------------------------------------------------------------------------
// Send a push notification via the Expo Push API (delivers to iOS + Android).
//
// Auth: protected by CRON_SECRET — callers MUST send
//   Authorization: Bearer <CRON_SECRET>
// This is a server/admin/cron-only endpoint, NOT called directly by the app.
// It's the single place the backend sends push, so the reminder cron (or an
// admin broadcast) can reuse it.
//
// Body (JSON):
//   { "userId": "<uuid>", "title": "...", "body": "...", "data": {...} }   // one user
//   { "broadcast": true, "title": "...", "body": "..." }                    // all users
//
// Env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL).
// ---------------------------------------------------------------------------
import { createClient } from '@supabase/supabase-js';
import { sendPushToTokens, sendPushToUser } from './_lib/push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Missing Supabase env.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const { userId, broadcast, title, body: messageBody, data } = body;

    if (!title || !messageBody) {
      return res.status(400).json({ error: 'title and body are required.' });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const message = { title, body: messageBody, data: data || {} };

    let result;
    if (broadcast) {
      const { data: rows, error } = await supabase.from('user_push_tokens').select('token');
      if (error) return res.status(500).json({ error: error.message });
      result = await sendPushToTokens(supabase, (rows || []).map((r) => r.token), message);
    } else if (userId) {
      result = await sendPushToUser(supabase, userId, message);
    } else {
      return res.status(400).json({ error: 'Provide userId or broadcast:true.' });
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error('[API send-push] Error:', error);
    return res.status(500).json({ error: 'Failed to send push.' });
  }
}
