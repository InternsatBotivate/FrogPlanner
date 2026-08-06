/**
 * remindersService.js — read today's reminders for the Dashboard, and save the
 * user's location so the weather cron can generate them.
 * Clients read/write directly via the anon key (no RLS), scoped by user_id.
 */
import { supabase } from './supabaseClient';

function todayStr() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Reminders to show on the Dashboard for today (newest first). */
export async function fetchTodayReminders(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('reminders')
    .select('id, task_id, type, message, for_date, created_at')
    .eq('user_id', userId)
    .eq('for_date', todayStr())
    .order('created_at', { ascending: false });
  if (error) return [];
  return data || [];
}

/**
 * Save the user's location (from browser geolocation or a geocoded city) so the
 * weather cron can forecast for them. Also stamps the IANA timezone.
 */
export async function saveUserLocation(userId, { latitude, longitude, city }) {
  if (!userId) return { ok: false, error: 'Not signed in.' };
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    /* keep UTC */
  }
  const patch = { latitude, longitude, timezone };
  if (city != null) patch.city = city;
  const { error } = await supabase.from('users').update(patch).eq('id', userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, timezone };
}

/** Geocode a city name → { latitude, longitude, name } via Open-Meteo (free, no key). */
export async function geocodeCity(city) {
  const q = String(city || '').trim();
  if (!q) return null;
  try {
    const r = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1`,
    );
    if (!r.ok) return null;
    const j = await r.json();
    const hit = j?.results?.[0];
    if (!hit) return null;
    return { latitude: hit.latitude, longitude: hit.longitude, name: `${hit.name}${hit.country ? ', ' + hit.country : ''}` };
  } catch {
    return null;
  }
}
