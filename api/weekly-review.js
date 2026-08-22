// =====================================================================
// FrogPlanner — Weekly review email (cron target)
// Location: api/weekly-review.js
// ---------------------------------------------------------------------
// Emails each user a summary of LAST week (Mon–Sun, in their own
// timezone): what they completed, what they missed, and what they
// carried forward, plus Frogs eaten and their best day.
//
// Runs daily and decides per user whether it is their Monday yet — a
// single UTC cron cannot be "Monday morning" for every timezone at once,
// and Vercel Hobby allows only once-daily crons anyway. Users outside
// their Monday are skipped, so the effect is weekly per user.
//
// Idempotent: writes a `weekly_review` row into `reminders` keyed on
// for_date (the Monday it was sent for) and skips if one already exists,
// so a cron retry can never double-send.
//
// Auth: `Authorization: Bearer <CRON_SECRET>` only — no Vercel-specific
// cron header — so pg_cron, GitHub Actions or cron-job.org can all call it.
// Env: CRON_SECRET, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
//      VITE_SUPABASE_URL (or SUPABASE_URL).
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import { sendMail, emailShell } from './_lib/mailer.js';

const SITE_URL = 'https://www.frogplanner.com';

export default async function handler(req, res) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Missing Supabase env.' });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Missing Resend env.' });

    // `force` (with the secret) sends regardless of weekday, for testing a
    // weekly job without waiting for Monday. Still idempotent.
    const force = req.query?.force === '1';

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, timezone')
      .eq('reminders_enabled', true)
      .eq('email_verified', true);
    if (usersError) throw usersError;

    let sent = 0;
    let skipped = 0;
    const errors = [];

    for (const user of users || []) {
      try {
        const tz = user.timezone || 'UTC';
        const today = localDateStr(tz);

        // Only run on the user's local Monday (unless forced).
        if (!force && dayOfWeek(today) !== 1) {
          skipped += 1;
          continue;
        }

        // Last week = the Mon–Sun immediately before this Monday.
        const thisMonday = mondayOf(today);
        const start = shiftDate(thisMonday, -7);
        const end = shiftDate(thisMonday, -1);

        // Idempotency: one review per user per week.
        const { data: dupe } = await supabase
          .from('reminders')
          .select('id')
          .eq('user_id', user.id)
          .eq('type', 'weekly_review')
          .eq('for_date', thisMonday)
          .maybeSingle();
        if (dupe) {
          skipped += 1;
          continue;
        }

        const stats = await buildWeekStats(supabase, user.id, start, end, today);

        // Nothing happened at all: don't send an empty report. A user with no
        // tasks last week has no week to review, and a "0 of 0" email reads
        // like a bug rather than a summary.
        if (stats.total === 0) {
          skipped += 1;
          continue;
        }

        const { data: emails } = await supabase
          .from('user_emails')
          .select('email')
          .eq('user_id', user.id)
          .eq('is_verified', true);
        const verified = (emails || []).map((e) => e.email).filter(Boolean);
        if (verified.length === 0) {
          skipped += 1;
          continue;
        }

        const firstName = (user.full_name || 'there').split(' ')[0];
        const html = reviewHtml(firstName, stats, start, end);
        const text = reviewText(firstName, stats, start, end);

        for (const to of verified) {
          await sendMail({
            to,
            subject: `Your week in review — ${prettyRange(start, end)}`,
            text,
            html,
          });
        }

        // Recorded AFTER a successful send: if the mail throws we leave no row,
        // so the next run retries rather than marking a week reviewed that the
        // user never received.
        await supabase.from('reminders').insert({
          user_id: user.id,
          task_id: null,
          type: 'weekly_review',
          message: `Weekly review for ${prettyRange(start, end)}: ${stats.completed} completed, ${stats.missed} missed, ${stats.carried} carried forward.`,
          for_date: thisMonday,
          shown: false,
          emailed: true,
        });
        sent += 1;
      } catch (e) {
        console.error('[weekly-review] failed for user:', user.id, e?.message);
        errors.push(user.id);
      }
    }

    return res.status(200).json({
      ok: true,
      users: (users || []).length,
      sent,
      skipped,
      failed: errors.length,
    });
  } catch (error) {
    console.error('[weekly-review] Error:', error);
    return res.status(500).json({ error: 'Weekly review failed.' });
  }
}

