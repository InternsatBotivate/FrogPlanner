/**
 * taskSort.js — shared ordering for a day's task list.
 * ──────────────────────────────────────────────────────────────────────────
 * Mirrors FrogPlanner_App/src/utils/planner.ts (SLOT_ORDER / slotRank /
 * compareTasksForDay) so web, mobile and the Android widget all present a
 * day in the same order. Showing different orders across platforms reads as
 * a bug, so keep these in step if either changes.
 * ──────────────────────────────────────────────────────────────────────────
 */

/**
 * Chronological rank of each time slot.
 *
 * A map rather than an array + indexOf: 'All Day' is a real stored value, and
 * indexOf would return -1 for anything unlisted, floating those tasks to the
 * TOP instead of the bottom. 'All Day' sorts last, matching the order the
 * Android widget has always used.
 */
export const SLOT_ORDER = {
  Morning: 0,
  Afternoon: 1,
  Evening: 2,
  Night: 3,
  'All Day': 4,
};

/** Unknown/blank slots sort last rather than first. */
export const slotRank = (duration) => SLOT_ORDER[duration ?? ''] ?? 9;

/**
 * Standard ordering for a single day: the Frog first (it's the task meant to
 * be done before anything else), then chronologically by time slot.
 *
 * The day lists previously sorted ONLY by Frog and returned 0 for everything
 * else, so non-Frog tasks kept whatever order the fetch returned — a Night
 * task could sit above a Morning one.
 */
export const compareTasksForDay = (a, b) => {
  const aFrog = a.priority === 'Frog';
  const bFrog = b.priority === 'Frog';
  if (aFrog !== bFrog) return aFrog ? -1 : 1;
  return slotRank(a.duration) - slotRank(b.duration);
};
