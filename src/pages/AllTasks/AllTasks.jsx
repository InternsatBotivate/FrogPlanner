import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2, Clock, Calendar, CheckSquare, Search, AlertCircle,
  Trash2, Edit, ListTodo, ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import { getCategoryEmoji } from '../../utils/helpers';
import DataTable from '../../components/DataTable';
import { useAuthStore } from '../../store/authStore';
import { fetchPlannerData, toggleCompletion, migrateLegacyData } from '../../lib/plannerService';

export default function AllTasks() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);

  // Tabs & filters state
  const [activeTab, setActiveTab] = useState('Pending'); // Pending, History
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrog, setFilterFrog] = useState(''); // "" or "Frog"

  // Pagination states (showing 100 rows by default)
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingItemsPerPage, setPendingItemsPerPage] = useState(100);

  const [historyPage, setHistoryPage] = useState(1);
  const [historyItemsPerPage, setHistoryItemsPerPage] = useState(100);

  // Base reference date (today)
  const today = useMemo(() => new Date(), []);

  // Custom Categories & Durations
  const [customCategories] = useState(() => {
    const saved = localStorage.getItem('index_custom_categories');
    return saved ? JSON.parse(saved) : ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
  });
  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];

  // Load database data with legacy localStorage migration
  useEffect(() => {
    const initData = async () => {
      if (user?.id) {
        setLoading(true);
        // Seamlessly migrate legacy data if any
        await migrateLegacyData(user.id);
        const { tasks: dbTasks, completions: dbComps } = await fetchPlannerData(user.id);
        setTasks(dbTasks || []);
        setCompletions(dbComps || {});
        setLoading(false);
      } else {
        setLoading(false);
      }
    };
    initData();
  }, [user]);

  // Format date helper
  const formatDateStr = (date) => {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Get list of all date strings that have completions or represent today (overall data)
  const dateStrings = useMemo(() => {
    const keys = Object.keys(completions);
    const todayStr = formatDateStr(today);
    if (!keys.includes(todayStr)) {
      keys.push(todayStr);
    }
    // Sort dates descending (newest first)
    return keys.sort((a, b) => b.localeCompare(a));
  }, [completions, today]);

  // Build the flat list of task instances for these dates
  const taskInstances = useMemo(() => {
    const list = [];
    dateStrings.forEach(dStr => {
      const doneIds = completions[dStr] || [];

      // Filter master tasks that are either recurring template (no date) or explicitly for this date
      const activeTasks = tasks.filter(t => !t.date || t.date === dStr);

      activeTasks.forEach(t => {
        const isDone = doneIds.includes(t.id);
        list.push({
          ...t,
          dateInstance: dStr,
          status: isDone ? 'Completed' : 'Pending'
        });
      });
    });
    return list;
  }, [tasks, completions, dateStrings]);

  // Compute overall KPI metrics
  const todayStr = useMemo(() => formatDateStr(today), [today]);

  const kpis = useMemo(() => {
    const activeInstances = taskInstances.filter(t => t.status === 'Completed' || t.selectValue !== 'Done');
    const total = activeInstances.length;
    const completed = activeInstances.filter(t => t.status === 'Completed').length;
    const pending = activeInstances.filter(t => t.status === 'Pending').length;
    const pendingFrog = activeInstances.filter(t => t.status === 'Pending' && t.priority === 'Frog').length;
    const overdue = activeInstances.filter(t => t.status === 'Pending' && t.dateInstance < todayStr).length;

    const categoryPending = {};
    activeInstances.forEach(t => {
      if (t.status === 'Pending') {
        categoryPending[t.category] = (categoryPending[t.category] || 0) + 1;
      }
    });

    return { total, completed, pending, pendingFrog, overdue, categoryPending };
  }, [taskInstances, todayStr]);

  // Toggle status handler with optimistic state updates & Supabase database sync
  const handleToggleStatus = async (taskId, dateStr) => {
    if (!user?.id) return;
    const currentCompleted = completions[dateStr] || [];
    const isAdding = !currentCompleted.includes(taskId);

    // Optimistic UI updates
    let newCompleted;
    if (!isAdding) {
      newCompleted = currentCompleted.filter(id => id !== taskId);
    } else {
      newCompleted = [...currentCompleted, taskId];
    }
    const newCompletions = { ...completions, [dateStr]: newCompleted };
    setCompletions(newCompletions);

    // DB update
    const success = await toggleCompletion(user.id, taskId, dateStr, isAdding);
    if (!success) {
      // Revert if failed
      setCompletions(completions);
    }
  };

  // Filter & Search pending tasks
  const pendingTasks = useMemo(() => {
    return taskInstances
      .filter(item => {
        if (item.status !== 'Pending') return false;
        if (item.selectValue === 'Done') return false;

        // Search filter
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase();
          const match = item.description?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
          if (!match) return false;
        }

        // Duration filter
        if (filterDuration && item.duration !== filterDuration) return false;

        // Category filter
        if (filterCategory && item.category !== filterCategory) return false;

        // Frog filter
        if (filterFrog === 'Frog' && item.priority !== 'Frog') return false;

        return true;
      })
      .sort((a, b) => {
        if (a.dateInstance !== b.dateInstance) {
          return b.dateInstance.localeCompare(a.dateInstance);
        }
        if (a.priority === 'Frog' && b.priority !== 'Frog') return -1;
        if (a.priority !== 'Frog' && b.priority === 'Frog') return 1;
        return 0;
      });
  }, [taskInstances, searchQuery, filterDuration, filterCategory, filterFrog]);

  // Filter & Search history (completed) tasks
  const historyTasks = useMemo(() => {
    return taskInstances
      .filter(item => {
        if (item.status !== 'Completed') return false;

        // Search filter
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase();
          const match = item.description?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
          if (!match) return false;
        }

        // Duration filter
        if (filterDuration && item.duration !== filterDuration) return false;

        // Category filter
        if (filterCategory && item.category !== filterCategory) return false;

        // Frog filter
        if (filterFrog === 'Frog' && item.priority !== 'Frog') return false;

        return true;
      })
      .sort((a, b) => {
        if (a.dateInstance !== b.dateInstance) {
          return b.dateInstance.localeCompare(a.dateInstance);
        }
        if (a.priority === 'Frog' && b.priority !== 'Frog') return -1;
        if (a.priority !== 'Frog' && b.priority === 'Frog') return 1;
        return 0;
      });
  }, [taskInstances, searchQuery, filterDuration, filterCategory, filterFrog]);

  // Paginated lists
  const paginatedPending = useMemo(() => {
    const start = (pendingPage - 1) * pendingItemsPerPage;
    return pendingTasks.slice(start, start + pendingItemsPerPage);
  }, [pendingTasks, pendingPage, pendingItemsPerPage]);

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyItemsPerPage;
    return historyTasks.slice(start, start + historyItemsPerPage);
  }, [historyTasks, historyPage, historyItemsPerPage]);

  // Total pages
  const totalPendingPages = Math.ceil(pendingTasks.length / pendingItemsPerPage);
  const totalHistoryPages = Math.ceil(historyTasks.length / historyItemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setPendingPage(1);
    setHistoryPage(1);
  }, [searchQuery, filterDuration, filterCategory, filterFrog]);

  // Table Headers
  const tableHeaders = ['Action', 'Date', 'Task Description', 'Time', 'Category', 'Status'];

  // Row Renderer for Pending
  const renderPendingRow = (item) => (
    <tr key={`pending-${item.id}-${item.dateInstance}`} className="hover:bg-gray-50 transition-colors text-center text-sm border-b border-gray-100">
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center justify-center">
          <button
            onClick={() => handleToggleStatus(item.id, item.dateInstance)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg border transition-all shadow-sm flex items-center justify-center gap-1.5 ${item.priority === 'Frog'
                ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                : 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-550 hover:text-white'
              }`}
          >
            {item.priority === 'Frog' ? '🐸 Eat Frog' : 'Done'}
          </button>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-900 font-semibold whitespace-nowrap text-xs">
        {item.dateInstance}
      </td>
      <td className="px-4 py-3.5 text-gray-900 font-medium text-center max-w-[200px] md:max-w-xs truncate" title={item.description}>
        <div className="flex items-center justify-center gap-2">
          {item.priority === 'Frog' && (
            <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>
          )}
          <span>{item.description}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-650 whitespace-nowrap text-xs text-center font-bold">
        {item.duration}
      </td>
      <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap text-xs text-center">
        <span className="font-extrabold uppercase text-[11px] text-gray-650 tracking-wider flex items-center justify-center gap-1.5 select-none">
          <span>{getCategoryEmoji(item.category)}</span>
          <span>{item.category}</span>
        </span>
      </td>
      <td className="px-4 py-3.5 text-gray-750 whitespace-nowrap text-xs text-center">
        <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-amber-50 text-amber-600 border border-amber-100 uppercase tracking-wider">
          Pending
        </span>
      </td>
    </tr>
  );

  // Card Renderer for Pending (Mobile)
  const renderPendingCard = (item) => (
    <div key={`pending-card-${item.id}-${item.dateInstance}`} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3 text-left">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-500">{item.dateInstance}</span>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[9px] font-bold uppercase">
            {getCategoryEmoji(item.category)} {item.category}
          </span>
          <span className="px-2 py-0.5 bg-amber-50 text-amber-650 border border-amber-100 rounded text-[9px] font-bold uppercase">Pending</span>
        </div>
      </div>
      <p className="text-sm font-extrabold text-gray-800 tracking-tight flex items-start gap-1.5">
        {item.priority === 'Frog' && <span className="text-base select-none flex-shrink-0">🐸</span>}
        <span>{item.description}</span>
      </p>
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-[10px] font-bold text-gray-550 flex items-center gap-1.5">
          <Clock size={12} /> {item.duration}
        </span>
        <button
          onClick={() => handleToggleStatus(item.id, item.dateInstance)}
          className={`px-3 py-1 text-[11px] font-bold rounded-lg border shadow-sm transition-all ${item.priority === 'Frog'
              ? 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
              : 'bg-emerald-50 text-emerald-605 border-emerald-200 hover:bg-emerald-550 hover:text-white'
            }`}
        >
          {item.priority === 'Frog' ? '🐸 Eat Frog' : 'Done'}
        </button>
      </div>
    </div>
  );

  // Row Renderer for History
  const renderHistoryRow = (item) => (
    <tr key={`history-${item.id}-${item.dateInstance}`} className="hover:bg-gray-50 transition-colors text-center text-sm border-b border-gray-100">
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center justify-center">
          <button
            onClick={() => handleToggleStatus(item.id, item.dateInstance)}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg border border-amber-250 bg-amber-50 text-amber-705 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
          >
            Undo
          </button>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-500 font-semibold whitespace-nowrap text-xs">
        {item.dateInstance}
      </td>
      <td className="px-4 py-3.5 text-gray-400 font-normal text-center max-w-[200px] md:max-w-xs truncate line-through" title={item.description}>
        <div className="flex items-center justify-center gap-2">
          {item.priority === 'Frog' && (
            <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>
          )}
          <span>{item.description}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs text-center font-bold">
        {item.duration}
      </td>
      <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs text-center">
        <span className="font-bold uppercase text-[11px] text-gray-500 tracking-wider flex items-center justify-center gap-1.5 select-none">
          <span>{getCategoryEmoji(item.category)}</span>
          <span>{item.category}</span>
        </span>
      </td>
      <td className="px-4 py-3.5 text-gray-500 whitespace-nowrap text-xs text-center">
        <span className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wider">
          Completed
        </span>
      </td>
    </tr>
  );

  // Card Renderer for History (Mobile)
  const renderHistoryCard = (item) => (
    <div key={`history-card-${item.id}-${item.dateInstance}`} className="bg-white p-4 rounded-xl border border-gray-250 shadow-sm flex flex-col gap-3 text-left opacity-75 animate-in fade-in duration-100">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-500">{item.dateInstance}</span>
        <div className="flex items-center gap-1.5">
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded text-[9px] font-bold uppercase">
            {getCategoryEmoji(item.category)} {item.category}
          </span>
          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded text-[9px] font-bold uppercase">Completed</span>
        </div>
      </div>
      <p className="text-sm font-extrabold text-gray-400 tracking-tight line-through flex items-start gap-1.5">
        {item.priority === 'Frog' && <span className="text-base select-none flex-shrink-0">🐸</span>}
        <span>{item.description}</span>
      </p>
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <span className="text-[10px] font-bold text-gray-550 flex items-center gap-1.5">
          <Clock size={12} /> {item.duration}
        </span>
        <button
          onClick={() => handleToggleStatus(item.id, item.dateInstance)}
          className="px-3 py-1 text-[11px] font-bold rounded-lg border border-amber-250 bg-amber-50 text-amber-705 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
        >
          Undo
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <div className="text-5xl animate-bounce">🐸</div>
        <div className="text-gray-500 font-bold tracking-wide animate-pulse">Loading Task History from Supabase...</div>
      </div>
    );
  }

  return (
    <div className="p-1.5 sm:p-3 lg:p-4 space-y-3 lg:space-y-4 text-left flex flex-col min-h-0 h-full overflow-y-auto md:overflow-hidden">

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {/* Total Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col justify-between text-left">
          <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Total Tasks</span>
          <span className="text-xl md:text-2xl font-black text-gray-800 mt-1">{kpis.total}</span>
        </div>
        {/* Completed Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col justify-between text-left border-l-4 border-l-emerald-500">
          <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Completed</span>
          <span className="text-xl md:text-2xl font-black text-emerald-600 mt-1">{kpis.completed}</span>
        </div>
        {/* Pending Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col justify-between text-left border-l-4 border-l-amber-500">
          <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Pending</span>
          <span className="text-xl md:text-2xl font-black text-amber-600 mt-1">{kpis.pending}</span>
        </div>
        {/* Pending Frogs Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col justify-between text-left border-l-4 border-l-emerald-600">
          <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">🐸 Pending Frogs</span>
          <span className="text-xl md:text-2xl font-black text-emerald-800 mt-1">{kpis.pendingFrog}</span>
        </div>
        {/* Overdue Card */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm flex flex-col justify-between text-left border-l-4 border-l-rose-500 col-span-2 md:col-span-1">
          <span className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider">Overdue Tasks</span>
          <span className="text-xl md:text-2xl font-black text-rose-600 mt-1">{kpis.overdue}</span>
        </div>
      </div>

      {/* Category Pending Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm text-left">
        <h4 className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Category-wise Pending Tasks</h4>
        <div className="flex flex-wrap gap-2">
          {customCategories.map(cat => {
            const count = kpis.categoryPending[cat] || 0;
            return (
              <span
                key={cat}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${count > 0
                    ? 'bg-indigo-50 border-indigo-150 text-indigo-700'
                    : 'bg-gray-50 border-gray-205 text-gray-400'
                  }`}
              >
                {cat}: {count}
              </span>
            );
          })}
        </div>
      </div>

      {/* Combined Controls Row (Tabs switcher + Filters combined) */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">

          {/* Left Side: Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 self-start xl:self-auto flex-shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setActiveTab('Pending')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'Pending'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Pending ({pendingTasks.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('History')}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'History'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>History ({historyTasks.length})</span>
            </button>
          </div>

          {/* Right Side: Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-start xl:justify-end w-full">
            {/* Search bar */}
            <div className="relative w-full sm:w-60 md:w-64">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description..."
                className="w-full pl-9 pr-3 py-1.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[32px]"
              />
            </div>

            {/* Time Selector */}
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
              className="border border-gray-300 rounded-xl text-xs px-3 py-1.5 bg-white text-gray-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[32px] w-full sm:w-auto"
            >
              <option value="">All Times</option>
              {durationOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* Category Selector */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-xl text-xs px-3 py-1.5 bg-white text-gray-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[32px] w-full sm:w-auto"
            >
              <option value="">All Categories</option>
              {customCategories.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* Frog filter toggle */}
            <button
              onClick={() => setFilterFrog(prev => prev === 'Frog' ? '' : 'Frog')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 h-[32px] w-full sm:w-auto ${filterFrog === 'Frog'
                  ? 'bg-emerald-50 border-emerald-250 text-emerald-700 shadow-sm'
                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
            >
              <span>🐸 Frog Tasks</span>
              {filterFrog === 'Frog' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
            </button>

            {/* Clear Button */}
            {(searchQuery || filterDuration || filterCategory || filterFrog) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterDuration('');
                  setFilterCategory('');
                  setFilterFrog('');
                }}
                className="text-xs text-red-500 hover:text-red-700 font-bold hover:underline py-1 px-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Area (Shows Active Tab Table) */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col justify-between flex-1 min-h-[450px] md:min-h-0 overflow-hidden">

        {activeTab === 'Pending' ? (
          <DataTable
            headers={tableHeaders}
            data={paginatedPending}
            renderRow={renderPendingRow}
            renderCard={renderPendingCard}
            minWidth="900px"
            currentPage={pendingPage}
            totalPages={totalPendingPages}
            itemsPerPage={pendingItemsPerPage}
            totalResults={pendingTasks.length}
            onPageChange={setPendingPage}
            onItemsPerPageChange={(val) => { setPendingItemsPerPage(val); setPendingPage(1); }}
          />
        ) : (
          <DataTable
            headers={tableHeaders}
            data={paginatedHistory}
            renderRow={renderHistoryRow}
            renderCard={renderHistoryCard}
            minWidth="900px"
            currentPage={historyPage}
            totalPages={totalHistoryPages}
            itemsPerPage={historyItemsPerPage}
            totalResults={historyTasks.length}
            onPageChange={setHistoryPage}
            onItemsPerPageChange={(val) => { setHistoryItemsPerPage(val); setHistoryPage(1); }}
          />
        )}

      </div>

    </div>
  );
}
