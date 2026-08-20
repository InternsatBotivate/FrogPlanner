// =====================================================================
// FrogPlanner — AI Assistant proxy (Vercel Serverless Node.js Function)
// Location: api/ai-chat.js
// ---------------------------------------------------------------------
// Stateless pass-through to an OpenAI-compatible Chat Completions API,
// tried across a provider chain in order: Groq -> OpenAI -> Cerebras.
// Every provider key lives ONLY here (server-side env) so none of them
// are ever shipped in the web bundle or the mobile app.
//
// Groq is primary (cheap, fast, strong tool-calling on gpt-oss-120b).
// OpenAI is the fallback if Groq errors or is unconfigured. Cerebras —
// the original provider — is the LAST resort, kept only for continuity
// with existing Vercel env (CEREBRAS_API_KEY) rather than as a preferred
// path. A provider is skipped entirely if its API key isn't set, so this
// degrades gracefully in an environment with only one or two configured.
//
// Auth: callers must send their FrogPlanner session token
//   Authorization: Bearer <fp_session_token>
// which is validated against public.user_sessions (same custom-auth the
// apps already use). This blocks anonymous abuse of the shared keys and is
// the natural place to add the subscription/usage gate in a later version.
//
// The AI tool-calling LOOP runs client-side (tools mutate the caller's own
// planner). This function only relays one chat/completions round-trip, so
// both the web app and the mobile app share it unchanged.
//
// Required env vars (set on Vercel, never committed) — at least one:
//   GROQ_API_KEY                — primary
//   OPENAI_API_KEY              — fallback
//   CEREBRAS_API_KEY            — last-resort fallback
//   SUPABASE_SERVICE_ROLE_KEY   — to validate session tokens server-side
//   VITE_SUPABASE_URL (or SUPABASE_URL)
// Optional per-provider model/base-URL overrides:
//   GROQ_MODEL       (default 'openai/gpt-oss-120b')
//   GROQ_BASE_URL    (default 'https://api.groq.com/openai/v1')
//   OPENAI_MODEL     (default 'gpt-4o-mini')
//   OPENAI_BASE_URL  (default 'https://api.openai.com/v1')
//   CEREBRAS_MODEL   (default 'gpt-oss-120b')
//   CEREBRAS_BASE_URL(default 'https://api.cerebras.ai/v1')
// =====================================================================

import { createClient } from '@supabase/supabase-js';

// Order here IS the fallback order.
const PROVIDERS = [
  {
    name: 'groq',
    keyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    baseUrlEnv: 'GROQ_BASE_URL',
    defaultModel: 'openai/gpt-oss-120b',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    name: 'openai',
    keyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    baseUrlEnv: 'OPENAI_BASE_URL',
    defaultModel: 'gpt-4o-mini',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    name: 'cerebras',
    keyEnv: 'CEREBRAS_API_KEY',
    modelEnv: 'CEREBRAS_MODEL',
    baseUrlEnv: 'CEREBRAS_BASE_URL',
    defaultModel: 'gpt-oss-120b',
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
  },
];

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
    const configured = PROVIDERS.filter((p) => process.env[p.keyEnv]);
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (configured.length === 0) {
      return res.status(500).json({ error: 'AI is not configured (no provider API key set).' });
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

    // Model + key are enforced server-side per provider and can never be
    // overridden by the client.
    const basePayload = {
      messages,
      ...(Array.isArray(tools) && tools.length ? { tools, tool_choice: tool_choice || 'auto' } : {}),
      ...(typeof temperature === 'number' ? { temperature } : {}),
    };

    const callProvider = (provider) => {
      const model = process.env[provider.modelEnv] || provider.defaultModel;
      const baseUrl = (process.env[provider.baseUrlEnv] || provider.defaultBaseUrl).replace(/\/$/, '');
      const apiKey = process.env[provider.keyEnv];
      const payload = JSON.stringify({ model, ...basePayload });

      return fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: payload,
      });
    };

    // Try each configured provider in order. A rate limit (429) on a given
    // provider gets one honor-the-Retry-After retry before moving on to the
    // next provider rather than failing the whole request — the same
    // resilience the single-provider version had, just per-hop now. Any
    // other non-OK response (or a network-level throw) also falls through
    // to the next provider; only the LAST provider's failure is what the
    // caller actually sees.
    let lastError = null;
    for (let i = 0; i < configured.length; i += 1) {
      const provider = configured[i];
      const isLast = i === configured.length - 1;

      try {
        let upstream = await callProvider(provider);
        if (upstream.status === 429) {
          const retryAfterSec = Number(upstream.headers.get('retry-after'));
          const waitMs = Math.min(
            Number.isFinite(retryAfterSec) && retryAfterSec > 0 ? retryAfterSec * 1000 : 1200,
            4000,
          );
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          upstream = await callProvider(provider);
        }

        const json = await upstream.json().catch(() => null);

        if (upstream.ok) {
          return res.status(200).json(json);
        }

        const message = json?.error?.message || json?.message || `AI request failed (${upstream.status}).`;
        console.warn(`[API ai-chat] Provider "${provider.name}" failed (${upstream.status}): ${message}`);
        lastError = { status: upstream.status, message };

        if (upstream.status === 429 && !isLast) continue; // move to next provider
        if (!isLast) continue; // any other failure also falls through
      } catch (err) {
        console.warn(`[API ai-chat] Provider "${provider.name}" threw:`, err?.message);
        lastError = { status: 502, message: err?.message || 'Upstream request failed.' };
        if (!isLast) continue;
      }
    }

    // Every configured provider failed — surface the last one's error.
    if (lastError?.status === 429) {
      return res.status(429).json({
        error: 'The assistant is busy right now (rate limit). Please try again in a few seconds.',
      });
    }
    // Do not leak upstream key/details; surface a clean message.
    const status = lastError?.status === 401 ? 502 : lastError?.status || 502;
    return res.status(status).json({ error: lastError?.message || 'AI Assistant is temporarily unavailable.' });
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
