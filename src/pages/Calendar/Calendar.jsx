import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, LogIn, LogOut, RefreshCw, Calendar as CalendarIcon, AlertCircle, CheckCircle2 } from 'lucide-react';
import Daily from './Daily';
import Weekly from './Weekly';
import Monthly from './Monthly';
import { getTasks, getCompletions, saveCompletions } from '../../utils/storageManager';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────
// ⚙️ GOOGLE CALENDAR CONFIG
// Replace this with your own Google Cloud OAuth 2.0 Client ID
// Steps: console.cloud.google.com → New Project → Enable Calendar API
//        → Credentials → OAuth Client ID → Web Application
//        → Authorised JS origins: http://localhost:3001
// ─────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

// Load Google Identity Services script once
let gisLoaded = false;
const loadGIS = () =>
  new Promise((resolve) => {
    if (gisLoaded || window.google?.accounts) { gisLoaded = true; resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => { gisLoaded = true; resolve(); };
    document.head.appendChild(s);
  });

export default function Calendar() {
  const [view, setView] = useState('Monthly');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Local tasks & completions
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState({});

  // Google Calendar state
  const [gcToken, setGcToken] = useState(() => sessionStorage.getItem('gc_token') || null);
  const [gcEvents, setGcEvents] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('gc_events') || '[]'); } catch { return []; }
  });
  const [gcLoading, setGcLoading] = useState(false);
  const [gcError, setGcError] = useState('');
  const [tokenClient, setTokenClient] = useState(null);
  const [showGcSetup, setShowGcSetup] = useState(false);

  useEffect(() => { setTasks(getTasks()); setCompletions(getCompletions()); }, []);

  // ── Init Google Identity Services token client ──────────────
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;
    loadGIS().then(() => {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp.error) { setGcError('Authorization failed: ' + resp.error); return; }
          setGcToken(resp.access_token);
          sessionStorage.setItem('gc_token', resp.access_token);
          setGcError('');
          toast.success('Google Calendar connected! 🗓️');
        },
      });
      setTokenClient(client);
    });
  }, []);

  // ── Fetch Google Calendar events ───────────────────────────
  const fetchGoogleEvents = useCallback(async (token) => {
    if (!token) return;
    setGcLoading(true);
    setGcError('');
    try {
      const now = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

      const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&maxResults=200`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.status === 401) {
        setGcToken(null);
        sessionStorage.removeItem('gc_token');
        sessionStorage.removeItem('gc_events');
        setGcError('Session expired. Please reconnect Google Calendar.');
        setGcLoading(false);
        return;
      }

      const data = await res.json();
      const events = (data.items || []).map((ev) => ({
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
      }));
      setGcEvents(events);
      sessionStorage.setItem('gc_events', JSON.stringify(events));
      toast.success(`Synced ${events.length} events from Google Calendar`);
    } catch (err) {
      setGcError('Failed to fetch Google Calendar events.');
    } finally {
      setGcLoading(false);
    }
  }, []);

  // Auto-fetch when token changes
  useEffect(() => { if (gcToken) fetchGoogleEvents(gcToken); }, [gcToken, fetchGoogleEvents]);

  const handleGcConnect = () => {
    if (!GOOGLE_CLIENT_ID) { setShowGcSetup(true); return; }
    if (tokenClient) tokenClient.requestAccessToken();
  };

  const handleGcDisconnect = () => {
    if (gcToken && window.google?.accounts?.oauth2) {
      window.google.accounts.oauth2.revoke(gcToken);
    }
    setGcToken(null);
    setGcEvents([]);
    sessionStorage.removeItem('gc_token');
    sessionStorage.removeItem('gc_events');
    toast('Google Calendar disconnected.', { icon: '🔌' });
  };

  // ── Toggle task completion (local tasks only) ──────────────
  const handleToggleStatus = (taskId, dateStr) => {
    const currentCompleted = completions[dateStr] || [];
    const updated = currentCompleted.includes(taskId)
      ? currentCompleted.filter(id => id !== taskId)
      : [...currentCompleted, taskId];
    const newCompletions = { ...completions, [dateStr]: updated };
    setCompletions(newCompletions);
    saveCompletions(newCompletions);
  };

  const formatDateStr = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // ── Build merged event list (local + Google) ───────────────
  const events = useMemo(() => {
    const list = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const buildRange = (dates) => {
      dates.forEach(({ dateObj, dateStr }) => {
        const doneIds = completions[dateStr] || [];
        const activeTasks = tasks.filter(t => !t.date || t.date === dateStr);
        const pendingTasks = activeTasks.filter(t => !doneIds.includes(t.id));
        pendingTasks.forEach(t => {
          list.push({
            id: t.id, date: dateObj.getDate(), dateStr,
            title: t.description, time: t.duration,
            type: t.category, priority: t.priority,
            isCompleted: false, isGoogle: false,
          });
        });
        // Merge Google events for this date
        gcEvents.filter(e => e.dateStr === dateStr).forEach(e => {
          list.push({ ...e, date: dateObj.getDate() });
        });
      });
    };

    if (view === 'Monthly') {
      const days = new Date(year, month + 1, 0).getDate();
      const dates = Array.from({ length: days }, (_, i) => {
        const dateObj = new Date(year, month, i + 1);
        return { dateObj, dateStr: formatDateStr(dateObj) };
      });
      buildRange(dates);
    } else if (view === 'Weekly') {
      const startOfWeek = new Date(currentDate);
      const dayVal = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayVal + (dayVal === 0 ? -6 : 1));
      const dates = Array.from({ length: 7 }, (_, i) => {
        const dateObj = new Date(startOfWeek);
        dateObj.setDate(startOfWeek.getDate() + i);
        return { dateObj, dateStr: formatDateStr(dateObj) };
      });
      buildRange(dates);
    } else {
      const dateStr = formatDateStr(currentDate);
      buildRange([{ dateObj: currentDate, dateStr }]);
    }

    return list;
  }, [tasks, completions, currentDate, view, gcEvents]);

  const handlePrev = () => {
    const d = new Date(currentDate);
    if (view === 'Monthly') d.setMonth(d.getMonth() - 1);
    else if (view === 'Weekly') d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (view === 'Monthly') d.setMonth(d.getMonth() + 1);
    else if (view === 'Weekly') d.setDate(d.getDate() + 7);
    else d.setDate(d.getDate() + 1);
    setCurrentDate(d);
  };

  const gcEventCount = gcEvents.length;

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-3 md:space-y-4 flex flex-col h-full min-h-0">

      {/* ── Google Calendar Banner ── */}
      <div className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 ${
        gcToken
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${gcToken ? 'bg-green-100' : 'bg-gray-100'}`}>
            🗓️
          </div>
          <div>
            <p className="text-xs font-extrabold text-gray-800">
              {gcToken ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-green-600" />
                  Google Calendar Connected
                  {gcEventCount > 0 && <span className="ml-1 bg-green-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{gcEventCount} events</span>}
                </span>
              ) : 'Connect Google Calendar'}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">
              {gcToken
                ? 'Your Google events are merged with Frog Planner tasks below.'
                : 'Sync your real Google events alongside your planner tasks.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {gcError && (
            <span className="text-[10px] text-rose-600 font-semibold flex items-center gap-1">
              <AlertCircle size={11} /> {gcError}
            </span>
          )}
          {gcToken ? (
            <>
              <button onClick={() => fetchGoogleEvents(gcToken)} disabled={gcLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-white border border-green-300 text-green-700 rounded-xl hover:bg-green-50 transition shadow-sm disabled:opacity-60">
                <RefreshCw size={12} className={gcLoading ? 'animate-spin' : ''} />
                {gcLoading ? 'Syncing...' : 'Sync Now'}
              </button>
              <button onClick={handleGcDisconnect}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-white border border-rose-200 text-rose-600 rounded-xl hover:bg-rose-50 transition shadow-sm">
                <LogOut size={12} /> Disconnect
              </button>
            </>
          ) : (
            <button onClick={handleGcConnect}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold bg-green-600 text-white rounded-xl hover:bg-green-700 transition shadow-sm shadow-green-500/20">
              <LogIn size={12} /> Connect Google Calendar
            </button>
          )}
        </div>
      </div>

      {/* ── Setup Instructions (shown when no Client ID configured) ── */}
      {showGcSetup && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2 flex-shrink-0">
          <p className="font-extrabold text-amber-800 flex items-center gap-2">⚙️ Google Calendar Setup Required</p>
          <ol className="space-y-1 text-amber-700 font-medium list-decimal list-inside leading-relaxed">
            <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline font-bold">console.cloud.google.com</a> → Create a new project</li>
            <li>Enable <strong>Google Calendar API</strong> under APIs & Services</li>
            <li>Go to <strong>Credentials</strong> → Create OAuth 2.0 Client ID → Web Application</li>
            <li>Add <code className="bg-amber-100 px-1 rounded">http://localhost:3001</code> to Authorised JavaScript Origins</li>
            <li>Copy the <strong>Client ID</strong></li>
            <li>Create a <code className="bg-amber-100 px-1 rounded">.env</code> file in project root:<br/>
              <code className="bg-amber-100 px-2 py-0.5 rounded block mt-1">VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com</code>
            </li>
            <li>Restart the dev server: <code className="bg-amber-100 px-1 rounded">npm run dev</code></li>
          </ol>
          <button onClick={() => setShowGcSetup(false)} className="text-amber-600 font-bold hover:underline text-[11px]">✕ Close</button>
        </div>
      )}

      {/* ── Calendar Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 w-full border-b border-gray-100 pb-3 flex-shrink-0">

        <div className="flex bg-gray-100 rounded-xl p-1 shadow-inner w-full sm:w-auto">
          {['Today', 'Weekly', 'Monthly'].map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                view === v ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}>
              {v}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 w-full sm:w-auto">
          <h2 className="text-xs sm:text-sm font-bold text-gray-700 truncate">
            {view === 'Monthly' && currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            {view === 'Weekly' && `Week of ${currentDate.toLocaleString('default', { month: 'short', day: 'numeric' })}`}
            {view === 'Today' && currentDate.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
          <div className="flex gap-1 items-center">
            <button onClick={handlePrev} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm text-gray-600 active:scale-95">
              <ChevronLeft size={16} />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-2.5 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm text-[10px] font-bold text-gray-700 active:scale-95">
              Today
            </button>
            <button onClick={handleNext} className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition shadow-sm text-gray-600 active:scale-95">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Google Events Legend (when connected) ── */}
      {gcToken && gcEventCount > 0 && (
        <div className="flex items-center gap-3 text-[10px] font-semibold text-gray-500 flex-shrink-0">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> Frog Planner Tasks</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Google Calendar Events</span>
        </div>
      )}

      {/* ── Main Calendar View ── */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {view === 'Monthly' && <Monthly events={events} currentDate={currentDate} onToggleStatus={handleToggleStatus} />}
        {view === 'Weekly' && <Weekly events={events} currentDate={currentDate} onToggleStatus={handleToggleStatus} />}
        {view === 'Today' && <Daily events={events} onToggleStatus={handleToggleStatus} />}
      </div>

    </div>
  );
}
