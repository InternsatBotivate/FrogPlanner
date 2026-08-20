/**
 * TermsOfService.jsx — public, no-auth terms-of-service page.
 * ──────────────────────────────────────────────────────────────────────────
 * Reachable at /terms-of-service WITHOUT logging in, mirroring
 * PrivacyPolicy.jsx's structure (same header/print/download pattern) so the
 * two legal pages stay visually and factually consistent — same app name,
 * company, domain, contact email, and description of what the app actually
 * does (planner + optional Google Calendar sync + AI assistant).
 * ──────────────────────────────────────────────────────────────────────────
 */
import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Download, Printer } from 'lucide-react';
import FrogLogo from '../../components/FrogLogo';

const EFFECTIVE_DATE = 'August 21, 2026';
const CONTACT_EMAIL = 'info@botivate.in';
const APP_NAME = 'Frog Planner';
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

export default function TermsOfService() {
  const contentRef = useRef(null);

  const handlePrint = () => window.print();

  const handleDownload = () => {
    const bodyHtml = contentRef.current?.innerHTML || '';
    const doc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${APP_NAME} Terms of Service — Effective ${EFFECTIVE_DATE}</title>
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
    link.download = `${APP_NAME.toLowerCase()}-terms-of-service.html`;
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
              <h1 className="text-2xl font-extrabold text-gray-900">Terms of Service</h1>
              <p className="text-xs text-gray-500">
                {APP_NAME} by {COMPANY} · Effective {EFFECTIVE_DATE}
              </p>
            </div>
          </div>

          <div className="flex gap-2 print:hidden flex-shrink-0">
            <button
              type="button"
              onClick={handlePrint}
              aria-label="Print terms"
              title="Print terms"
              className="rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-100"
            >
              <Printer size={18} />
            </button>
            <button
              type="button"
              onClick={handleDownload}
              aria-label="Download terms"
              title="Download terms"
              className="rounded-lg border border-gray-300 p-2 text-gray-600 transition-colors hover:bg-gray-100"
            >
              <Download size={18} />
            </button>
          </div>
        </div>

        <div ref={contentRef}>

        <p className="mt-6 text-sm leading-relaxed text-gray-600">
          These Terms of Service (“Terms”) govern your use of {APP_NAME} (the “App”), provided by{' '}
          {COMPANY} (“we”, “us”, “our”), available on the web at {DOMAIN} and as a mobile application.
          By creating an account or using {APP_NAME}, you agree to these Terms. If you do not agree,
          please do not use the App.
        </p>

        <Section title="1. The Service">
          <p>
            {APP_NAME} is a daily task-planning tool built around the “Tackle Your Frog First” method —
            it helps you identify, schedule, and track your most important task each day, along with
            supporting priorities, recurring tasks, projects, and optional health-tracking entries.
            Optional features include connecting your Google Calendar to view and sync events, and an
            AI assistant that can read and manage your planner data on request.
          </p>
        </Section>

        <Section title="2. Accounts">
          <ul className="list-disc space-y-1 pl-5">
            <li>You must provide accurate information when creating an account and keep your login credentials confidential.</li>
            <li>You are responsible for all activity that happens under your account.</li>
            <li>You must be at least 13 years old to use {APP_NAME}.</li>
            <li>
              You may sign in with a username and password, or with Google Sign-In. If you sign in with
              Google, we rely on Google to verify your identity for that sign-in method.
            </li>
          </ul>
        </Section>

        <Section title="3. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Use the App for any unlawful purpose or in violation of these Terms.</li>
            <li>Attempt to gain unauthorized access to another user’s account or data.</li>
            <li>Interfere with or disrupt the App’s infrastructure or servers.</li>
            <li>Reverse-engineer, scrape, or resell the App or its underlying data without our permission.</li>
            <li>Use the AI assistant to attempt to extract, abuse, or overload the underlying AI provider.</li>
          </ul>
        </Section>

        <Section title="4. Your Content">
          <p>
            You retain ownership of the tasks, projects, notes, and other content you create in the App
            (“Your Content”). By using the App, you grant us a limited license to store, process, and
            display Your Content solely to provide the service to you. We do not claim ownership of Your
            Content and do not sell it.
          </p>
        </Section>

        <Section title="5. Google Calendar and Third-Party Services">
          <p>
            If you choose to connect your Google Calendar, {APP_NAME} accesses your calendar events only
            to the extent you authorize, as described in our{' '}
            <Link to="/privacy-policy" className="font-semibold text-green-700 underline">
              Privacy Policy
            </Link>
            . This connection is optional, can be disconnected at any time from within the App, and{' '}
            {APP_NAME}’s use of Google user data adheres to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-green-700 underline"
            >
              Google API Services User Data Policy
            </a>
            . The App also relies on third-party infrastructure (such as our database and AI processing
            providers) to operate; your use of the App is subject to those providers functioning normally,
            and we are not responsible for outages or issues caused by third-party services outside our
            control.
          </p>
        </Section>

        <Section title="6. AI Assistant">
          <p>
            The AI assistant is provided as a convenience feature to help you manage your planner. It may
            occasionally produce inaccurate or unexpected responses. You are responsible for reviewing any
            task, event, or data change the assistant makes on your behalf before relying on it.
          </p>
        </Section>

        <Section title="7. Availability and Changes to the Service">
          <p>
            We aim to keep {APP_NAME} available and reliable, but we do not guarantee uninterrupted access.
            We may modify, suspend, or discontinue features of the App at any time, with or without notice,
            though we will try to avoid disruption where reasonably possible.
          </p>
        </Section>

        <Section title="8. Termination">
          <p>
            You may stop using the App and delete your account at any time from{' '}
            <strong>Settings → Account Security → Delete Account</strong>, or via our{' '}
            <Link to="/delete-account" className="font-semibold text-green-700 underline">
              account deletion page
            </Link>{' '}
            if you can’t sign in. We may suspend or terminate your access if you violate these Terms or
            use the App in a way that risks harm to us, other users, or third parties.
          </p>
        </Section>

        <Section title="9. Disclaimers and Limitation of Liability">
          <p>
            The App is provided “as is” and “as available,” without warranties of any kind, express or
            implied. To the fullest extent permitted by law, {COMPANY} is not liable for any indirect,
            incidental, or consequential damages arising from your use of the App, including missed tasks,
            data loss, or reliance on AI-generated suggestions. Nothing in these Terms limits liability
            that cannot be limited under applicable law.
          </p>
        </Section>

        <Section title="10. Changes to These Terms">
          <p>
            We may update these Terms from time to time. Material changes will be reflected by an updated
            effective date at the top of this page. Continued use of the App after changes take effect
            means you accept the updated Terms.
          </p>
        </Section>

        <Section title="11. Contact Us">
          <p>
            If you have questions about these Terms, contact us at{' '}
            <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-green-700 underline">
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </Section>
        </div>

        <div className="mt-10 border-t border-gray-200 pt-5 text-xs text-gray-400 print:hidden">
          <Link to="/login" className="font-semibold text-green-700 hover:underline">
            ← Back to {APP_NAME}
          </Link>
          <span className="mx-3">·</span>
          <Link to="/privacy-policy" className="font-semibold text-green-700 hover:underline">
            Privacy Policy
          </Link>
          <span className="ml-3">© {new Date().getFullYear()} {COMPANY}. All rights reserved.</span>
        </div>
      </div>
    </div>
  );
}
