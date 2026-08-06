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
// Env: CRON_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD,
//      SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_URL (or SUPABASE_URL).
// =====================================================================

import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

const OVERDUE_WINDOW_DAYS = 30;

export default async function handler(req, res) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const gmailUser = process.env.GMAIL_USER;
    const gmailPass = process.env.GMAIL_APP_PASSWORD;
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Missing Supabase env.' });
    if (!gmailUser || !gmailPass) return res.status(500).json({ error: 'Missing Gmail env.' });

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: users } = await supabase
      .from('users')
      .select('id, timezone, full_name')
      .eq('reminders_enabled', true)
      .eq('email_verified', true);

    // ── Step 1: deadline digest reminders ───────────────────────────────
    for (const user of users || []) {
      try {
        const tz = user.timezone || 'UTC';
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
        if (frogs) msg += ` ${frogs} 🐸 frog${plural(frogs)} to eat first!`;

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
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });

    let emailed = 0;
    for (const user of users || []) {
      try {
        const tz = user.timezone || 'UTC';
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
        const text = `Hi ${firstName},\n\n${pending.map((p) => '• ' + p.message).join('\n')}\n\n— FrogPlanner`;

        for (const to of verified) {
          await transporter.sendMail({
            from: `"FrogPlanner" <${gmailUser}>`,
            to,
            subject: `🐸 Your FrogPlanner reminders — ${today}`,
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

function digestHtml(firstName, reminders) {
  const items = reminders
    .map(
      (r) =>
        `<li style="margin:0 0 10px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;color:#374151;font-size:14px;line-height:1.5;">${escapeHtml(
          r.message,
        )}</li>`,
    )
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f6f7f6;font-family:Arial,Helvetica,sans-serif;">
    <div style="max-width:480px;margin:24px auto;background:#fff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:20px 24px;color:#fff;font-size:19px;font-weight:800;">🐸 FrogPlanner reminders</div>
      <div style="padding:22px 24px;color:#374151;font-size:14px;line-height:1.6;">
        <p style="margin:0 0 14px;">Hi ${escapeHtml(firstName)}, here's what needs your attention today:</p>
        <ul style="list-style:none;padding:0;margin:0;">${items}</ul>
        <p style="text-align:center;margin:20px 0 4px;">
          <a href="https://www.frogplanner.in" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-weight:700;padding:11px 22px;border-radius:10px;">Open FrogPlanner</a>
        </p>
      </div>
    </div>
  </body></html>`;
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
