// =====================================================================
// FrogPlanner — AI Assistant proxy (Vercel Serverless Node.js Function)
// Location: api/ai-chat.js
// ---------------------------------------------------------------------
// Stateless pass-through to Cerebras' OpenAI-compatible Chat Completions
// API. The Cerebras API key lives ONLY here (server-side env) so it is
// never shipped in the web bundle or the mobile app.
//
// Auth: callers must send their FrogPlanner session token
//   Authorization: Bearer <fp_session_token>
// which is validated against public.user_sessions (same custom-auth the
// apps already use). This blocks anonymous abuse of the shared key and is
// the natural place to add the subscription/usage gate in a later version.
//
// The AI tool-calling LOOP runs client-side (tools mutate the caller's own
// planner). This function only relays one chat/completions round-trip, so
// both the web app and the mobile app share it unchanged.
//
// Required env vars (set on Vercel, never committed):
//   CEREBRAS_API_KEY            — the shared Cerebras secret
//   SUPABASE_SERVICE_ROLE_KEY   — to validate session tokens server-side
//   VITE_SUPABASE_URL (or SUPABASE_URL)
// Optional:
//   CEREBRAS_MODEL              — defaults to 'gpt-oss-120b'
//   CEREBRAS_BASE_URL           — defaults to 'https://api.cerebras.ai/v1'
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const DEFAULT_MODEL = 'gpt-oss-120b';
const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1';

export default async function handler(req, res) {
  // CORS — the web build calls this cross-origin; a Bearer token (not a
  // cookie) carries auth, so a permissive origin is acceptable here.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!cerebrasKey) {
      return res.status(500).json({ error: 'AI is not configured (missing CEREBRAS_API_KEY).' });
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({ error: 'Server misconfigured (missing Supabase env).' });
    }

    // ── Authenticate the caller by their FrogPlanner session token ──────
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      return res.status(401).json({ error: 'Sign in to use the AI Assistant.' });
    }

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

    // ── Validate the relay payload ──────────────────────────────────────
    const body = typeof req.body === 'string' ? safeParse(req.body) : req.body || {};
    const { messages, tools, tool_choice, temperature } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages[] is required.' });
    }

    // Model + key are enforced server-side and can never be overridden by
    // the client.
    const model = process.env.CEREBRAS_MODEL || DEFAULT_MODEL;
    const baseUrl = (process.env.CEREBRAS_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');

    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cerebrasKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        ...(Array.isArray(tools) && tools.length ? { tools, tool_choice: tool_choice || 'auto' } : {}),
        ...(typeof temperature === 'number' ? { temperature } : {}),
      }),
    });

    const json = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const message =
        json?.error?.message || json?.message || `AI request failed (${upstream.status}).`;
      // Do not leak upstream key/details; surface a clean message.
      return res.status(upstream.status === 401 ? 502 : upstream.status).json({ error: message });
    }

    return res.status(200).json(json);
  } catch (error) {
    console.error('[API ai-chat] Error:', error);
    return res.status(500).json({ error: 'AI Assistant is temporarily unavailable.' });
  }
}

function safeParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}
