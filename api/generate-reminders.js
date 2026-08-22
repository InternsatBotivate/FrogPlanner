// =====================================================================
// FrogPlanner — Weather-aware reminder generator (Vercel Cron Function)
// Location: api/generate-reminders.js
// ---------------------------------------------------------------------
// Once a day (cron), for every user who has reminders enabled + a verified
// email + a saved location, this:
//   1. resolves "today" in the user's timezone,
//   2. loads today's dated tasks,
//   3. fetches the Open-Meteo HOURLY forecast and summarizes it per task's
//      time slot (Morning/Afternoon/Evening/Night/All Day) — so an afternoon
//      meeting can be warned about afternoon rain, not just morning,
//   4. asks the AI (Cerebras) which tasks genuinely warrant a weather alert
//      and to phrase a short nudge,
//   5. writes them to `reminders` (idempotent — one weather reminder per
//      task per day). The Dashboard card shows them; Phase 4 emails them.
//
// Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>` automatically.
// Env: CRON_SECRET, CEREBRAS_API_KEY, SUPABASE_SERVICE_ROLE_KEY,
//      VITE_SUPABASE_URL (or SUPABASE_URL). Optional CEREBRAS_MODEL/BASE_URL.
// =====================================================================

import { createClient } from '@supabase/supabase-js';

const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || 'gpt-oss-120b';
const CEREBRAS_BASE_URL = (process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1').replace(/\/$/, '');

// Local-hour windows per FrogPlanner time slot.
const SLOT_HOURS = {
  Morning: [6, 7, 8, 9, 10, 11],
  Afternoon: [12, 13, 14, 15, 16],
  Evening: [17, 18, 19, 20],
  Night: [21, 22, 23],
  'All Day': Array.from({ length: 24 }, (_, h) => h),
};

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
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    if (!supabaseUrl || !serviceRoleKey) return res.status(500).json({ error: 'Missing Supabase env.' });
    if (!cerebrasKey) return res.status(500).json({ error: 'Missing CEREBRAS_API_KEY.' });

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Eligible users: reminders on + verified + located.
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id, timezone, latitude, longitude, full_name')
      .eq('reminders_enabled', true)
      .eq('email_verified', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    if (usersErr) throw usersErr;

    let created = 0;
    let scanned = 0;

    for (const user of users || []) {
      try {
        const tz = user.timezone || 'UTC';
        const today = localDateStr(tz);

        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, description, duration, category, priority')
          .eq('user_id', user.id)
          .eq('task_date', today);
        if (!tasks || tasks.length === 0) continue;
        scanned += tasks.length;

        const forecast = await fetchForecast(user.latitude, user.longitude, tz);
        if (!forecast) continue;

        // Build compact per-task forecast windows.
        const taskViews = tasks.map((t) => {
          const hours = SLOT_HOURS[t.duration] || SLOT_HOURS['All Day'];
          const w = summarizeWindow(forecast, hours);
          return {
            taskId: t.id,
            description: t.description,
            slot: t.duration,
            category: t.category,
            maxRainChancePct: w.maxPop,
            precipMm: Math.round(w.precip * 10) / 10,
            maxTempC: w.maxTemp,
            minTempC: w.minTemp,
          };
        });

        // Skip the AI call entirely if nothing looks remotely adverse.
        const anyAdverse = taskViews.some(
          (v) => v.maxRainChancePct >= 50 || v.precipMm >= 1 || v.maxTempC >= 36 || v.minTempC <= 3,
        );
        if (!anyAdverse) continue;

        const picks = await askAiForReminders(cerebrasKey, taskViews);
        for (const p of picks) {
          const task = tasks.find((t) => t.id === p.taskId);
          if (!task || !p.message) continue;

          // Idempotent: one weather reminder per task per day.
          const { data: existing } = await supabase
            .from('reminders')
            .select('id')
            .eq('user_id', user.id)
            .eq('task_id', task.id)
            .eq('for_date', today)
            .eq('type', 'weather')
            .maybeSingle();
          if (existing) continue;

          const { error: insErr } = await supabase.from('reminders').insert({
            user_id: user.id,
            task_id: task.id,
            type: 'weather',
            message: String(p.message).slice(0, 400),
            for_date: today,
            shown: false,
            emailed: false,
          });
          if (!insErr) created += 1;
        }
      } catch (perUserErr) {
        console.error('[generate-reminders] user failed:', user.id, perUserErr?.message);
      }
    }

    return res.status(200).json({ ok: true, users: (users || []).length, scanned, created });
  } catch (error) {
    console.error('[generate-reminders] Error:', error);
    return res.status(500).json({ error: 'Reminder generation failed.' });
  }
}

// "Today" (YYYY-MM-DD) in the given IANA timezone.
function localDateStr(tz) {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: tz });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

async function fetchForecast(lat, lon, tz) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&hourly=precipitation_probability,precipitation,temperature_2m,weather_code` +
      `&forecast_days=1&timezone=${encodeURIComponent(tz)}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const j = await r.json();
    return j.hourly || null;
  } catch {
    return null;
  }
}

// Summarize a set of local hours from Open-Meteo's hourly arrays.
function summarizeWindow(hourly, hours) {
  const times = hourly.time || [];
  let maxPop = 0;
  let precip = 0;
  let maxTemp = -999;
  let minTemp = 999;
  for (let i = 0; i < times.length; i += 1) {
    const h = Number(String(times[i]).slice(11, 13)); // "YYYY-MM-DDTHH:MM"
    if (!hours.includes(h)) continue;
    maxPop = Math.max(maxPop, hourly.precipitation_probability?.[i] ?? 0);
    precip += hourly.precipitation?.[i] ?? 0;
    const temp = hourly.temperature_2m?.[i];
    if (typeof temp === 'number') {
      maxTemp = Math.max(maxTemp, temp);
      minTemp = Math.min(minTemp, temp);
    }
  }
  return {
    maxPop,
    precip,
    maxTemp: maxTemp === -999 ? null : Math.round(maxTemp),
    minTemp: minTemp === 999 ? null : Math.round(minTemp),
  };
}

// Ask Cerebras which tasks deserve a weather alert; expect a JSON array.
async function askAiForReminders(cerebrasKey, taskViews) {
  const system =
    'You are Frog Planner’s weather reminder assistant. Given today’s tasks with their time slot and ' +
    'the forecast for that slot, decide which tasks are weather-SENSITIVE (outdoor, commute/travel, gym/run/walk, ' +
    'errands, in-person meetings that require going out) AND face adverse weather (rain likely ≥50%, notable ' +
    'precipitation, or extreme heat/cold). For each such task, write ONE short, friendly reminder (≤160 chars, ' +
    'may use 1 emoji) naming the task and the weather + slot. Ignore indoor/no-travel or fine-weather tasks. ' +
    'Return ONLY a compact JSON array like [{"taskId":"...","message":"..."}]. If none qualify, return [].';
  const user = JSON.stringify(taskViews);

  try {
    const r = await fetch(`${CEREBRAS_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cerebrasKey}` },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0.3,
      }),
    });
    if (!r.ok) return [];
    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content || '';
    return parseJsonArray(content);
  } catch {
    return [];
  }
}

// Tolerant JSON-array extraction (models sometimes wrap in prose / fences).
function parseJsonArray(text) {
  try {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1) return [];
    const arr = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(arr)
      ? arr.filter((x) => x && typeof x.taskId === 'string' && typeof x.message === 'string')
      : [];
  } catch {
    return [];
  }
}
