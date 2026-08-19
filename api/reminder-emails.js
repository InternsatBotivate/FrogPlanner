// =====================================================================
// Frog Planner — reminder-email dispatcher (Vercel Serverless Function)
// Location: api/reminder-emails.js
// ---------------------------------------------------------------------
// Single entry point for the link-based email-verification trio, which
// used to be three separate functions (api/send-verification.js,
// api/verify-email.js, api/user-emails.js). Merged for the same reason as
// api/auth-otp.js — the Vercel Hobby plan caps a deployment at 12
// Serverless Functions. See that file's header for the full rationale.
//
// The public URLs are UNCHANGED; vercel.json rewrites them here:
//
//   POST   /api/send-verification  ->  ?action=send-verification
//   GET    /api/verify-email       ->  ?action=verify-email   (+ &token=…)
//   GET/POST/DELETE /api/user-emails -> ?action=user-emails
//
// Two things to know about the shapes involved, because they are not
// uniform and a naive merge would have broken them:
//
//   * verify-email is a GET that a human clicks from an email and it
//     replies with an HTML page, not JSON. Links in already-delivered
//     inboxes point at /api/verify-email?token=…, so that path has to keep
//     working indefinitely. Vercel rewrites preserve the caller's original
//     query string and merge the destination's on top, so `token` still
//     arrives alongside `action`.
//   * user-emails distinguishes its own operations by HTTP METHOD
//     (GET list / POST add / DELETE remove), so it keeps that internal
//     dispatch. This file only routes on `action`.
//
// The mobile app already in the stores calls /api/send-verification and
// /api/user-emails by URL, so the rewrite layer is load-bearing.
// =====================================================================

import { handler as sendVerification } from './_lib/flows/send-verification.js';
import { handler as verifyEmail } from './_lib/flows/verify-email.js';
import { handler as userEmails } from './_lib/flows/user-emails.js';

const ROUTES = {
  'send-verification': sendVerification,
  'verify-email': verifyEmail,
  'user-emails': userEmails,
};

export default async function handler(req, res) {
  const action = String(req.query?.action || '');
  const flow = ROUTES[action];

  if (!flow) {
    console.error('[API reminder-emails] Unknown action:', action);
    return res.status(404).json({ error: 'Not found.' });
  }

  // Deliberately NOT setting CORS here the way auth-otp.js does:
  // verify-email renders an HTML page for a browser navigation, and the
  // other two set their own headers already. Adding a blanket
  // Access-Control-Allow-Origin to an HTML response would be noise.
  return flow(req, res);
}
