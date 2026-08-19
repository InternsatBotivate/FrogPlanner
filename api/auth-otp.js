// =====================================================================
// Frog Planner — OTP auth dispatcher (Vercel Serverless Node.js Function)
// Location: api/auth-otp.js
// ---------------------------------------------------------------------
// Single entry point for the four OTP flows, which used to be four
// separate functions (api/send-otp.js, verify-otp.js, reset-password.js,
// change-password.js). They were merged because the Vercel Hobby plan
// caps a deployment at 12 Serverless Functions and adding Google sign-in
// took us to 14 — the deploy failed with
// `exceeded_serverless_functions_per_deployment`.
//
// The public URLs are UNCHANGED. vercel.json rewrites each original path
// onto this function with an `action` query param:
//
//   POST /api/send-otp         ->  /api/auth-otp?action=send-otp
//   POST /api/verify-otp       ->  /api/auth-otp?action=verify-otp
//   POST /api/reset-password   ->  /api/auth-otp?action=reset-password
//   POST /api/change-password  ->  /api/auth-otp?action=change-password
//
// That matters: the mobile app already shipped to the App Store and Play
// Store calls those paths by URL (see FrogPlanner_App/src/lib/otpService.ts).
// Renaming them would break clients already on people's phones, so the
// rewrite layer is load-bearing, not cosmetic.
//
// Each flow's implementation still lives in its own module under
// api/_lib/flows/ — untouched apart from becoming a named export. Files
// under an underscore-prefixed directory are not deployed as functions,
// which is what buys back the slots. Keeping them separate (rather than
// inlining four handlers here) means a mistake in one flow's setup code
// cannot leak into the other three.
// =====================================================================

import { handler as sendOtp } from './_lib/flows/send-otp.js';
import { handler as verifyOtp } from './_lib/flows/verify-otp.js';
import { handler as resetPassword } from './_lib/flows/reset-password.js';
import { handler as changePassword } from './_lib/flows/change-password.js';

const ROUTES = {
  'send-otp': sendOtp,
  'verify-otp': verifyOtp,
  'reset-password': resetPassword,
  'change-password': changePassword,
};

export default async function handler(req, res) {
  // Set CORS up front so even an unknown-action error is readable by the
  // browser. Each flow sets these too; setHeader overwrites rather than
  // appends, so the duplication is harmless.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  const action = String(req.query?.action || '');
  const flow = ROUTES[action];

  if (!flow) {
    // Only reachable if vercel.json and this map disagree — a deploy-time
    // wiring bug, not something a caller can trigger through a real path.
    console.error('[API auth-otp] Unknown action:', action);
    return res.status(404).json({ error: 'Not found.' });
  }

  return flow(req, res);
}
