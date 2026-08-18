/**
 * DeleteAccount.jsx — public, no-auth account & data deletion page.
 * ──────────────────────────────────────────────────────────────────────────
 * Reachable at /delete-account WITHOUT logging in. Google Play / Apple require
 * a publicly accessible URL that explains how a user deletes their account and
 * associated data, what is deleted, and any limited retention — even though the
 * primary path is now in-app self-service (Settings → Delete Account, see
 * DeleteAccountModal.jsx + api/delete-account.js). This page documents that
 * in-app flow plus an email fallback for users who can't sign in.
 * Keep this consistent with /privacy-policy §6 (Data Retention and Deletion).
 * ──────────────────────────────────────────────────────────────────────────
 */
import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import FrogLogo from '../../components/FrogLogo';

const EFFECTIVE_DATE = 'August 14, 2026';
const CONTACT_EMAIL = 'info@botivate.in';
const APP_NAME = 'Frog Planner';
const COMPANY = 'Botivate';

const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'Frog Planner account deletion request',
)}&body=${encodeURIComponent(
  'Please delete my Frog Planner account and all associated data.\n\n' +
    'Account email / username: \n' +
    '(Send this request from the email on your account, or include your username so we can verify it.)',
)}`;

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export default function DeleteAccount() {
  const contentRef = useRef(null);

  const handlePrint = () => window.print();

  /**
   * Downloads the page as a standalone HTML file — no PDF library, so no new
   * dependency. Mirrors PrivacyPolicy.jsx's download behavior.
   */
  const handleDownload = () => {
    const bodyHtml = contentRef.current?.innerHTML || '';
    const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${APP_NAME} Account Deletion — Updated ${EFFECTIVE_DATE}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #1f2937; max-width: 720px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
  h1 { font-size: 24px; margin-bottom: 4px; }
  h2 { font-size: 17px; margin-top: 28px; }
  ul { padding-left: 20px; }
  a { color: #15803d; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;

    const blob = new Blob([doc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${APP_NAME.toLowerCase()}-account-deletion.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <FrogLogo className="w-40 h-40 flex-shrink-0 select-none" />
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900">Delete Your Account</h1>
              <p className="text-xs text-gray-500">
                {APP_NAME} by {COMPANY} · Updated {EFFECTIVE_DATE}
              </p>
            </div>
          </div>

          <div className="flex gap-2 print:hidden flex-shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              aria-label="Print page"
              title="Print page"
              className="rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-100"
            >
              <Printer size={18} />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Download page"
              title="Download page"
              className="rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-100"
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        <div ref={contentRef}>
        <p className="mt-6 text-sm leading-relaxed text-gray-600">
          You can delete your {APP_NAME} account and the data associated with it at any time, directly
          in the App. This page explains how, what gets deleted, and how to reach us if you can't sign
          in.
        </p>

        <Section title="Delete your account in the App (recommended)">
          <p>
            Go to <strong>Settings → Account Security → Delete Account</strong>, confirm you want to
            continue, then enter your password to verify it's you. Deletion happens immediately and
            cannot be undone — there is no recovery period.
          </p>
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-gray-700">
            This is the fastest way to delete your account: it does not require emailing us or waiting
            for a manual request to be processed.
          </p>
        </Section>

        <Section title="Can't sign in? Request deletion by email">
          <p>If you can no longer access your account, send a deletion request instead:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Email{' '}
              <a href={MAILTO} className="font-semibold text-green-700 underline">
                {CONTACT_EMAIL}
              </a>{' '}
              with the subject “Frog Planner account deletion request”, or
            </li>
            <li>
              Email us directly at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 underline">
                {CONTACT_EMAIL}
              </a>
              .
            </li>
          </ul>
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-gray-700">
            Please send the request from the email address on your account, or include your account
            username, so we can verify the request belongs to you. We may ask for reasonable
            verification before deleting anything.
          </p>
        </Section>

        <Section title="What gets deleted">
          <p>
            Whether you delete in-app or by request, we permanently delete your {APP_NAME} account and
            the data tied to it, including:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your account and profile details (name, username, email, phone, role/organization).</li>
            <li>Your planner content — tasks, recurring tasks, projects, project notes and files, and completion history.</li>
            <li>Reminder settings, verified reminder email addresses, and reminder history.</li>
            <li>Any saved Google Calendar connection record and stored connection email.</li>
            <li>Your active login sessions.</li>
          </ul>
        </Section>

        <Section title="What you can delete yourself first">
          <p>
            Inside the App you can also delete individual tasks or projects, and disconnect Google
            Calendar, without deleting your whole account. You can revoke {APP_NAME}’s access to your
            Google account from your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-green-700 underline"
            >
              Google Account permissions
            </a>
            . These self-service steps are optional — deleting your account removes all of it at once.
          </p>
        </Section>

        <Section title="Timing and limited retention">
          <p>
            In-app deletion is immediate. Email requests are processed within the period required by
            applicable law, and we confirm by email once complete. After deletion, we may retain a
            limited amount of information only where necessary — for example, to comply with legal
            obligations, resolve disputes, or prevent fraud and abuse — and temporary copies may persist
            in routine backups for a short period before being overwritten. We do not retain your data
            indefinitely.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about deletion or your data? Contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 underline">
              {CONTACT_EMAIL}
            </a>
            . See also our{' '}
            <Link to="/privacy-policy" className="font-semibold text-green-700 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </Section>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-5 text-xs text-gray-400 print:hidden">
          <Link to="/login" className="font-semibold text-green-700 hover:underline">
            ← Back to {APP_NAME}
          </Link>
          <span className="ml-3">© {new Date().getFullYear()} {COMPANY}. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
