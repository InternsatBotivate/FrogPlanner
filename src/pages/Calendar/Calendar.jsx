import React, { useState, useEffect, useMemo, useCallback } from 'react';
import FrogLogo from '../../components/FrogLogo';
import { ChevronLeft, ChevronRight, LogIn, LogOut, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import Daily from './Daily';
import Weekly from './Weekly';
import Monthly from './Monthly';
import { useAuthStore } from '../../store/authStore';
import { usePlannerStore } from '../../store/plannerStore';
import useGoogleCalendar from '../../hooks/useGoogleCalendar';
import toast from 'react-hot-toast';

export default function Calendar() {
  const { user } = useAuthStore();
  const [view, setView] = useState('Monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showGcSetup, setShowGcSetup] = useState(false);

  // Central tasks & completions from Zustand store
  const { tasks, completions, loading, fetchPlannerData, toggleCompletion } = usePlannerStore();

  // ── Google Calendar — all logic delegated to the custom hook ──────
  // The hook handles: silent reconnect on mount, token refresh, event
  // fetching, task syncing, connect, and disconnect.
  const {
    gcToken,
    gcEvents,
    gcLoading,
    gcError,
    isConnected,
    connect,
    disconnect,
    syncTasks,
    fetchEvents,
    hasClientId,
  } = useGoogleCalendar(user?.id);

  // ── Fetch planner data on login ───────────────────────────────────
  useEffect(() => {
    if (user?.id) fetchPlannerData(user.id);
  }, [user, fetchPlannerData]);

  // ── Auto-sync new/unsynced tasks whenever tasks or token change ───
  // Runs when: token arrives (initial connect or silent re-auth),
  //            or when new tasks are added to the store.
  useEffect(() => {
    if (gcToken && tasks.length > 0 && !loading && !gcLoading) {
      syncTasks(gcToken, tasks, gcEvents);
    }
  }, [gcToken, tasks, loading]); // intentionally excludes gcEvents/gcLoading to avoid loop

  // ── UI handlers ───────────────────────────────────────────────────
  const handleGcConnect = useCallback(async () => {
    if (!hasClientId) { setShowGcSetup(true); return; }
    await connect();
  }, [hasClientId, connect]);

  const handleGcDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  // ── Toggle task completion (Supabase sync) ────────────────────────
  const handleToggleStatus = async (taskId, dateStr) => {
    if (!user?.id) return;
    const currentCompleted = completions[dateStr] || [];
    const isCompleted = !currentCompleted.includes(taskId);
    const success = await toggleCompletion(user.id, taskId, dateStr, isCompleted);
    if (success) {
      toast.success(isCompleted ? 'Task completed! 🎉' : 'Task marked pending. ⏳');
    } else {
      toast.error('Failed to update task completion status.');
    }
  };

  const formatDateStr = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // ── Build merged event list (local tasks + Google Calendar events) ─
  const events = useMemo(() => {
    const list = [];
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const buildRange = (dates) => {
      dates.forEach(({ dateObj, dateStr }) => {
        const doneIds = completions[dateStr] || [];
        const activeTasks = tasks.filter(t => t.isRecurring || t.date === dateStr);
        const pendingTasks = activeTasks.filter(t => !doneIds.includes(t.id));
        pendingTasks.forEach(t => {
          list.push({
            id: t.id, date: dateObj.getDate(), dateStr,
            title: t.description, time: t.duration,
            type: t.category, priority: t.priority,
            isCompleted: false, isGoogle: false,
          });
        });
        // Merge Google Calendar events for this date
        gcEvents.filter(e => e.dateStr === dateStr).forEach(e => {
          list.push({ ...e, date: dateObj.getDate() });
        });
      });
    };

    if (view === 'Monthly') {
      const days = new Date(year, month + 1, 0).getDate();
      buildRange(Array.from({ length: days }, (_, i) => {
        const dateObj = new Date(year, month, i + 1);
        return { dateObj, dateStr: formatDateStr(dateObj) };
      }));
    } else if (view === 'Weekly') {
      const startOfWeek = new Date(currentDate);
      const dayVal = startOfWeek.getDay();
      startOfWeek.setDate(startOfWeek.getDate() - dayVal + (dayVal === 0 ? -6 : 1));
      buildRange(Array.from({ length: 7 }, (_, i) => {
        const dateObj = new Date(startOfWeek);
        dateObj.setDate(startOfWeek.getDate() + i);
        return { dateObj, dateStr: formatDateStr(dateObj) };
      }));
    } else {
      buildRange([{ dateObj: currentDate, dateStr: formatDateStr(currentDate) }]);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <FrogLogo className="w-16 h-16 animate-bounce" />
        <div className="text-gray-500 font-bold tracking-wide animate-pulse">Loading Calendar Data from Supabase...</div>
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-3 md:space-y-4 flex flex-col h-full min-h-0">

      {/* ── Google Calendar Banner ── */}
      <div className={`rounded-2xl border px-4 py-3 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 ${
        isConnected
          ? 'bg-green-50 border-green-200'
          : 'bg-white border-gray-200 shadow-sm'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base ${isConnected ? 'bg-green-100' : 'bg-gray-100'}`}>
            🗓️
          </div>
          <div>
            <p className="text-xs font-extrabold text-gray-800">
              {isConnected ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 size={13} className="text-green-600" />
                  Google Calendar Connected
                  {gcEventCount > 0 && <span className="ml-1 bg-green-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full">{gcEventCount} events</span>}
                </span>
              ) : 'Connect Google Calendar'}
            </p>
            <p className="text-[10px] text-gray-400 font-medium">
              {isConnected
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
          {isConnected ? (
            <>
              <button onClick={() => fetchEvents(gcToken)} disabled={gcLoading}
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

      {/* ── Setup Instructions (shown when no Client ID is configured) ── */}
      {showGcSetup && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs space-y-2 flex-shrink-0">
          <p className="font-extrabold text-amber-800 flex items-center gap-2">⚙️ Google Calendar Setup Required</p>
          <ol className="space-y-1 text-amber-700 font-medium list-decimal list-inside leading-relaxed">
            <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline font-bold">console.cloud.google.com</a> → Create a new project</li>
            <li>Enable <strong>Google Calendar API</strong> under APIs &amp; Services</li>
            <li>Go to <strong>Credentials</strong> → Create OAuth 2.0 Client ID → Web Application</li>
            <li>Add <code className="bg-amber-100 px-1 rounded">http://localhost:3000</code> to Authorised JavaScript Origins</li>
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
      {isConnected && gcEventCount > 0 && (
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