/**
 * Classify last week's tasks.
 *
 * `tasks.task_date` is overwritten in place when a task is re-dated — there is
 * no date history — so "carried forward" cannot mean "moved into this week".
 * What the schema can tell us:
 *
 *   completed — a task_completions row for its date, or select_value 'Done'
 *   carried   — still pending, but touched (updated_at) after its own date,
 *               i.e. the user actively moved/edited it rather than ignoring it
 *   missed    — still pending and never touched since its date passed
 *
 * That keeps the three buckets disjoint and exhaustive, and each one is
 * something the data actually supports.
 */
async function buildWeekStats(supabase, userId, start, end, today) {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, description, task_date, select_value, priority, updated_at, category')
    .eq('user_id', userId)
    .gte('task_date', start)
    .lte('task_date', end);

  const list = tasks || [];

  const { data: comps } = await supabase
    .from('task_completions')
    .select('task_id, completion_date')
    .eq('user_id', userId)
    .gte('completion_date', start)
    .lte('completion_date', end);
  const doneKey = new Set((comps || []).map((c) => `${c.task_id}__${c.completion_date}`));

  const isDone = (t) => t.select_value === 'Done' || doneKey.has(`${t.id}__${t.task_date}`);

  const completedTasks = list.filter(isDone);
  const pending = list.filter((t) => !isDone(t));

  // Touched after its own day => actively rescheduled/edited, not abandoned.
  const carriedTasks = pending.filter(
    (t) => t.updated_at && t.updated_at.slice(0, 10) > t.task_date,
  );
  const carriedIds = new Set(carriedTasks.map((t) => t.id));
  const missedTasks = pending.filter((t) => !carriedIds.has(t.id));

  const frogsEaten = completedTasks.filter((t) => t.priority === 'Frog').length;
  const frogsTotal = list.filter((t) => t.priority === 'Frog').length;

  // Best day: most completions on a single date in the window.
  const perDay = {};
  for (const t of completedTasks) {
    const d = t.task_date;
    perDay[d] = (perDay[d] || 0) + 1;
  }
  let bestDay = null;
  let bestCount = 0;
  for (const [d, n] of Object.entries(perDay)) {
    if (n > bestCount) {
      bestDay = d;
      bestCount = n;
    }
  }

  const total = list.length;
  const completed = completedTasks.length;

  return {
    total,
    completed,
    missed: missedTasks.length,
    carried: carriedTasks.length,
    frogsEaten,
    frogsTotal,
    rate: total ? Math.round((completed / total) * 100) : 0,
    bestDay,
    bestCount,
    // A few names to make the email concrete rather than purely numeric.
    missedSample: missedTasks.slice(0, 5).map((t) => t.description).filter(Boolean),
    carriedSample: carriedTasks.slice(0, 5).map((t) => t.description).filter(Boolean),
    today,
  };
}

// ── date helpers (UTC-safe, no Date mutation surprises) ────────────────

