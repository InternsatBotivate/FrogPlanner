/**
 * PrivacyPolicy.jsx — public, no-auth privacy policy page.
 * ──────────────────────────────────────────────────────────────────────────
 * Reachable at /privacy-policy WITHOUT logging in (required by Google for the
 * OAuth consent screen to move to production/verified). The content must stay
 * accurate to what the app actually does with Google user data — currently the
 * `calendar.events` scope (read + write of the user's Google Calendar events).
 * ──────────────────────────────────────────────────────────────────────────
 */
import React from 'react';
import { Link } from 'react-router-dom';
import FrogLogo from '../../components/FrogLogo';

const EFFECTIVE_DATE = 'July 18, 2026';
const CONTACT_EMAIL = 'info@botivate.in';
const APP_NAME = 'FrogPlanner';
const COMPANY = 'Botivate';
const DOMAIN = 'frogplanner.in';

function Section({ title, children }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold text-gray-800">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-gray-600">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-5 py-10">
        {/* Header */}
        <div className="flex items-center gap-3">
          <FrogLogo size={40} />
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">Privacy Policy</h1>
            <p className="text-xs text-gray-500">
              {APP_NAME} by {COMPANY} · Effective {EFFECTIVE_DATE}
            </p>
          </div>
        </div>

        <p className="mt-6 text-sm leading-relaxed text-gray-600">
          This Privacy Policy explains how {COMPANY} (“we”, “us”, “our”) collects, uses, and protects
          your information when you use {APP_NAME} (the “App”), available on the web at {DOMAIN} and as
          a mobile application. By using {APP_NAME}, you agree to the practices described here.
        </p>

        <Section title="1. Information We Collect">
          <p>We collect only the information needed to provide the App’s planning features:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Account information:</strong> a username and password you create, and optional
              profile details (name, role, organization) you choose to add.
            </li>
            <li>
              <strong>Your planner content:</strong> tasks, recurring tasks, projects, notes, categories,
              completion status, and optional health-tracking entries you enter into the App.
            </li>
            <li>
              <strong>Google account data (only if you connect Google Calendar):</strong> your Google
              email address and your Google Calendar events, as described in Section 3.
            </li>
          </ul>
        </Section>

        <Section title="2. How We Use Your Information">
          <ul className="list-disc space-y-1 pl-5">
            <li>To authenticate you and keep you signed in.</li>
            <li>To store, display, and let you manage your tasks, projects, and planner data.</li>
            <li>To power in-app features such as the daily planner, calendar view, and AI assistant.</li>
            <li>To display and, when you ask, add or update your Google Calendar events (see Section 3).</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your personal information, and we do not use your data for
            advertising.
          </p>
        </Section>

        <Section title="3. Google Calendar Data and Google API Services">
          <p>
            If you choose to connect your Google Calendar, {APP_NAME} requests the{' '}
            <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
              https://www.googleapis.com/auth/calendar.events
            </code>{' '}
            scope. This lets the App:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Read your calendar events so they can be shown alongside your planner tasks.</li>
            <li>Create or update calendar events on your behalf when you choose to do so in the App.</li>
          </ul>
          <p>
            Connecting Google Calendar is entirely optional and the App is fully usable without it.
            Google Calendar events are retrieved live and held only temporarily in your browser or device
            session to display them; they are cleared when you sign out. We store a minimal connection
            record (your Google email and a connection reference) solely to let you re-connect without
            signing in to Google each time. We do not store the full contents of your calendar on our
            servers, and we never share your Google Calendar data with third parties.
          </p>
          <p className="rounded-lg border border-green-200 bg-green-50 p-3 text-gray-700">
            {APP_NAME}’s use and transfer of information received from Google APIs adheres to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-green-700 underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements.
          </p>
        </Section>

        <Section title="4. How We Store and Protect Your Data">
          <p>
            Your account and planner data are stored in our managed database provider (Supabase, built on
            PostgreSQL). Access is restricted to your own account. We use industry-standard measures to
            protect your data, though no method of transmission or storage is completely secure.
          </p>
        </Section>

        <Section title="5. Data Sharing">
          <p>
            We do not sell or rent your personal information. We share data only with the service
            providers that operate the App on our behalf (such as our database host and, where you use
            the AI assistant, our AI processing provider), and only to the extent needed to provide the
            service. We may disclose information if required by law.
          </p>
        </Section>

        <Section title="6. Data Retention and Deletion">
          <p>
            We keep your data for as long as your account is active. You can delete individual tasks,
            projects, or your Google Calendar connection at any time within the App. To delete your
            account and all associated data, or to revoke Google Calendar access, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 underline">
              {CONTACT_EMAIL}
            </a>
            . You can also revoke {APP_NAME}’s access to your Google account at any time via your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-green-700 underline"
            >
              Google Account permissions
            </a>
            .
          </p>
        </Section>

        <Section title="7. Children’s Privacy">
          <p>{APP_NAME} is not directed to children under 13, and we do not knowingly collect data from them.</p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. Material changes will be reflected by an
            updated effective date at the top of this page.
          </p>
        </Section>

        <Section title="9. Contact Us">
          <p>
            If you have questions about this Privacy Policy or your data, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 underline">
              {CONTACT_EMAIL}
            </a>
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
