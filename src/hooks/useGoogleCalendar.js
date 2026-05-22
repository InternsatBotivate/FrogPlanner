/**
 * useGoogleCalendar.js
 * ──────────────────────────────────────────────────────────────────────────
 * Custom React hook that manages the full Google Calendar integration:
 *
 * 1. On mount — checks Supabase for an existing Google connection.
 * 2. If connected — silently requests a fresh GIS access token using
 *    `prompt: ''` + `login_hint: google_email`. No user interaction needed
 *    as long as their Google browser session is still active.
 * 3. If silent auth fails (revoked / Google session expired) — the hook
 *    simply exposes `connect()` so the UI can prompt manually.
 * 4. On explicit connect — saves the google_email to Supabase for future
 *    silent re-auth.
 * 5. On disconnect — revokes the token and marks the DB record as
 *    disconnected.
 *
 * Exposed API:
 *   gcToken      — current access token string or null
 *   gcEvents     — array of Google Calendar events (merged format)
 *   gcLoading    — boolean
 *   gcError      — string
 *   isConnected  — boolean (token is live)
 *   connect()    — triggers GIS OAuth popup
 *   disconnect() — revokes token + marks DB record disconnected
 *   syncTasks()  — pushes unsynced tasks to Google Calendar
 *   fetchEvents()— refreshes events from Google Calendar
 * ──────────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  getGoogleConnection,
  saveGoogleConnection,
  removeGoogleConnection,
} from '../lib/googleCalendarService';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

// ── Load GIS script once (singleton across hook instances) ────────────
let gisLoaded = false;
const loadGIS = () =>
  new Promise((resolve) => {
    if (gisLoaded || window.google?.accounts) {
      gisLoaded = true;
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => { gisLoaded = true; resolve(); };
    document.head.appendChild(s);
  });

// ── Time slot → calendar time mapping ────────────────────────────────
const getEventTimes = (taskDate, duration) => {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  if (duration === 'Morning')   return { start: { dateTime: `${taskDate}T09:00:00`, timeZone: tz }, end: { dateTime: `${taskDate}T12:00:00`, timeZone: tz } };
  if (duration === 'Afternoon') return { start: { dateTime: `${taskDate}T13:00:00`, timeZone: tz }, end: { dateTime: `${taskDate}T17:00:00`, timeZone: tz } };
  if (duration === 'Evening')   return { start: { dateTime: `${taskDate}T18:00:00`, timeZone: tz }, end: { dateTime: `${taskDate}T21:00:00`, timeZone: tz } };
  if (duration === 'Night')     return { start: { dateTime: `${taskDate}T21:00:00`, timeZone: tz }, end: { dateTime: `${taskDate}T23:00:00`, timeZone: tz } };
  // All Day — end date is exclusive in Google Calendar API
  const endDate = new Date(taskDate);
  endDate.setDate(endDate.getDate() + 1);
  return { start: { date: taskDate }, end: { date: endDate.toISOString().split('T')[0] } };
};

export default function useGoogleCalendar(userId) {
  const [gcToken, setGcToken]     = useState(null);
  const [gcEvents, setGcEvents]   = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('gc_events') || '[]'); } catch { return []; }
  });
  const [gcLoading, setGcLoading] = useState(false);
  const [gcError, setGcError]     = useState('');

  // Keep a ref to the GIS token client so we can call requestAccessToken() later
  const tokenClientRef = useRef(null);
  // Track if we already attempted a silent auth this session
  const silentAttemptedRef = useRef(false);

  // ── Helper: handle a fresh access token from GIS ──────────────────
  const onTokenReceived = useCallback(async (accessToken, googleEmail) => {
    setGcToken(accessToken);
    sessionStorage.setItem('gc_token', accessToken);
    setGcError('');

    // Persist the connection to Supabase so future logins can silent re-auth
    if (userId && googleEmail) {
      await saveGoogleConnection(userId, googleEmail);
    }
  }, [userId]);

  // ── Init GIS token client ─────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !userId) return;

    loadGIS().then(async () => {
      // ── 1. Check Supabase for an existing connection ──────────────
      const storedConn = await getGoogleConnection(userId);

      const initClient = (hint = '', promptMode = 'consent') => {
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: SCOPES,
          // `hint` pre-selects the account; empty prompt = silent attempt
          login_hint: hint,
          prompt: promptMode,
          callback: async (resp) => {
            if (resp.error) {
              // Silent auth failed — just expose the connect button
              if (promptMode === '') {
                console.info('[GCal] Silent re-auth failed:', resp.error);
                setGcError('');  // Don't show error for silent failures
              } else {
                setGcError('Google authorization failed: ' + resp.error);
              }
              return;
            }
            // Decode the JWT id_token to extract the user's Google email
            // GIS implicit flow returns access_token; google_email comes from
            // the userinfo endpoint or we use the stored hint if available.
            const email = hint || 'unknown';
            await onTokenReceived(resp.access_token, email);
            if (promptMode !== '') {
              // Only toast on explicit connect (not silent)
              toast.success('Google Calendar connected! 🗓️');
            }
          },
        });
        tokenClientRef.current = client;
        return client;
      };

      // ── 2. If user had a previous connection, attempt silent re-auth ──
      if (storedConn?.is_connected && storedConn?.google_email && !silentAttemptedRef.current) {
        silentAttemptedRef.current = true;
        // Check if we already have a live token in this session
        const sessionToken = sessionStorage.getItem('gc_token');
        if (sessionToken) {
          // Token already alive from earlier in this session
          setGcToken(sessionToken);
          initClient(storedConn.google_email, 'none');
          return;
        }
        // No live token — attempt silent re-auth
        initClient(storedConn.google_email, '');
        // Trigger the silent request (no popup appears if Google session is active)
        setTimeout(() => {
          tokenClientRef.current?.requestAccessToken({ prompt: '' });
        }, 500);
      } else {
        // No prior connection — init for manual connect
        initClient('', 'consent');
      }
    });
  }, [userId, onTokenReceived]);

  // ── Fetch Google Calendar events ──────────────────────────────────
  const fetchEvents = useCallback(async (token) => {
    if (!token) return;
    setGcLoading(true);
    setGcError('');
    try {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=250`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 401) {
        // Token expired — clear session, show reconnect button
        setGcToken(null);
        sessionStorage.removeItem('gc_token');
        sessionStorage.removeItem('gc_events');
        setGcError('Google Calendar session expired. Reconnecting...');
        // Attempt silent re-auth automatically
        setTimeout(() => tokenClientRef.current?.requestAccessToken({ prompt: '' }), 300);
        return;
      }

      const data = await res.json();
      const events = (data.items || []).map((ev) => {
        // Extract FrogPlanner task ID from private extended properties or description
        let taskId = ev.extendedProperties?.private?.taskId || null;
        if (!taskId && ev.description) {
          const match = ev.description.match(/\[FrogPlanner ID:\s*([a-f0-9-]+)\]/i);
          if (match) taskId = match[1];
        }
        return {
          id: `gc_${ev.id}`,
          title: ev.summary || '(No Title)',
          dateStr: (ev.start?.date || ev.start?.dateTime || '').substring(0, 10),
          time: ev.start?.dateTime
            ? new Date(ev.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            : 'All Day',
          type: 'Google Cal',
          priority: '',
          isCompleted: false,
          isGoogle: true,
          color: ev.colorId || '1',
          htmlLink: ev.htmlLink,
          taskId,
        };
      });

      setGcEvents(events);
      sessionStorage.setItem('gc_events', JSON.stringify(events));
    } catch {
      setGcError('Failed to fetch Google Calendar events.');
    } finally {
      setGcLoading(false);
    }
  }, []);

  // ── Auto-fetch events when token arrives ──────────────────────────
  useEffect(() => {
    if (gcToken) fetchEvents(gcToken);
  }, [gcToken, fetchEvents]);

  // ── Sync local planner tasks → Google Calendar ────────────────────
  const syncTasks = useCallback(async (token, tasks, existingEvents) => {
    if (!token || !tasks?.length) return;

    // Build set of already-synced task IDs (from GC events + local cache)
    const synced = new Set();
    existingEvents.forEach(ev => { if (ev.taskId) synced.add(ev.taskId); });
    const localCache = JSON.parse(localStorage.getItem(`gc_synced_${userId}`) || '{}');
    Object.keys(localCache).forEach(id => synced.add(id));

    // Only tasks with a date that haven't been synced yet
    const toSync = tasks.filter(t => (t.date || t.task_date) && !synced.has(t.id));
    if (!toSync.length) return;

    setGcLoading(true);
    let successCount = 0;

    for (const task of toSync) {
      const taskDate = task.date || task.task_date;
      try {
        const { start, end } = getEventTimes(taskDate, task.duration);
        const payload = {
          summary: task.description || 'FrogPlanner Task',
          description: [
            `Category: ${task.category || 'General'}`,
            `Priority: ${task.priority || 'Normal'}`,
            `Time Slot: ${task.duration || 'All Day'}`,
            task.remarks ? `Remarks: ${task.remarks}` : '',
            '',
            `[FrogPlanner ID: ${task.id}]`,
          ].filter(Boolean).join('\n'),
          start,
          end,
          extendedProperties: { private: { taskId: task.id } },
        };

        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          // Token expired mid-sync — stop and trigger silent re-auth
          setGcToken(null);
          sessionStorage.removeItem('gc_token');
          setGcError('Google Calendar session expired. Reconnecting...');
          setTimeout(() => tokenClientRef.current?.requestAccessToken({ prompt: '' }), 300);
          break;
        }

        if (res.ok) {
          const created = await res.json();
          if (created?.id) {
            localCache[task.id] = created.id;
            localStorage.setItem(`gc_synced_${userId}`, JSON.stringify(localCache));
            successCount++;
          }
        } else {
          const err = await res.json();
          console.error('[GCal Sync] Failed for task', task.id, err);
        }
      } catch (err) {
        console.error('[GCal Sync] Error for task', task.id, err);
      }
    }

    setGcLoading(false);
    if (successCount > 0) {
      toast.success(`Synced ${successCount} task(s) to Google Calendar! 🗓️`);
      fetchEvents(token);
    }
  }, [userId, fetchEvents]);

  // ── Manual connect (triggers GIS popup) ──────────────────────────
  const connect = useCallback(async () => {
    if (!GOOGLE_CLIENT_ID) return false; // Caller should show setup UI
    if (!tokenClientRef.current) {
      // GIS not ready yet — shouldn't happen in practice
      toast.error('Google auth not ready. Please wait a moment and try again.');
      return false;
    }

    // Fetch stored email hint for account pre-selection
    const storedConn = userId ? await getGoogleConnection(userId) : null;
    const hint = storedConn?.google_email || '';

    tokenClientRef.current.requestAccessToken({ prompt: 'consent', login_hint: hint });
    return true;
  }, [userId]);

  // ── Disconnect ────────────────────────────────────────────────────
  const disconnect = useCallback(async () => {
    if (gcToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(gcToken);
    }
    setGcToken(null);
    setGcEvents([]);
    setGcError('');
    sessionStorage.removeItem('gc_token');
    sessionStorage.removeItem('gc_events');

    // Mark disconnected in Supabase (preserves email hint for future reconnect)
    if (userId) {
      await removeGoogleConnection(userId);
    }
    toast('Google Calendar disconnected.', { icon: '🔌' });
  }, [gcToken, userId]);

  return {
    gcToken,
    gcEvents,
    gcLoading,
    gcError,
    isConnected: !!gcToken,
    connect,
    disconnect,
    syncTasks,
    fetchEvents,
    hasClientId: !!GOOGLE_CLIENT_ID,
  };
}
