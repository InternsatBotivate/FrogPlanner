// =====================================================================
// FrogPlanner — engagement nudges (push)
// Location: api/send-nudges.js
// ---------------------------------------------------------------------
// Decides which users deserve a nudge right now and sends AT MOST ONE
// push per user per cooldown window. Reuses the copy categories the app
// already ships (see api/_lib/nudgeCopy.js).
//
// Trigger-agnostic on purpose: authenticated ONLY by the CRON_SECRET
// bearer (no Vercel cron header), stateless, and idempotent — so Supabase
// pg_cron, a Postgres trigger via pg_net, GitHub Actions or cron-job.org
// can all call it, as often as they like, without producing spam. The
// endpoint decides whether a user is due from their timezone and the
// cooldown record, never from "which run am I".
//
// Nudges, in priority order (first match wins — one push, not four):
//   procrastination  pending Frog, evening local
//   streak           active streak, nothing completed today
//   overdue          overdue pile-up past a threshold
//   comeback         no completion for N days
//
// The `completion` category is intentionally NOT here: celebrating a
// finished Frog must land seconds after the tap, so it belongs on a
// Postgres trigger (INSERT on task_completions -> pg_net), not a sweep.
//
// Query params (all optional):
//   ?type=streak     evaluate only this nudge
//   ?userId=<uuid>   evaluate only this user (testing)
//   ?dry=1           compute and report, send nothing
//
// Env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL.
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import { sendPushToUser } from './_lib/push.js';
import { pickLine } from './_lib/nudgeCopy.js';

/** Minimum hours between ANY two nudges to the same user. */
const COOLDOWN_HOURS = 20;
/** Local hour from which an unfinished Frog is worth mentioning. */
const EVENING_HOUR = 18;
/** Days with no completion before we treat a user as lapsed. */
const COMEBACK_DAYS = 4;
/** Don't chase someone who's been gone for months — that's spam, not a nudge. */
const COMEBACK_MAX_DAYS = 30;
/** Overdue tasks needed before the pile-up nudge fires. */
const OVERDUE_THRESHOLD = 5;
/** How far back to count overdue tasks. */
const OVERDUE_WINDOW_DAYS = 30;

export default async function handler(req, res) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Missing Supabase env.' });

    const onlyType = req.query?.type || null;
    const onlyUser = req.query?.userId || null;
    const dry = req.query?.dry === '1';

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let usersQuery = supabase
      .from('users')
      .select('id, full_name, timezone')
      .eq('reminders_enabled', true);
    if (onlyUser) usersQuery = usersQuery.eq('id', onlyUser);
    const { data: users, error: usersError } = await usersQuery;
    if (usersError) throw usersError;

    const results = [];
    let sent = 0;

    for (const user of users || []) {
      try {
        const decision = await evaluate(supabase, user, onlyType);
        if (!decision) continue;

        results.push({ userId: user.id, type: decision.type, message: decision.message });
        if (dry) continue;

        const push = await sendPushToUser(supabase, user.id, {
          title: 'Frog Planner',
          body: decision.message,
          data: { fpNotificationId: decision.type, route: decision.route },
        });

        // No device registered: don't burn the cooldown on a push that went
        // nowhere, or the user gets nothing once they finally install.
        if (!push || push.sent === 0) continue;

        // Cooldown is recorded only after a push actually went out.
        await supabase.from('reminders').insert({
          user_id: user.id,
          task_id: null,
          type: 'nudge',
          message: `[${decision.type}] ${decision.message}`,
          for_date: decision.localDate,
          shown: false,
          emailed: false,
        });
        sent += 1;
      } catch (e) {
        console.error('[send-nudges] failed for user:', user.id, e?.message);
      }
    }

    return res.status(200).json({
      ok: true,
      users: (users || []).length,
      candidates: results.length,
      sent,
      dry,
      ...(dry ? { preview: results.slice(0, 25) } : {}),
    });
  } catch (error) {
    console.error('[send-nudges] Error:', error);
    return res.status(500).json({ error: 'Nudges failed.' });
  }
}

/**
 * Decide this user's single most relevant nudge, or null.
 *
 * Order matters: the checks run most-actionable first and return on the first
 * hit, which is what keeps four independent conditions from becoming four
 * pushes on the same day.
 */
