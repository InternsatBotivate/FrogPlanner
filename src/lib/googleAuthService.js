/**
 * googleAuthService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Google Sign-In (authentication) for the web app.
 *
 * NOT to be confused with googleCalendarService.js / useGoogleCalendar.js.
 * Those use `google.accounts.oauth2` to get an ACCESS token — permission to
 * read the user's calendar. This uses `google.accounts.id` to get an ID token —
 * a signed assertion of WHO the user is. Different primitive, different purpose:
 * an access token can't authenticate anyone, and an ID token can't call an API.
 *
 * The ID token goes straight to /api/google-signin, the only place it is
 * trusted (see that file's header for why verification must be server-side).
 *
 * Why renderButton and not One Tap `prompt()`:
 * One Tap is unreliable in practice — it silently declines to display when
 * third-party cookies are blocked, when the user dismissed it recently, or
 * mid-FedCM-transition, leaving a button that appears to do nothing. Google's
 * rendered button always works, at the cost of using Google's own styling. For
 * the single control standing between a user and their account, reliability
 * wins over pixel-matching the design system.
 *
 * Exposes:
 *   isGoogleAuthConfigured() — whether a client ID is present at all
 *   renderGoogleButton(el, onCredential, opts) — draws Google's button into
 *                              `el` and calls back with an ID token
 * ──────────────────────────────────────────────────────────────────────────
 */

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

export const isGoogleAuthConfigured = () => !!GOOGLE_CLIENT_ID;

// ── Load the GIS script once, shared across calls ─────────────────────
// Same singleton idea as useGoogleCalendar.js's loadGIS, but tracked with its
// own promise so a failure in one path can't leave the other waiting forever.
let gisPromise = null;
const loadGIS = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisPromise) return gisPromise;

  gisPromise = new Promise((resolve, reject) => {
    const done = () => (window.google?.accounts?.id ? resolve() : reject(new Error('Google sign-in unavailable.')));
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      // Another module already injected it; it may still be in flight.
      if (window.google?.accounts?.id) return resolve();
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = done;
    s.onerror = () => {
      gisPromise = null; // allow a later attempt to retry
      reject(new Error('Could not load Google sign-in. Check your connection.'));
    };
    document.head.appendChild(s);
  });
  return gisPromise;
};

/**
 * renderGoogleButton
 * Initializes GIS and renders Google's sign-in button into `container`.
 * `onCredential(idToken)` fires when the user completes the Google flow.
 *
 * Returns a cleanup function that empties the container, so a React effect can
 * call it on unmount and avoid a stale button from a previous render.
 */
export const renderGoogleButton = async (container, onCredential, options = {}) => {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google sign-in is not configured.');
  if (!container) return () => {};

  await loadGIS();

  window.google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: (response) => {
      if (response?.credential) onCredential(response.credential);
    },
    // Account chooser every time. auto_select would silently reuse the last
    // account, which is wrong on a shared machine and makes switching hard.
    auto_select: false,
    cancel_on_tap_outside: true,
  });

  container.innerHTML = '';
  window.google.accounts.id.renderButton(container, {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    text: 'continue_with',
    shape: 'pill',
    logo_alignment: 'left',
    // GIS needs a pixel width; it rejects '100%'. The caller measures its own
    // container so the button lines up with the form fields above it.
    width: options.width || 320,
  });

  return () => {
    container.innerHTML = '';
  };
};
