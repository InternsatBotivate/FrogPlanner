/**
 * taskTime.js — formatting and maths for a task's optional clock time.
 * ──────────────────────────────────────────────────────────────────────────
 * Mirrors FrogPlanner_App/src/utils/taskTime.ts. Keep the two in step: a task
 * showing "7:00 AM – 7:20 AM" on web and something else on mobile reads as a
 * bug.
 *
 * Storage contract (db_scripts/task_start_time.sql):
 *   start_time        Postgres `time`, surfaced over REST as 'HH:MM:SS'
 *   duration_minutes  smallint, 1..1440, optional
 *
 * "Ends At" is never stored — it's derived here, so it can't disagree with
 * the start time and duration it came from.
 * ──────────────────────────────────────────────────────────────────────────
 */

/** Minutes since midnight from 'HH:MM' or 'HH:MM:SS'. Null if unparseable. */
export const parseTimeToMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
};

/** 'HH:MM' for storage, from minutes since midnight. */
export const minutesToTimeString = (minutes) => {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return null;
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** '7:00 AM' for display. Returns '' for no/invalid time, never 'Invalid Date'. */
export const formatTime12h = (value) => {
  const mins = parseTimeToMinutes(value);
  if (mins === null) return '';
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h24 < 12 ? 'AM' : 'PM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};

/**
 * End time as 'HH:MM', or null when either input is missing.
 *
 * Wraps past midnight rather than clamping: a 30-minute task at 23:50 ends at
 * 00:20. Clamping to 23:59 would quietly show the wrong end time.
 */
export const computeEndTime = (startTime, durationMinutes) => {
  const start = parseTimeToMinutes(startTime);
  if (start === null) return null;
  const dur = Number(durationMinutes);
  if (!Number.isFinite(dur) || dur <= 0) return null;
  return minutesToTimeString(start + dur);
};

/** '7:00 AM – 7:20 AM', or just '7:00 AM' with no duration, or '' with no time. */
export const formatTimeRange = (startTime, durationMinutes) => {
  const start = formatTime12h(startTime);
  if (!start) return '';
  const end = formatTime12h(computeEndTime(startTime, durationMinutes));
  return end ? `${start} – ${end}` : start;
};

/** '20 min' / '1 h' / '1 h 30 min'. '' when unset. */
export const formatDuration = (durationMinutes) => {
  const dur = Number(durationMinutes);
  if (!Number.isFinite(dur) || dur <= 0) return '';
  const h = Math.floor(dur / 60);
  const m = dur % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
};

/** Clamp to the DB constraint (1..1440). Null for anything not a real length. */
export const normalizeDurationMinutes = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, 1440);
};

/** Preset lengths offered in the UI. */
export const DURATION_PRESETS = [5, 10, 15, 20, 30, 45, 60, 90, 120];

/**
 * Which slot a clock time falls in, matching SLOT_NOTIFY_HOUR's intent in the
 * mobile notification scheduler. Used to warn when a chosen time contradicts
 * the chosen slot — not to overwrite it, since the slot stays user-owned.
 */
export const slotForTime = (value) => {
  const mins = parseTimeToMinutes(value);
  if (mins === null) return null;
  const h = Math.floor(mins / 60);
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  if (h < 21) return 'Evening';
  return 'Night';
};
