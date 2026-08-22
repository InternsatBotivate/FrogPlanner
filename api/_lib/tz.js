// =====================================================================
// FrogPlanner — timezone resolution for scheduled jobs
// Location: api/_lib/tz.js
// ---------------------------------------------------------------------
// `users.timezone` is only stamped when a user opts into weather-based
// reminders (remindersService.saveUserLocation) — which is optional. So a
// NULL timezone is the NORMAL state for anyone who never set a location,
// not a rare edge case: at the time of writing, 26 of 45 accounts (and 5
// of 20 reminder-enabled ones) have no timezone.
//
// Falling back to 'UTC' quietly broke every local-hour gate for those
// users. The nudge sweep runs at 13:45 UTC to hit the IST evening; read as
// UTC that's 13:00 local, below EVENING_HOUR (18), so the procrastination
// and streak nudges could never fire for them. The weekly review's
// "is it their Monday" check had the same blind spot.
//
// Defaulting to IST rather than UTC because the user base is India-based
// (every non-null value is Asia/Calcutta or Asia/Kolkata) — so it's the
// best available guess, not a neutral one. Revisit if that changes.
// =====================================================================

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

/** A user's IANA timezone, or the app default when unset/blank. */
export function userTimezone(user) {
  const tz = user?.timezone;
  return typeof tz === 'string' && tz.trim() ? tz : DEFAULT_TIMEZONE;
}

/** Local YYYY-MM-DD in the given timezone. */
export function localDateStr(tz) {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
  } catch {
    // Invalid/unknown IANA name stored on the row: fall back rather than throw.
    return new Date().toLocaleDateString('en-CA', { timeZone: DEFAULT_TIMEZONE });
  }
}

/** Local hour (0-23) in the given timezone. */
export function localHourNum(tz) {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(new Date()),
    );
  } catch {
    return Number(
      new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: DEFAULT_TIMEZONE }).format(
        new Date(),
      ),
    );
  }
}
