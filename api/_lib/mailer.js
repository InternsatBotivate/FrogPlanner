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

const SITE_URL = 'https://www.frogplanner.com';
const LOGO_URL = `${SITE_URL}/frog-logo-email.png`;
/**
 * Computed per call, not at module load: a warm serverless instance can live
 * across a new year, and a cached constant would then stamp last year onto
 * every email it sent.
 */
const currentYear = () => new Date().getUTCFullYear();

// Shared header/footer chrome for every transactional email. Keep layout
// table-based and styles inline so it degrades cleanly in strict mail clients.
// `bodyHtml` is the template-specific content (OTP, verify CTA, reminders…).
export function emailShell(bodyHtml, { eyebrow = 'Focused daily planning', previewText = '' } = {}) {
  const preheader = escapeHtml(previewText);
  const safeEyebrow = escapeHtml(eyebrow);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>Frog Planner</title>
    <style>
      @media only screen and (max-width:620px) {
        .email-bg { background-image: linear-gradient(180deg,#103f2d 0,#103f2d 170px,#e8f0eb 170px,#e8f0eb 100%) !important; }
        .email-wrap { padding: 14px 8px 24px !important; }
        .email-card { border-radius: 16px !important; }
        .email-header { padding: 20px 19px 18px !important; }
        .email-content { padding: 26px 20px 28px !important; }
        .email-footer { padding: 18px 20px 20px !important; }
        .brand-logo-cell { width: 54px !important; }
        .brand-logo { width: 44px !important; height: 44px !important; }
        .brand-title { font-size: 18px !important; line-height: 22px !important; }
        .brand-tagline { font-size: 9px !important; line-height: 13px !important; letter-spacing: 1.05px !important; }
        .email-eyebrow { margin-bottom: 14px !important; font-size: 9px !important; letter-spacing: 1.25px !important; }
        .email-heading { font-size: 24px !important; line-height: 30px !important; letter-spacing: -0.45px !important; }
        .email-copy { font-size: 14px !important; line-height: 22px !important; }
        .code-cell { padding: 18px 10px !important; }
        .code-value { font-size: 28px !important; line-height: 34px !important; letter-spacing: 5px !important; }
        .cta-table { width: 100% !important; }
        .cta-link { display: block !important; padding: 14px 12px !important; text-align: center !important; }
        .footer-main, .footer-links { display: block !important; width: 100% !important; text-align: left !important; }
        .footer-links { padding-top: 12px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#e8f0eb;color:#102118;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preheader}&#847; &zwnj;&nbsp;&#847; &zwnj;&nbsp;&#847;</div>
    <table role="presentation" class="email-bg" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#e8f0eb" style="width:100%;background-color:#e8f0eb;background-image:linear-gradient(180deg,#103f2d 0,#103f2d 220px,#e8f0eb 220px,#e8f0eb 100%);">
      <tr>
        <td class="email-wrap" align="center" style="padding:32px 16px;">
          <table role="presentation" class="email-card" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:580px;background:#ffffff;border:1px solid #dce7e0;border-radius:22px;overflow:hidden;box-shadow:0 12px 36px rgba(16,75,52,0.08);">
            <tr><td height="5" style="height:5px;background:#f2c94c;font-size:0;line-height:0;">&nbsp;</td></tr>
            <tr>
              <td class="email-header" bgcolor="#143f2d" style="padding:26px 34px 22px;background:#143f2d;border-bottom:1px solid #285440;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="brand-logo-cell" width="62" valign="middle" style="width:62px;">
                      <a href="${SITE_URL}" aria-label="Open Frog Planner" style="text-decoration:none;">
                        <img class="brand-logo" src="${LOGO_URL}" width="52" height="52" alt="Frog Planner" style="display:block;width:52px;height:52px;border:0;outline:none;object-fit:contain;" />
                      </a>
                    </td>
                    <td valign="middle">
                      <a href="${SITE_URL}" style="color:#ffffff;text-decoration:none;">
                        <div class="brand-title" style="font-size:20px;line-height:24px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;">Frog Planner</div>
                        <div class="brand-tagline" style="margin-top:4px;font-size:10px;line-height:14px;font-weight:700;letter-spacing:1.45px;text-transform:uppercase;color:#c9d8ce;">Tackle Your Frog First</div>
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-content" style="padding:32px 34px 34px;color:#425249;font-size:15px;line-height:24px;">
                <div class="email-eyebrow" style="margin:0 0 18px;font-size:10px;line-height:14px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#1f7a52;">
                  <span style="display:inline-block;width:22px;height:3px;margin:0 9px 3px 0;background:#f2c94c;border-radius:3px;"></span>${safeEyebrow}
                </div>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td class="email-footer" style="padding:22px 34px 24px;background:#f8faf8;border-top:1px solid #e5ece7;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="footer-main" style="font-size:11px;line-height:18px;color:#7a8a80;">
                      <strong style="color:#425249;">Powered by Botivate</strong><br />
                      &copy; ${currentYear()} Botivate. All rights reserved.
                    </td>
                    <td class="footer-links" align="right" valign="top" style="font-size:11px;line-height:18px;white-space:nowrap;">
                      <a href="${SITE_URL}" style="color:#1f6f4b;text-decoration:none;font-weight:700;">frogplanner.com</a><br />
                      <a href="${SITE_URL}/privacy-policy" style="color:#7a8a80;text-decoration:underline;">Privacy</a>
                      <span style="color:#b4c0b8;">&nbsp;&middot;&nbsp;</span>
                      <a href="${SITE_URL}/terms-of-service" style="color:#7a8a80;text-decoration:underline;">Terms</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value) {
  return String(value || '').replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
}
