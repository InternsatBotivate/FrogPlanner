// =====================================================================
// FrogPlanner — nudge copy (server-side subset)
// Location: api/_lib/nudgeCopy.js
// ---------------------------------------------------------------------
// A deliberate DUPLICATE of the categories api/send-nudges.js uses from
// FrogPlanner_App/src/lib/notificationCopy.ts, so remote nudges speak in
// the same voice as the app's local notifications.
//
// Why duplicated rather than shared: the pool lives in the mobile repo and
// the cron lives here. A shared package for two consumers is more
// indirection than it earns. If you change a line in one place, change it
// in the other — these five categories only.
// =====================================================================

/** Rotate deterministically per (user, day) so a user isn't sent the same line twice running. */
export function pickLine(category, seed, vars = {}) {
  const pool = POOLS[category];
  if (!pool || pool.length === 0) return null;

  // Try each line starting at a seeded offset, so a line whose placeholder we
  // can't fill is skipped rather than blanking the nudge.
  const start = Math.abs(hash(seed)) % pool.length;
  for (let i = 0; i < pool.length; i += 1) {
    const filled = fill(pool[(start + i) % pool.length], vars);
    if (filled) return filled;
  }
  return null;
}

const TOKENS = {
  '{First Name}': 'firstName',
  '{Task Name}': 'taskName',
  '{Streak Days}': 'streakDays',
  '{Completed Tasks}': 'completedTasks',
};

/** Returns null when a placeholder can't be filled, so the caller skips the line. */
function fill(message, vars) {
  let out = message;
  for (const [token, key] of Object.entries(TOKENS)) {
    if (!out.includes(token)) continue;
    const value = vars[key];
    if (value === undefined || value === null || value === '') return null;
    out = out.split(token).join(String(value));
  }
  return out;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < String(str).length; i += 1) {
    h = (h << 5) - h + String(str).charCodeAt(i);
    h |= 0;
  }
  return h;
}

const POOLS = {
  streak: [
    '{Streak Days} days of showing up—keep going.',
    'Your {Streak Days}-day streak is waiting for today’s Frog.',
    'Don’t break the chain. One task keeps it alive.',
    'Your consistency is becoming your advantage.',
    '{Streak Days} days strong. Aaj bhi ek task kar lo.',
  ],
  comeback: [
    'Long time, no Frog. Ready to restart?',
    'No judgement. Your fresh start is one tap away.',
    'Productivity se break hua tha. Start again with one task.',
    'Come back. Choose one task. Start again.',
    'You don’t need a perfect week—just a better next step.',
  ],
  overdue: [
    'Task miss hua hai—goal nahi. Reschedule and restart.',
    'No guilt. Just choose the next action.',
    'Your task is overdue. Complete, reschedule or remove it.',
    'Missed yesterday? Start fresh today.',
    'Delay happened. Ab next step decide karo.',
  ],
  procrastination: [
    'Jo kaam avoid kar rahe ho, shayad wahi tumhara Frog hai.',
    'Delay se task chhota nahi hota.',
    'Don’t wait to feel ready. Start before you’re ready.',
    '20 focused minutes can change your entire day.',
    'Your Frog is still waiting: {Task Name}',
  ],
  completion: [
    'Frog completed. Today’s biggest win is yours.',
    'Done! You completed what mattered most.',
    'Big task. Bigger win. Well done!',
    'Frog complete—ab din halka lagega.',
    'You didn’t just stay busy. You made progress.',
  ],
};