async function evaluate(supabase, user, onlyType) {
  const tz = user.timezone || 'UTC';
  const localDate = localDateStr(tz);
  const localHour = localHourNum(tz);

  // ── Frequency guard. Without this a trigger firing hourly produces hourly
  // pushes, and the feature becomes noise instead of help.
  const { data: recent } = await supabase
    .from('reminders')
    .select('created_at')
    .eq('user_id', user.id)
    .eq('type', 'nudge')
    .order('created_at', { ascending: false })
    .limit(1);
  if (recent?.length) {
    const ageHours = (Date.now() - new Date(recent[0].created_at).getTime()) / 3_600_000;
    if (ageHours < COOLDOWN_HOURS) return null;
  }

  const windowStart = shiftDate(localDate, -Math.max(OVERDUE_WINDOW_DAYS, COMEBACK_MAX_DAYS));

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, description, task_date, select_value, priority')
    .eq('user_id', user.id)
    .gte('task_date', windowStart)
    .lte('task_date', localDate);

  const { data: comps } = await supabase
    .from('task_completions')
    .select('task_id, completion_date')
    .eq('user_id', user.id)
    .gte('completion_date', windowStart);

  const list = tasks || [];
  const completions = comps || [];
  const doneKey = new Set(completions.map((c) => `${c.task_id}__${c.completion_date}`));
  const isDone = (t) => t.select_value === 'Done' || doneKey.has(`${t.id}__${t.task_date}`);

  const firstName = (user.full_name || '').split(' ')[0] || undefined;
  const seed = `${user.id}__${localDate}`;
  const want = (type) => !onlyType || onlyType === type;

  // ── 1. Unfinished Frog, late in the day ──────────────────────────────
  if (want('procrastination') && localHour >= EVENING_HOUR) {
    const frog = list.find((t) => t.task_date === localDate && t.priority === 'Frog' && !isDone(t));
    if (frog) {
      const message = pickLine('procrastination', seed, { firstName, taskName: frog.description });
      if (message) return { type: 'procrastination', message, localDate, route: '/' };
    }
  }

  const completedToday = completions.filter((c) => c.completion_date === localDate).length;

  // ── 2. Streak at risk: nothing done today, but a live streak ─────────
  if (want('streak') && completedToday === 0 && localHour >= EVENING_HOUR) {
    const streakDays = currentStreak(list, doneKey, localDate, isDone);
    if (streakDays >= 2) {
      const message = pickLine('streak', seed, { firstName, streakDays });
      if (message) return { type: 'streak', message, localDate, route: '/' };
    }
  }

  // ── 3. Overdue pile-up ───────────────────────────────────────────────
  if (want('overdue')) {
    const overdue = list.filter(
      (t) => t.task_date < localDate && t.task_date >= shiftDate(localDate, -OVERDUE_WINDOW_DAYS) && !isDone(t),
    ).length;
    if (overdue >= OVERDUE_THRESHOLD) {
      const message = pickLine('overdue', seed, { firstName });
      if (message) return { type: 'overdue', message, localDate, route: '/all-tasks' };
    }
  }

  // ── 4. Lapsed user ───────────────────────────────────────────────────
  if (want('comeback')) {
    const lastCompletion = completions
      .map((c) => c.completion_date)
      .sort()
      .pop();
    // Never completed anything and has no tasks: a brand-new/empty account,
    // not a lapsed one. Nudging it would be a cold open, not a comeback.
    if (lastCompletion) {
      const daysSince = daysBetween(lastCompletion, localDate);
      if (daysSince >= COMEBACK_DAYS && daysSince <= COMEBACK_MAX_DAYS) {
        const message = pickLine('comeback', seed, { firstName });
        if (message) return { type: 'comeback', message, localDate, route: '/' };
      }
    }
  }

  return null;
}

/**
 * Consecutive days ending yesterday where the user had tasks AND completed
 * them all. Mirrors the app's buildStreakSnapshot rule ("a day counts only if
 * it had tasks and all were completed") so a nudge can't claim a streak the
 * widget disagrees with.
 *
 * Counts back from YESTERDAY: today is by definition incomplete when this
 * runs, and including it would report a streak of 0 for someone mid-run.
 */
function currentStreak(tasks, doneKey, localDate, isDone) {
  const byDate = new Map();
  for (const t of tasks) {
    if (!t.task_date) continue;
    if (!byDate.has(t.task_date)) byDate.set(t.task_date, []);
    byDate.get(t.task_date).push(t);
  }
  let streak = 0;
  for (let i = 1; i <= 60; i += 1) {
    const day = shiftDate(localDate, -i);
    const dayTasks = byDate.get(day);
    if (!dayTasks || dayTasks.length === 0) break;
    if (!dayTasks.every(isDone)) break;
    streak += 1;
  }
  return streak;
}

// ── date helpers ──────────────────────────────────────────────────────

function localDateStr(tz) {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
function localHourNum(tz) {
  try {
    return Number(
      new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }).format(new Date()),
    );
  } catch {
    return new Date().getUTCHours();
  }
}
function shiftDate(yyyyMmDd, days) {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(from, to) {
  return Math.round(
    (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000,
  );
}
