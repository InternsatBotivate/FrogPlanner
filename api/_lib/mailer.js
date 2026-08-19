// =====================================================================
// FrogPlanner — Shared transactional mail sender (Resend SMTP)
// Location: api/_lib/mailer.js
// ---------------------------------------------------------------------
// One transporter for every server-side email (OTP, verification link,
// reminder digest). Uses Resend's SMTP relay via nodemailer so callers
// don't each hand-roll createTransport/auth.
//
// Required server env (Vercel, never in the client bundle):
//   RESEND_API_KEY   — Resend API key, used as the SMTP password
//   MAIL_FROM        — optional, defaults to Frog Planner <no-reply@frogplanner.in>
// =====================================================================

import nodemailer from 'nodemailer';

const DEFAULT_FROM = '"Frog Planner" <no-reply@frogplanner.in>';

let cachedTransporter = null;

function getTransporter() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Email is not configured (missing RESEND_API_KEY).');
  }
  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: { user: 'resend', pass: apiKey },
    });
  }
  return cachedTransporter;
}

export async function sendMail({ to, subject, text, html, from }) {
  const transporter = getTransporter();
  await transporter.sendMail({
    from: from || process.env.MAIL_FROM || DEFAULT_FROM,
    to,
    subject,
    text,
    html,
  });
}

const LOGO_URL = 'https://www.frogplanner.in/frog-logo-email.png';
const CURRENT_YEAR = new Date().getUTCFullYear();

// Shared header/footer chrome for every transactional email. `bodyHtml` is
// the template-specific content (OTP code, verify button, reminder list…).
export function emailShell(bodyHtml) {
  return `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#f0fdf4;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden;box-shadow:0 4px 16px rgba(22,163,74,0.08);">
      <div style="padding:28px 24px 16px;text-align:center;background:linear-gradient(180deg,#f0fdf4 0%,#ffffff 100%);">
        <img src="${LOGO_URL}" width="72" height="72" alt="Frog Planner" style="display:inline-block;" />
        <div style="margin-top:8px;font-size:19px;font-weight:800;color:#15803d;letter-spacing:-0.3px;">Frog Planner</div>
      </div>
      <div style="padding:8px 28px 28px;color:#374151;font-size:14px;line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="padding:18px 28px;background:#f9fafb;border-top:1px solid #f0f0f0;text-align:center;">
        <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;">Tackle your frog first, every day.</p>
        <p style="margin:0;font-size:11px;color:#c1c7cf;">&copy; ${CURRENT_YEAR} Frog Planner &middot; <a href="https://www.frogplanner.in" style="color:#9ca3af;text-decoration:underline;">frogplanner.in</a></p>
      </div>
    </div>
  </body></html>`;
}
