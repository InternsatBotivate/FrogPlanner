/**
 * DeleteAccount.jsx — public, no-auth account & data deletion page.
 * ──────────────────────────────────────────────────────────────────────────
 * Reachable at /delete-account WITHOUT logging in. Google Play requires a
 * publicly accessible URL that explains how a user requests deletion of their
 * account and associated data, what is deleted, and any limited retention.
 * Keep this consistent with /privacy-policy §6 (Data Retention and Deletion).
 * ──────────────────────────────────────────────────────────────────────────
 */
import React from 'react';
import { Link } from 'react-router-dom';
import FrogLogo from '../../components/FrogLogo';

const EFFECTIVE_DATE = 'August 10, 2026';
const CONTACT_EMAIL = 'info@botivate.in';
const APP_NAME = 'FrogPlanner';
const COMPANY = 'Botivate';

const MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
  'FrogPlanner account deletion request',
)}&body=${encodeURIComponent(
  'Please delete my FrogPlanner account and all associated data.\n\n' +
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
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <FrogLogo className="w-8 h-8 flex-shrink-0 select-none" />
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Delete Your Account</h1>
            <p className="text-xs text-gray-500">
              {APP_NAME} by {COMPANY} · Updated {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-gray-600">
          You can request deletion of your {APP_NAME} account and the data associated with it at any
          time. This page explains how to make that request and what happens to your data.
        </p>

        <Section title="How to request deletion">
          <p>Send an account-deletion request in either of these ways:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Email{' '}
              <a href={MAILTO} className="font-semibold text-green-700 underline">
                {CONTACT_EMAIL}
              </a>{' '}
              with the subject “FrogPlanner account deletion request”, or
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
            Once your request is verified, we delete your {APP_NAME} account and the personal data tied
            to it, including:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your account and profile details (name, username, email, phone, role/organization).</li>
            <li>Your planner content — tasks, recurring tasks, projects, notes, categories, and completion history.</li>
            <li>Optional health-tracking entries (meals, water, and mood check-ins).</li>
            <li>Reminder settings, verified reminder email addresses, and reminder history.</li>
            <li>Any saved Google Calendar connection record and stored connection email.</li>
          </ul>
        </Section>

        <Section title="What you can delete yourself first">
          <p>
            Inside the App you can delete individual tasks, projects, and health entries, and you can
            disconnect Google Calendar at any time. You can also revoke {APP_NAME}’s access to your
            Google account from your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-green-700 underline"
            >
              Google Account permissions
            </a>
            . These self-service steps are optional — a full account-deletion request removes all of it.
          </p>
        </Section>

        <Section title="Timing and limited retention">
          <p>
            We process valid deletion requests within the period required by applicable law, and we will
            confirm by email when the request is complete. After deletion, we may retain a limited amount
            of information only where necessary — for example, to comply with legal obligations, resolve
            disputes, or prevent fraud and abuse — and temporary copies may persist in routine backups
            for a short period before being overwritten. We do not retain your data indefinitely.
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

        <div className="mt-10 border-t border-gray-200 pt-5 text-xs text-gray-400">
          <Link to="/login" className="font-semibold text-green-700 hover:underline">
            ← Back to {APP_NAME}
          </Link>
          <span className="ml-3">© {new Date().getFullYear()} {COMPANY}. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
