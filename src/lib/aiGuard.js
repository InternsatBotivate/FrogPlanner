/**
 * aiGuard.js — cheap, synchronous input guard for the AI Assistant.
 * ──────────────────────────────────────────────────────────────────────────
 * Runs BEFORE any network/model call, so a flagged message never costs a
 * token. Two jobs only:
 *   1. Cap input length (reject runaway/obfuscated payloads).
 *   2. Flag high-confidence prompt-injection / jailbreak patterns.
 *
 * This is deliberately conservative — it targets explicit attack phrasing, not
 * ordinary off-topic chit-chat (the hardened system prompt handles polite
 * refusals for "what's the weather"). Keeping the pattern list tight avoids
 * false positives on legitimate task text like "ignore the meeting reminder".
 * ──────────────────────────────────────────────────────────────────────────
 */

// A single user message longer than this is almost certainly not a planner
// request — reject before spending tokens. (~2k chars ≈ a long paragraph.)
export const MAX_INPUT_LENGTH = 2000;

// High-confidence injection / jailbreak markers. Matched case-insensitively.
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+(?:instructions?|prompts?|rules?)/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|the)\s+(?:instructions?|rules?)/i,
  /forget\s+(?:everything|all|your)\s+(?:above|previous|instructions?|rules?)/i,
  /you\s+are\s+now\s+(?:a|an|no longer)/i,
  /(?:reveal|show|print|repeat|expose|leak)\s+(?:me\s+)?(?:your|the)\s+(?:system\s+)?(?:prompt|instructions?|rules?)/i,
  /what\s+(?:is|are)\s+your\s+(?:system\s+)?(?:prompt|instructions?)/i,
  /\bsystem\s*:\s*/i, // fake "system:" role injection
  /\b(?:developer|assistant)\s*:\s*you\s+(?:must|will|should)/i,
  /act\s+as\s+(?:a|an|if\s+you)/i,
  /pretend\s+(?:to\s+be|you\s+are)/i,
  /jailbreak|DAN\s+mode|developer\s+mode/i,
  /base64|atob\(|\\x[0-9a-f]{2}/i, // encoded payloads
];

/**
 * checkInput — synchronous pre-model guard.
 * @param {string} text  The raw user message.
 * @returns {{ ok: boolean, reason?: 'length' | 'injection', message?: string }}
 */
export function checkInput(text) {
  const value = typeof text === 'string' ? text : '';

  if (value.length > MAX_INPUT_LENGTH) {
    return {
      ok: false,
      reason: 'length',
      message:
        "That message is too long for me to process. Please shorten it and ask about your tasks, projects, or planner.",
    };
  }

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(value)) {
      return {
        ok: false,
        reason: 'injection',
        message:
          "I'm your FrogPlanner assistant — I can only help with your tasks, projects, recurring tasks, and daily planning. What would you like to do with your planner?",
      };
    }
  }

  return { ok: true };
}
