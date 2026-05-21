import React, { useState, useMemo, useEffect } from 'react';
import {
  CheckCircle2, Clock, Calendar, CheckSquare, Search, AlertCircle,
  Trash2, Edit, ListTodo, ChevronLeft, ChevronRight, Zap
} from 'lucide-react';
import { getCategoryEmoji } from '../../utils/helpers';
import DataTable from '../../components/DataTable';
import { useAuthStore } from '../../store/authStore';
import { fetchPlannerData, toggleCompletion, migrateLegacyData } from '../../lib/plannerService';

// Format date helper
const formatDateStr = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function AllTasks() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [completions, setCompletions] = useState({});
  const [loading, setLoading] = useState(true);

  // Tabs & filters state
  const [activeTab, setActiveTab] = useState('Pending'); // Pending, History, All
  const [kpiFilter, setKpiFilter] = useState('Pending'); // Pending, Completed, Frog, Overdue, All
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrog, setFilterFrog] = useState(''); // "" or "Frog"
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [showFrogModal, setShowFrogModal] = useState(false);

  // Unified Pagination states (showing 100 rows by default)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);

  // Base reference date (today)
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => formatDateStr(today), [today]);

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



  // Get list of all date strings that have completions, explicit task dates, or represent today (overall data)
  const dateStrings = useMemo(() => {
    const keys = new Set(Object.keys(completions));
    
    // Include all explicit dates from user's tasks
    tasks.forEach(t => {
      if (t.date) {
        keys.add(t.date);
      }
    });

    const todayStr = formatDateStr(today);
    keys.add(todayStr);

    // Sort dates descending (newest first)
    return Array.from(keys).sort((a, b) => b.localeCompare(a));
  }, [completions, tasks, today]);

  // Build the flat list of task instances for these dates
  const taskInstances = useMemo(() => {
    const list = [];
    dateStrings.forEach(dStr => {
      const doneIds = completions[dStr] || [];

      // Filter master tasks that are either recurring template (no date) or explicitly for this date
      // For recurring tasks, only activate them for today or in the past (not future dates)
      const activeTasks = tasks.filter(t => {
        if (!t.date) {
          return dStr <= todayStr;
        }
        return t.date === dStr;
      });

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
  }, [tasks, completions, dateStrings, todayStr]);

  // Compute overall KPI metrics

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

  // Filter & Search tasks based on activeTab, kpiFilter, and other filters
  const filteredTasks = useMemo(() => {
    return taskInstances
      .filter(item => {
        // 1. Filter by activeTab status
        if (activeTab === 'Pending') {
          if (item.status !== 'Pending') return false;
          if (item.selectValue === 'Done') return false;
        } else if (activeTab === 'History') {
          if (item.status !== 'Completed') return false;
        }

        // 2. KPI Filter specific constraints
        if (kpiFilter === 'Frog') {
          if (item.priority !== 'Frog' || item.status !== 'Pending') return false;
        } else if (kpiFilter === 'Overdue') {
          if (item.status !== 'Pending' || item.dateInstance >= todayStr) return false;
        } else if (kpiFilter === 'Completed') {
          if (item.status !== 'Completed') return false;
        } else if (kpiFilter === 'Pending') {
          if (item.status !== 'Pending') return false;
        }

        // 3. Search filter
        if (searchQuery.trim().length > 0) {
          const q = searchQuery.toLowerCase();
          const match = item.description?.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q);
          if (!match) return false;
        }

        // 4. Duration filter
        if (filterDuration && item.duration !== filterDuration) return false;

        // 5. Category filter
        if (filterCategory && item.category !== filterCategory) return false;

        // 6. Frog filter toggle (from search panel)
        if (filterFrog === 'Frog' && item.priority !== 'Frog') return false;

        // 7. Date range filter
        if (fromDate && item.dateInstance < fromDate) return false;
        if (toDate && item.dateInstance > toDate) return false;

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
  }, [taskInstances, activeTab, kpiFilter, searchQuery, filterDuration, filterCategory, filterFrog, todayStr, fromDate, toDate]);

  // Unified Paginated list
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTasks.slice(start, start + itemsPerPage);
  }, [filteredTasks, currentPage, itemsPerPage]);

  // Total pages
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, kpiFilter, searchQuery, filterDuration, filterCategory, filterFrog, fromDate, toDate]);

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

  const renderRow = (item) => {
    if (item.status === 'Completed') return renderHistoryRow(item);
    return renderPendingRow(item);
  };

  const renderCard = (item) => {
    if (item.status === 'Completed') return renderHistoryCard(item);
    return renderPendingCard(item);
  };

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
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {/* Total Card */}
        <button
          type="button"
          onClick={() => {
            setKpiFilter('All');
            setActiveTab('All');
          }}
          className={`rounded-xl p-2 sm:p-2.5 border transition-all duration-150 active:scale-95 text-left flex flex-col justify-between shadow-sm cursor-pointer ${
            kpiFilter === 'All'
              ? 'bg-slate-800 border-slate-900 text-white ring-2 ring-slate-400/30'
              : 'bg-white border-gray-200 text-gray-500 hover:bg-slate-50'
          }`}
        >
          <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${kpiFilter === 'All' ? 'text-slate-300' : 'text-gray-400'}`}>Total Tasks</span>
          <span className={`text-base sm:text-lg font-black mt-0.5 ${kpiFilter === 'All' ? 'text-white' : 'text-gray-800'}`}>{kpis.total}</span>
        </button>

        {/* Completed Card */}
        <button
          type="button"
          onClick={() => {
            setKpiFilter('Completed');
            setActiveTab('History');
          }}
          className={`rounded-xl p-2 sm:p-2.5 border border-l-4 transition-all duration-150 active:scale-95 text-left flex flex-col justify-between shadow-sm cursor-pointer ${
            kpiFilter === 'Completed'
              ? 'bg-emerald-600 border-emerald-700 border-l-emerald-800 text-white ring-2 ring-emerald-400/30'
              : 'bg-white border-gray-200 border-l-emerald-500 text-gray-500 hover:bg-emerald-50/50'
          }`}
        >
          <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${kpiFilter === 'Completed' ? 'text-emerald-100' : 'text-gray-400'}`}>Completed</span>
          <span className={`text-base sm:text-lg font-black mt-0.5 ${kpiFilter === 'Completed' ? 'text-white' : 'text-emerald-600'}`}>{kpis.completed}</span>
        </button>

        {/* Pending Card */}
        <button
          type="button"
          onClick={() => {
            setKpiFilter('Pending');
            setActiveTab('Pending');
          }}
          className={`rounded-xl p-2 sm:p-2.5 border border-l-4 transition-all duration-150 active:scale-95 text-left flex flex-col justify-between shadow-sm cursor-pointer ${
            kpiFilter === 'Pending'
              ? 'bg-amber-500 border-amber-600 border-l-amber-700 text-white ring-2 ring-amber-400/30'
              : 'bg-white border-gray-200 border-l-amber-500 text-gray-500 hover:bg-amber-50/50'
          }`}
        >
          <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${kpiFilter === 'Pending' ? 'text-amber-100' : 'text-gray-400'}`}>Pending</span>
          <span className={`text-base sm:text-lg font-black mt-0.5 ${kpiFilter === 'Pending' ? 'text-white' : 'text-amber-650'}`}>{kpis.pending}</span>
        </button>

        {/* Pending Frogs Card */}
        <button
          type="button"
          onClick={() => {
            setKpiFilter('Frog');
            setActiveTab('Pending');
          }}
          className={`rounded-xl p-2 sm:p-2.5 border border-l-4 transition-all duration-150 active:scale-95 text-left flex flex-col justify-between shadow-sm cursor-pointer ${
            kpiFilter === 'Frog'
              ? 'bg-green-700 border-green-800 border-l-green-900 text-white ring-2 ring-green-400/30'
              : 'bg-white border-gray-200 border-l-emerald-600 text-gray-500 hover:bg-green-50/50'
          }`}
        >
          <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${kpiFilter === 'Frog' ? 'text-green-100' : 'text-gray-400'}`}>
            <span>🐸 Frogs</span>
          </span>
          <span className={`text-base sm:text-lg font-black mt-0.5 ${kpiFilter === 'Frog' ? 'text-white' : 'text-emerald-800'}`}>{kpis.pendingFrog}</span>
        </button>

        {/* Overdue Card */}
        <button
          type="button"
          onClick={() => {
            setKpiFilter('Overdue');
            setActiveTab('Pending');
          }}
          className={`rounded-xl p-2 sm:p-2.5 border border-l-4 transition-all duration-150 active:scale-95 text-left flex flex-col justify-between shadow-sm cursor-pointer col-span-2 sm:col-span-1 ${
            kpiFilter === 'Overdue'
              ? 'bg-rose-600 border-rose-700 border-l-rose-800 text-white ring-2 ring-rose-400/30'
              : 'bg-white border-gray-200 border-l-rose-500 text-gray-500 hover:bg-rose-50/50'
          }`}
        >
          <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider ${kpiFilter === 'Overdue' ? 'text-rose-100' : 'text-gray-400'}`}>Overdue</span>
          <span className={`text-base sm:text-lg font-black mt-0.5 ${kpiFilter === 'Overdue' ? 'text-white' : 'text-rose-600'}`}>{kpis.overdue}</span>
        </button>
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
              onClick={() => {
                setActiveTab('Pending');
                setKpiFilter('Pending');
              }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'Pending'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <span>Pending ({kpis.pending})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('History');
                setKpiFilter('Completed');
              }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'History'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>History ({kpis.completed})</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('All');
                setKpiFilter('All');
              }}
              className={`flex-1 sm:flex-initial px-4 py-1.5 rounded-lg text-[11px] md:text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === 'All'
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
                }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span>All Tasks ({kpis.total})</span>
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

            {/* Date Filters */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-gray-405 uppercase shrink-0">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border border-gray-300 rounded-xl text-xs px-2.5 py-1 bg-white text-gray-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[32px] w-full sm:w-auto"
              />
            </div>

            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <span className="text-[10px] font-bold text-gray-405 uppercase shrink-0">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border border-gray-300 rounded-xl text-xs px-2.5 py-1 bg-white text-gray-700 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[32px] w-full sm:w-auto"
              />
            </div>

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

            {/* Frog Tasks Modal Button */}
            <button
              onClick={() => setShowFrogModal(true)}
              className="px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 h-[32px] w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 shadow-sm active:scale-95"
            >
              <span>🐸 View Frog Tasks</span>
              {kpis.pendingFrog > 0 && (
                <span className="bg-white text-emerald-700 font-black text-[9px] rounded-full w-4 h-4 flex items-center justify-center leading-none">{kpis.pendingFrog}</span>
              )}
            </button>

            {/* Clear Button */}
            {(searchQuery || filterDuration || filterCategory || filterFrog || fromDate || toDate || kpiFilter !== 'Pending') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterDuration('');
                  setFilterCategory('');
                  setFilterFrog('');
                  setFromDate('');
                  setToDate('');
                  setKpiFilter('Pending');
                  setActiveTab('Pending');
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
        <DataTable
          headers={tableHeaders}
          data={paginatedTasks}
          renderRow={renderRow}
          renderCard={renderCard}
          minWidth="900px"
          currentPage={currentPage}
          totalPages={totalPages}
          itemsPerPage={itemsPerPage}
          totalResults={filteredTasks.length}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
        />
      </div>
      {/* 🐸 Frog Tasks Modal */}
      {showFrogModal && (() => {
        const frogTasks = taskInstances.filter(t => t.priority === 'Frog' && t.status === 'Pending');
        const frogDone = taskInstances.filter(t => t.priority === 'Frog' && t.status === 'Completed').length;
        const frogTotal = frogTasks.length + frogDone;
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowFrogModal(false); }}
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden" style={{ maxHeight: '85vh' }}>

              {/* Modal Header */}
              <div className="p-5 pb-4 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="text-4xl select-none leading-none">🐸</div>
                    <div>
                      <h2 className="text-base font-black text-gray-800 tracking-tight">Today's Frog Tasks</h2>
                      <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">High priority tasks that must be accomplished first</p>
                    </div>
                  </div>
                  {frogTotal > 0 && (
                    <span className="shrink-0 text-[11px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-1">
                      {frogDone} / {frogTotal} Done
                    </span>
                  )}
                </div>
              </div>

              {/* Task List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {frogTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <span className="text-5xl select-none">🎉</span>
                    <p className="text-sm font-bold text-gray-700">All frogs eaten!</p>
                    <p className="text-xs text-gray-400">No pending frog tasks remaining. Great work!</p>
                  </div>
                ) : (
                  frogTasks.map(t => (
                    <div
                      key={`frog-modal-${t.id}-${t.dateInstance}`}
                      className="bg-white border border-gray-100 rounded-2xl p-3.5 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {/* Badges row */}
                      <div className="flex items-center gap-1.5 mb-2">
                        {t.duration && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 border border-gray-200 rounded text-[9px] font-bold uppercase tracking-wide">
                            {t.duration}
                          </span>
                        )}
                        {t.category && (
                          <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded text-[9px] font-bold uppercase tracking-wide">
                            {getCategoryEmoji(t.category)} {t.category}
                          </span>
                        )}
                        {t.dateInstance && (
                          <span className="ml-auto px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-100 rounded text-[9px] font-semibold">
                            {t.dateInstance}
                          </span>
                        )}
                      </div>
                      {/* Description + action */}
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-gray-800 leading-snug flex-1">{t.description}</p>
                        <button
                          onClick={() => handleToggleStatus(t.id, t.dateInstance)}
                          className="shrink-0 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm active:scale-95 transition-all flex items-center gap-1"
                        >
                          🐸 Eat Frog
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="p-4 pt-3 border-t border-gray-100 bg-gray-50/60">
                <button
                  onClick={() => setShowFrogModal(false)}
                  className="w-full py-2 text-sm font-bold text-gray-500 hover:text-gray-700 transition-colors rounded-xl hover:bg-gray-100"
                >
                  Close Dialog
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
