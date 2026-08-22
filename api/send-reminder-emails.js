// =====================================================================
// FrogPlanner — Reminder email digest (Vercel Cron Function)
// Location: api/send-reminder-emails.js
// ---------------------------------------------------------------------
// Runs daily AFTER generate-reminders. Two steps:
//   1. Generate a per-user "deadline" reminder summarizing today's pending +
//      overdue tasks (idempotent: one per user per day).
//   2. Email every one of today's UNSENT reminders (weather + deadline) as a
//      single digest to each of the user's VERIFIED emails, then mark them
//      emailed=true.
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
// Env: CRON_SECRET, RESEND_API_KEY,
//      SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL).
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import { sendMail, emailShell } from './_lib/mailer.js';
import { userTimezone, localDateStr } from './_lib/tz.js';

const OVERDUE_WINDOW_DAYS = 30;

export default async function handler(req, res) {
  try {
    // Required, not optional. While this was `if (cronSecret && ...)` and the
    // env var was unset, the check short-circuited and the endpoint was
    // callable by anyone on the internet — for a cron that sends real email.
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Missing Supabase env.' });
    if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Missing Resend env.' });

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: users } = await supabase
      .from('users')
      .select('id, timezone, full_name')
      .eq('reminders_enabled', true)
      .eq('email_verified', true);

    // ── Step 1: deadline digest reminders ───────────────────────────────
    for (const user of users || []) {
      try {
        const tz = userTimezone(user);
        const today = localDateStr(tz);

        // Skip if a deadline reminder already exists for today.
        const { data: dupe } = await supabase
          .from('reminders')
          .select('id')
          .eq('user_id', user.id)
          .eq('for_date', today)
          .eq('type', 'deadline')
          .maybeSingle();
        if (dupe) continue;

        const windowStart = shiftDate(today, -OVERDUE_WINDOW_DAYS);
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, description, task_date, select_value, priority')
          .eq('user_id', user.id)
          .gte('task_date', windowStart)
          .lte('task_date', today);
        if (!tasks || tasks.length === 0) continue;

        // Which are completed? (completion row for that date, or select_value Done)
        const { data: comps } = await supabase
          .from('task_completions')
          .select('task_id, completion_date')
          .eq('user_id', user.id)
          .gte('completion_date', windowStart);
        const doneKey = new Set((comps || []).map((c) => `${c.task_id}__${c.completion_date}`));

        const pendingToday = tasks.filter(
          (t) => t.task_date === today && t.select_value !== 'Done' && !doneKey.has(`${t.id}__${today}`),
        );
        const overdue = tasks.filter(
          (t) => t.task_date < today && t.select_value !== 'Done' && !doneKey.has(`${t.id}__${t.task_date}`),
        );
        if (pendingToday.length === 0 && overdue.length === 0) continue;

        const parts = [];
        if (pendingToday.length) parts.push(`${pendingToday.length} task${plural(pendingToday.length)} due today`);
        if (overdue.length) parts.push(`${overdue.length} overdue`);
        const frogs = pendingToday.filter((t) => t.priority === 'Frog').length;
        let msg = `You have ${parts.join(' and ')}.`;
        if (frogs) msg += ` ${frogs} high-priority Frog task${plural(frogs)} to tackle first.`;

        await supabase.from('reminders').insert({
          user_id: user.id,
          task_id: null,
          type: 'deadline',
          message: msg,
          for_date: today,
          shown: false,
          emailed: false,
        });
      } catch (e) {
        console.error('[send-reminder-emails] deadline gen failed:', user.id, e?.message);
      }
    }

    // ── Step 2: email today's unsent reminders per user ─────────────────
    let emailed = 0;
    for (const user of users || []) {
      try {
        const tz = userTimezone(user);
        const today = localDateStr(tz);

        const { data: pending } = await supabase
          .from('reminders')
          .select('id, type, message')
          .eq('user_id', user.id)
          .eq('for_date', today)
          .eq('emailed', false);
        if (!pending || pending.length === 0) continue;

        const { data: emails } = await supabase
          .from('user_emails')
          .select('email')
          .eq('user_id', user.id)
          .eq('is_verified', true);
        const verified = (emails || []).map((e) => e.email).filter(Boolean);
        if (verified.length === 0) continue; // leave unsent; falls out of scope tomorrow

        const firstName = (user.full_name || 'there').split(' ')[0];
        const html = digestHtml(firstName, pending);
        const text =
          `Hi ${firstName},\n\n${pending.map((p) => '• ' + p.message).join('\n')}\n\n` +
          `Open today's plan: https://www.frogplanner.com\n\n— Frog Planner\n\n` +
          `\u00A9 ${new Date().getUTCFullYear()} Botivate. All rights reserved.`;

        for (const to of verified) {
          await sendMail({
            to,
            subject: `Your Frog Planner reminders — ${today}`,
            text,
            html,
          });
        }

        await supabase
          .from('reminders')
          .update({ emailed: true })
          .in('id', pending.map((p) => p.id));
        emailed += pending.length;
      } catch (e) {
        console.error('[send-reminder-emails] email failed:', user.id, e?.message);
      }
    }

    return res.status(200).json({ ok: true, users: (users || []).length, emailed });
  } catch (error) {
    console.error('[send-reminder-emails] Error:', error);
    return res.status(500).json({ error: 'Reminder emails failed.' });
  }
}

function plural(n) {
  return n === 1 ? '' : 's';
}
function shiftDate(yyyyMmDd, days) {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function digestHtml(firstName, reminders) {
  const items = reminders
    .map(
      (r) =>
        `<tr>
          <td style="padding:0 0 10px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f7f4;border:1px solid #dce7e0;border-radius:12px;">
              <tr>
                <td width="5" style="width:5px;background:${r.type === 'deadline' ? '#f2c94c' : '#1f7a52'};border-radius:12px 0 0 12px;font-size:0;line-height:0;">&nbsp;</td>
                <td style="padding:14px 16px;">
                  <div style="margin:0 0 4px;color:#617268;font-size:9px;line-height:13px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;">${escapeHtml(reminderLabel(r.type))}</div>
                  <div style="color:#27362d;font-size:14px;line-height:21px;font-weight:600;">${escapeHtml(r.message)}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>`,
    )
    .join('');
  return emailShell(`
    <h1 class="email-heading" style="margin:0 0 10px;color:#102118;font-size:28px;line-height:34px;font-weight:800;letter-spacing:-0.7px;">Your day, in focus</h1>
    <p class="email-copy" style="margin:0 0 22px;color:#526158;font-size:15px;line-height:24px;">Hi ${escapeHtml(firstName)}, here’s what deserves your attention today.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 14px;">${items}</table>
    <table role="presentation" class="cta-table" cellspacing="0" cellpadding="0" border="0" style="margin:6px 0 8px;">
      <tr>
        <td bgcolor="#1f6f4b" style="border-radius:10px;">
          <a class="cta-link" href="https://www.frogplanner.com" style="display:inline-block;padding:14px 24px;color:#ffffff;text-decoration:none;font-size:14px;line-height:18px;font-weight:800;">Open today’s plan&nbsp;&nbsp;&rarr;</a>
        </td>
      </tr>
    </table>
  `, { eyebrow: 'Daily follow-up', previewText: `${reminders.length} Frog Planner reminder${reminders.length === 1 ? '' : 's'} for today.` });
}
function reminderLabel(type) {
  return type === 'deadline' ? 'Task follow-up' : type === 'weather' ? 'Weather note' : 'Reminder';
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
