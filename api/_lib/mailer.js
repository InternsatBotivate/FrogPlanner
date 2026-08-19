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