function localDateStr(tz) {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
function shiftDate(yyyyMmDd, days) {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** ISO weekday: 1 = Monday … 7 = Sunday. */
function dayOfWeek(yyyyMmDd) {
  const js = new Date(`${yyyyMmDd}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}
/** The Monday of the week containing the given date. */
function mondayOf(yyyyMmDd) {
  return shiftDate(yyyyMmDd, -(dayOfWeek(yyyyMmDd) - 1));
}
function prettyDate(yyyyMmDd) {
  return new Date(`${yyyyMmDd}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}
function prettyRange(start, end) {
  return `${prettyDate(start)} – ${prettyDate(end)}`;
}
function plural(n) {
  return n === 1 ? '' : 's';
}
function escapeHtml(s) {
  return String(s || '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]),
  );
}

// ── email rendering ───────────────────────────────────────────────────

function reviewText(firstName, s, start, end) {
  const lines = [
    `Hi ${firstName},`,
    ``,
    `Your week: ${prettyRange(start, end)}`,
    ``,
    `Completed:        ${s.completed} of ${s.total} (${s.rate}%)`,
    `Missed:           ${s.missed}`,
    `Carried forward:  ${s.carried}`,
  ];
  if (s.frogsTotal) lines.push(`Frogs eaten:      ${s.frogsEaten} of ${s.frogsTotal}`);
  if (s.bestDay) lines.push(`Best day:         ${prettyDate(s.bestDay)} (${s.bestCount} task${plural(s.bestCount)})`);
  if (s.missedSample.length) {
    lines.push(``, `Still waiting on:`);
    for (const d of s.missedSample) lines.push(`  • ${d}`);
  }
  lines.push(``, `Plan the week ahead: ${SITE_URL}`, ``, `— Frog Planner`, ``,
    `© ${new Date().getUTCFullYear()} Botivate. All rights reserved.`);
  return lines.join('\n');
}

function statCell(label, value, tone) {
  const color = tone === 'good' ? '#1f7a52' : tone === 'bad' ? '#b4342a' : '#8a6d1f';
  return `<td width="33%" align="center" style="padding:14px 8px;background:#f3f7f4;border:1px solid #dce7e0;border-radius:12px;">
    <div style="color:${color};font-size:30px;line-height:34px;font-weight:800;">${value}</div>
    <div style="margin-top:4px;color:#617268;font-size:9px;line-height:13px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;">${escapeHtml(label)}</div>
  </td>`;
}

function listBlock(title, items) {
  if (!items.length) return '';
  const rows = items
    .map(
      (d) =>
        `<tr><td style="padding:5px 0;color:#425249;font-size:14px;line-height:20px;">&bull;&nbsp;&nbsp;${escapeHtml(d)}</td></tr>`,
    )
    .join('');
  return `<div style="margin:22px 0 0;color:#617268;font-size:9px;line-height:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:6px;">${rows}</table>`;
}

function reviewHtml(firstName, s, start, end) {
  const frogLine = s.frogsTotal
    ? `<p class="email-copy" style="margin:16px 0 0;color:#526158;font-size:15px;line-height:24px;">You ate <strong style="color:#1f6f4b;">${s.frogsEaten}</strong> of <strong>${s.frogsTotal}</strong> Frog${plural(s.frogsTotal)} — the tasks you'd marked as the ones that mattered most.</p>`
    : '';
  const bestLine = s.bestDay
    ? `<p class="email-copy" style="margin:10px 0 0;color:#526158;font-size:15px;line-height:24px;">Your strongest day was <strong>${prettyDate(s.bestDay)}</strong>, with ${s.bestCount} task${plural(s.bestCount)} finished.</p>`
    : '';

  return emailShell(
    `
    <h1 class="email-heading" style="margin:0 0 10px;color:#102118;font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.7px;">Your week in review</h1>
    <p class="email-copy" style="margin:0 0 22px;color:#526158;font-size:15px;line-height:24px;">Hi ${escapeHtml(firstName)}, here's how ${prettyRange(start, end)} went.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 6px;">
      <tr>
        ${statCell('Completed', s.completed, 'good')}
        <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
        ${statCell('Missed', s.missed, 'bad')}
        <td width="10" style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
        ${statCell('Carried over', s.carried, 'warn')}
      </tr>
    </table>

    <p class="email-copy" style="margin:18px 0 0;color:#526158;font-size:15px;line-height:24px;">That's <strong style="color:#1f6f4b;">${s.rate}%</strong> of the ${s.total} task${plural(s.total)} you planned.</p>
    ${frogLine}
    ${bestLine}

    ${listBlock('Still waiting on', s.missedSample)}
    ${listBlock('Moved to another day', s.carriedSample)}

    <table role="presentation" class="cta-table" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 8px;">
      <tr>
        <td bgcolor="#1f6f4b" style="border-radius:10px;">
          <a class="cta-link" href="${SITE_URL}" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:14px;line-height:18px;font-weight:800;">Plan the week ahead&nbsp;&nbsp;&rarr;</a>
        </td>
      </tr>
    </table>
  `,
    {
      eyebrow: 'Weekly review',
      previewText: `${s.completed} of ${s.total} done, ${s.missed} missed, ${s.carried} carried forward.`,
    },
  );
}
