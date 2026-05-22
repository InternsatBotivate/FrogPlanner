import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Plus, Trash2, Lock, Calendar, Sparkles, 
  Send, RefreshCw, AlertCircle, CalendarRange, Info, ListTodo, 
  CheckCircle2, PlusCircle, Check, HelpCircle, Flame, ArrowRight,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { usePlannerStore } from '../../store/plannerStore';
import { getCategoryEmoji } from '../../utils/helpers';
import ModalAlert from '../../components/ModalAlert';

export default function UpcomingPlanner() {
  const { user } = useAuthStore();
  const storeTasks = usePlannerStore(state => state.tasks);
  const storeLoading = usePlannerStore(state => state.loading);
  
  // Loading & Alerts
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: () => {} });
  
  // Target Planning Date (Defaults to Tomorrow)
  const getTomorrowStr = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyy = tomorrow.getFullYear();
    const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const dd = String(tomorrow.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  // Always plan for tomorrow only — fixed date
  const tomorrowStr = useMemo(() => getTomorrowStr(), []);
  const planningDate = tomorrowStr;

  const getDurationEmoji = (duration) => {
    switch (duration) {
      case 'Morning': return '🌅';
      case 'Afternoon': return '☀️';
      case 'Evening': return '🌇';
      case 'Night': return '🌙';
      default: return '⏰';
    }
  };

  const getCategoryColorClass = (cat) => {
    const c = String(cat).toLowerCase();
    if (c.includes('work') || c.includes('job')) return 'bg-blue-50 text-blue-700 border-blue-150';
    if (c.includes('meet') || c.includes('call')) return 'bg-purple-50 text-purple-700 border-purple-150';
    if (c.includes('person') || c.includes('home')) return 'bg-pink-50 text-pink-700 border-pink-150';
    if (c.includes('health') || c.includes('fit')) return 'bg-emerald-50 text-emerald-700 border-emerald-150';
    if (c.includes('review') || c.includes('test')) return 'bg-amber-50 text-amber-700 border-amber-150';
    return 'bg-sky-50 text-sky-700 border-sky-150';
  };

  // Core Data States
  const [recurringTasks, setRecurringTasks] = useState([]); // Loaded from main 'tasks' template (date is null)
  const [alreadyPlannedTasks, setAlreadyPlannedTasks] = useState([]); // Loaded from 'upcoming_tasks' for tomorrow
  const [unsavedTasks, setUnsavedTasks] = useState([]); // Temporary custom tasks added but not yet saved
  const [activeFilter, setActiveFilter] = useState('Recurring');

  // Derived: has the user already planned tomorrow?
  const isAlreadyPlanned = alreadyPlannedTasks.length > 0;

  // Sync tasks from store
  useEffect(() => {
    const recTasks = (storeTasks || []).filter(t => t.isRecurring);
    const planned = (storeTasks || []).filter(t => t.date === planningDate && !t.isRecurring)
      .map(t => ({
        ...t,
        status: t.selectValue === 'Done' ? 'Completed' : 'Pending'
      }));
    setRecurringTasks(recTasks);
    setAlreadyPlannedTasks(planned);
  }, [storeTasks, planningDate]);

  // Sync loading state
  useEffect(() => {
    if (!usePlannerStore.getState().hasLoaded) {
      setLoading(storeLoading);
    } else {
      setLoading(false);
    }
  }, [storeLoading]);
  
  // Custom Categories
  const [customCategories, setCustomCategories] = useState(() => {
    const saved = localStorage.getItem('index_custom_categories');
    return saved ? JSON.parse(saved) : ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
  });

  // Inline Single Task Form State
  const [inlineTask, setInlineTask] = useState({
    description: '',
    duration: 'Morning',
    category: customCategories[0] || 'Work',
    priority: '',
    isCreatingCategory: false,
    newCategoryText: ''
  });

  
  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];

  // Initial Load (triggers preloader once in store)
  useEffect(() => {
    const initPlanner = async () => {
      if (user?.id) {
        await usePlannerStore.getState().fetchPlannerData(user.id);
      }
    };
    initPlanner();
  }, [user?.id]);

  // Alert Modal helper
  const showAlert = (type, title, message, onConfirm = () => {}) => {
    setAlertConfig({ isOpen: true, type, title, message, onConfirm });
  };

  // Live Count Calculations
  const counts = useMemo(() => {
    const recurringCount = recurringTasks.length;
    const customPlannedCount = alreadyPlannedTasks.length;
    const unsavedCount = unsavedTasks.length;
    const totalPlannedCount = recurringCount + customPlannedCount + unsavedCount;
    return {
      recurring: recurringCount,
      customPlanned: customPlannedCount + unsavedCount,
      totalPlanned: totalPlannedCount
    };
  }, [recurringTasks, alreadyPlannedTasks, unsavedTasks]);

  // Displayed tasks count in current view
  const displayedTasksCount = useMemo(() => {
    let count = 0;
    if (activeFilter === 'All' || activeFilter === 'Recurring') {
      count += recurringTasks.length;
    }
    if (activeFilter === 'All' || activeFilter === 'Custom') {
      count += alreadyPlannedTasks.length + unsavedTasks.length;
    }
    return count;
  }, [activeFilter, recurringTasks, alreadyPlannedTasks, unsavedTasks]);

  // --- Inline Row Category Handlers ---
  const handleInlineCategoryChange = (value) => {
    if (value === '__NEW__') {
      setInlineTask(prev => ({ ...prev, isCreatingCategory: true }));
    } else {
      setInlineTask(prev => ({ ...prev, category: value }));
    }
  };

  const handleConfirmInlineCategory = () => {
    const text = (inlineTask.newCategoryText || '').trim();
    if (!text) {
      setInlineTask(prev => ({ ...prev, isCreatingCategory: false }));
      return;
    }

    const updatedCategories = customCategories.includes(text) 
      ? customCategories 
      : [...customCategories, text];
      
    if (!customCategories.includes(text)) {
      setCustomCategories(updatedCategories);
      localStorage.setItem('index_custom_categories', JSON.stringify(updatedCategories));
    }
    
    setInlineTask(prev => ({
      ...prev,
      category: text,
      isCreatingCategory: false,
      newCategoryText: ''
    }));
    toast.success(`Category "${text}" added!`);
  };

  // --- Add Inline Task ---
  const handleAddInlineTask = () => {
    if (!user?.id) return;
    const desc = inlineTask.description.trim();
    if (!desc) {
      toast.error('Please enter a task description.');
      return;
    }

    const tempTask = {
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      description: desc,
      duration: inlineTask.duration,
      category: inlineTask.category,
      priority: inlineTask.priority || '',
      date: planningDate,
      status: 'Pending',
      remarks: ''
    };

    setUnsavedTasks(prev => [...prev, tempTask]);
    toast.success('Task added to draft! Click Submit to save.');
    
    setInlineTask({
      description: '',
      duration: inlineTask.duration,
      category: inlineTask.category,
      priority: '',
      isCreatingCategory: false,
      newCategoryText: ''
    });
  };

  // --- Saved Tasks Real-Time Handlers ---
  const handleToggleSavedTaskStatus = async (item) => {
    const newStatus = item.status === 'Completed' ? 'Pending' : 'Completed';
    
    // If it's a draft task, update locally
    if (String(item.id).startsWith('temp-')) {
      setUnsavedTasks(prev =>
        prev.map(t => t.id === item.id ? { ...t, status: newStatus } : t)
      );
      toast.success(newStatus === 'Completed' ? 'Task completed!' : 'Task set to pending.');
      return;
    }

    const success = await usePlannerStore.getState().updateTaskField(item.id, 'selectValue', newStatus === 'Completed' ? 'Done' : 'Pending');
    if (!success) {
      toast.error('Failed to update status.');
    } else {
      toast.success(newStatus === 'Completed' ? 'Task completed!' : 'Task set to pending.');
    }
  };

  const handleDeleteSavedTask = async (taskId) => {
    // If it's a draft task, remove locally
    if (String(taskId).startsWith('temp-')) {
      setUnsavedTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('Temporary task removed.');
      return;
    }

    showAlert('confirm', 'Remove Task?', 'Are you sure you want to delete this task from the database?', async () => {
      setLoading(true);
      const success = await usePlannerStore.getState().deleteTask(taskId);
      if (success) {
        toast.success('Task removed from planner.');
      } else {
        toast.error('Failed to delete task.');
      }
      setLoading(false);
    });
  };

  // Batch Save all unsaved tasks to Supabase (excludes recurring templates)
  const handleSaveAllUpcomingTasks = async () => {
    if (unsavedTasks.length === 0) return;
    setSubmitting(true);
    try {
      // Only save non-recurring custom tasks, mapping status to selectValue and formatting for addPlannerTasks
      const payload = unsavedTasks
        .filter(t => !t.isRecurring)
        .map(({ id, status, ...rest }) => ({
          ...rest,
          selectValue: status === 'Completed' ? 'Done' : 'Pending',
          isRecurring: false
        }));

      if (payload.length === 0) {
        toast.error('No custom tasks to save.');
        setSubmitting(false);
        return;
      }

      const created = await usePlannerStore.getState().addPlannerTasks(user.id, payload);
      if (created && created.length > 0) {
        // Reset draft state
        setUnsavedTasks([]);
        setInlineTask({
          description: '',
          duration: 'Morning',
          category: customCategories[0] || 'Work',
          priority: '',
          isCreatingCategory: false,
          newCategoryText: ''
        });
        setActiveFilter('Recurring');
        toast.success('Tasks added for your next day successfully! 🐸', {
          duration: 4000,
          style: {
            background: '#065f46',
            color: '#ecfdf5',
            fontWeight: '700',
            fontSize: '13px',
            borderRadius: '12px',
            padding: '12px 16px',
          },
          icon: '✅',
        });
      } else {
        toast.error('Failed to save tasks to the database.');
      }
    } catch (err) {
      console.error('[UpcomingPlanner] Save all failed:', err);
      toast.error('Error occurred while saving tasks.');
    } finally {
      setSubmitting(false);
    }
  };

  // if (loading) {
  //   return (
  //     <div className="p-4 space-y-4 text-left flex flex-col min-h-screen justify-center items-center bg-gray-55/30">
  //       <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-gray-150 shadow-sm max-w-sm w-full">
  //         <span className="text-4xl animate-bounce select-none block mb-3">🐸</span>
  //         <p className="text-sm font-semibold text-gray-500 animate-pulse flex items-center gap-1.5">
  //           <RefreshCw size={14} className="animate-spin text-indigo-505" />
  //           Loading Next Day Planner...
  //         </p>
  //       </div>
  //     </div>
  //   );
  // }

  // ── Already-Planned Locked State ──────────────────────────────────────────
  if (!loading && isAlreadyPlanned) {
    return (
      <div className="p-3 sm:p-5 lg:p-6 text-left flex flex-col min-h-0 h-full overflow-y-auto bg-gray-50/50 pb-20 items-center justify-center">
        <div className="max-w-md w-full mx-auto">
          {/* Success Card */}
          <div className="bg-white rounded-3xl border border-emerald-100 shadow-lg p-8 flex flex-col items-center text-center gap-5">
            {/* Big frog + check badge */}
            <div className="relative">
              <div className="text-6xl select-none">🐸</div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-md">
                <CheckCircle2 size={16} className="text-white" strokeWidth={3} />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-xl font-black text-gray-800 tracking-tight">
                Tomorrow is all set! 🎉
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                You've already planned your tasks for{' '}
                <span className="font-bold text-emerald-600">{planningDate}</span>.
                Come back after midnight to plan the next day.
              </p>
            </div>

            {/* Stats row */}
            <div className="w-full grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex flex-col items-center gap-1">
                <span className="text-2xl font-black text-emerald-700">{alreadyPlannedTasks.length}</span>
                <span className="text-[10px] uppercase font-bold text-emerald-500 tracking-wider">Custom Tasks</span>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col items-center gap-1">
                <span className="text-2xl font-black text-slate-700">{recurringTasks.length}</span>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">🔄 Recurring</span>
              </div>
            </div>

            {/* Planned task list preview */}
            {alreadyPlannedTasks.length > 0 && (
              <div className="w-full text-left space-y-2 max-h-72 overflow-y-auto">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
                  Your Planned Tasks ({alreadyPlannedTasks.length})
                </p>
                {alreadyPlannedTasks.map(t => (
                  <div
                    key={t.id}
                    className={`flex flex-col gap-1.5 bg-white border rounded-xl px-3 py-2.5 shadow-sm ${
                      t.priority === 'Frog' ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-100'
                    }`}
                  >
                    {/* Top row: frog badge + description */}
                    <div className="flex items-start gap-2">
                      {t.priority === 'Frog' ? (
                        <span className="text-base shrink-0 leading-none mt-0.5">🐸</span>
                      ) : (
                        <span className="shrink-0 mt-0.5 text-emerald-400"><CheckCircle2 size={13} /></span>
                      )}
                      <span className={`text-xs font-semibold leading-snug ${t.priority === 'Frog' ? 'text-emerald-800' : 'text-gray-700'}`}>
                        {t.description}
                      </span>
                    </div>
                    {/* Bottom row: category + duration badges */}
                    <div className="flex items-center gap-1.5 pl-5">
                      {t.category && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded-md text-[9px] font-bold text-indigo-600 uppercase tracking-wide">
                          {getCategoryEmoji(t.category)} {t.category}
                        </span>
                      )}
                      {t.duration && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded-md text-[9px] font-bold text-slate-500 uppercase tracking-wide">
                          <Clock size={9} /> {t.duration}
                        </span>
                      )}
                      {t.priority === 'Frog' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-md text-[9px] font-bold text-emerald-600 uppercase tracking-wide">
                          🐸 Frog Task
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}


            {/* Lock note */}
            <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 w-full justify-center">
              <Lock size={12} className="text-gray-400 shrink-0" />
              <span>Planning locked until tomorrow's date resets.</span>
            </div>
          </div>
        </div>

        {/* Modal Alert Popup */}
        <ModalAlert
          {...alertConfig}
          onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-5 lg:space-y-6 text-left flex flex-col min-h-0 h-full overflow-y-auto bg-gray-50/50 pb-20">
      
      {/* 1. Header with Title & Planning Date Badge */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-green-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-green-700 tracking-tight flex items-center gap-2">
            <span>🐸</span> Next Day Planner
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Plan your tasks for tomorrow. Add everything you need and hit Submit to lock it in.
          </p>
        </div>
        
        {/* Fixed tomorrow date badge */}
        <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 shrink-0">
          <Calendar size={16} className="text-emerald-600 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="text-[9px] uppercase tracking-wider text-emerald-500 font-bold">Planning For</span>
            <span className="text-xs font-bold text-emerald-700">{planningDate} (Tomorrow)</span>
          </div>
        </div>
      </div>



      {/* 3. Main Workspace: Unified Next Day Planner Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-left">
          <div className="space-y-0.5">
            <h2 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
              <Calendar size={16} className="text-green-655" />
              <span>Next Day Planner — {planningDate}</span>
            </h2>
            <p className="text-[11px] text-gray-400 leading-normal">
              Recurring templates auto-populate below. Add custom tasks and hit Submit to save them for {planningDate}.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button 
              type="button"
              onClick={handleSaveAllUpcomingTasks}
              disabled={unsavedTasks.length === 0 || submitting}
              className={`px-3.5 py-1.5 text-xs font-extrabold shadow-sm transition-all duration-150 active:scale-95 h-[32px] rounded-lg flex items-center gap-1.5 ${
                unsavedTasks.length > 0 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 ring-offset-1 animate-pulse cursor-pointer' 
                  : 'bg-slate-100 text-slate-400 border border-slate-205 cursor-not-allowed shadow-none'
              }`}
            >
              {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              <span>Submit {unsavedTasks.length > 0 ? `(${unsavedTasks.length})` : ''}</span>
            </button>          </div>
        </div>

        {/* MOBILE & TABLET CARD VIEW (Visible only on mobile/tablet) */}
        <div className="lg:hidden p-3 bg-slate-50/50 flex flex-col gap-3 min-h-[200px]">
          
          {/* Add custom task card */}
          <div className="bg-gradient-to-r from-emerald-50 to-white p-4 rounded-2xl border border-emerald-100 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                ➕ Add Custom Task
              </span>
              <button
                type="button"
                onClick={() => setInlineTask(prev => ({ ...prev, priority: prev.priority === 'Frog' ? '' : 'Frog' }))}
                className={`px-2.5 py-1 rounded-lg border text-xs font-bold transition-all flex items-center gap-1 shadow-sm ${
                  inlineTask.priority === 'Frog' 
                    ? 'bg-emerald-650 border-emerald-700 text-white font-extrabold' 
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
                title="Toggle Frog Task"
              >
                🐸 Frog Task
              </button>
            </div>
            
            {/* Description */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-gray-450 uppercase tracking-wider text-left block">Task Description *</span>
              <input
                type="text"
                placeholder="What needs to be done tomorrow?"
                value={inlineTask.description}
                onChange={(e) => setInlineTask(prev => ({ ...prev, description: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[36px] bg-white font-medium shadow-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Time select */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-455 uppercase tracking-wider text-left block">Time</span>
                <select
                  value={inlineTask.duration}
                  onChange={(e) => setInlineTask(prev => ({ ...prev, duration: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[36px] bg-white font-semibold"
                >
                  {durationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              {/* Category select */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-455 uppercase tracking-wider text-left block">Category</span>
                {inlineTask.isCreatingCategory ? (
                  <div className="flex gap-1 items-center">
                    <input
                      type="text"
                      placeholder="Category..."
                      value={inlineTask.newCategoryText || ''}
                      onChange={(e) => setInlineTask(prev => ({ ...prev, newCategoryText: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] h-[36px] bg-white font-medium"
                      autoFocus
                    />
                    <button 
                      type="button" 
                      onClick={handleConfirmInlineCategory} 
                      className="h-[36px] w-[30px] flex items-center justify-center bg-indigo-600 text-white rounded-lg font-bold shrink-0 text-xs shadow-sm"
                    >
                      ✓
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setInlineTask(prev => ({ ...prev, isCreatingCategory: false }))} 
                      className="h-[36px] w-[30px] flex items-center justify-center bg-gray-200 text-gray-500 rounded-lg shrink-0 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <select
                    value={inlineTask.category}
                    onChange={(e) => handleInlineCategoryChange(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[36px] bg-white font-semibold"
                  >
                    {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__NEW__">+ Custom...</option>
                  </select>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddInlineTask}
              disabled={submitting}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center py-2 text-xs font-bold shadow-sm transition active:scale-95 duration-100 h-[38px] gap-1.5 border border-emerald-700"
            >
              {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Add to Tomorrow's Draft</span>
            </button>
          </div>

          {/* Empty state placeholder */}
          {recurringTasks.length === 0 && unsavedTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 bg-white border border-gray-150 rounded-2xl p-4 text-center">
              <span className="text-3xl select-none mb-1">💤</span>
              <p className="text-xs font-bold text-gray-700">No planned tasks for tomorrow yet</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Use the card above to add custom tasks!</p>
            </div>
          )}

          {/* Task cards grid for Mobile/Tablet */}
          {(recurringTasks.length > 0 || unsavedTasks.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* List custom draft tasks */}
              {unsavedTasks.map((task) => (
                <div key={`mob-cust-${task.id}`} className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-3 transition-all relative hover:shadow-md flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border uppercase tracking-wider ${getCategoryColorClass(task.category)}`}>
                          {getCategoryEmoji(task.category)} {task.category}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-255 text-amber-600 rounded-lg text-[9px] font-bold select-none uppercase tracking-wide animate-pulse">
                          ✍️ Unsaved Draft
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox"
                          checked={task.status === 'Completed'}
                          onChange={() => handleToggleSavedTaskStatus(task)}
                          className="w-[20px] h-[20px] text-emerald-605 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                          title="Toggle status"
                        />
                        <button 
                          onClick={() => handleDeleteSavedTask(task.id)}
                          className="text-red-405 hover:text-red-650 hover:bg-rose-50 p-1.5 rounded transition" 
                          title="Delete draft task"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    <h3 className={`text-sm font-bold leading-snug text-left flex items-start gap-1.5 pt-0.5 ${task.status === 'Completed' ? 'text-gray-400 line-through opacity-70' : 'text-gray-805'}`}>
                      {task.priority === 'Frog' && (
                        <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>
                      )}
                      <span>{task.description}</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 pt-2 border-t border-gray-100 mt-2">
                    <span className="text-sm select-none">{getDurationEmoji(task.duration)}</span>
                    <span>{task.duration}</span>
                  </div>
                </div>
              ))}

              {/* List recurring templates */}
              {recurringTasks.map((task) => (
                <div key={`mob-rec-${task.id}`} className="bg-white p-4 rounded-2xl border border-gray-150 shadow-sm space-y-3 transition-all relative hover:shadow-md flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-lg border uppercase tracking-wider ${getCategoryColorClass(task.category)}`}>
                          {getCategoryEmoji(task.category)} {task.category}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-150 rounded-lg text-[9px] font-bold text-slate-500 select-none uppercase tracking-wide">
                          🔄 Recurring
                        </span>
                      </div>
                      <div className="text-gray-400">
                        <Lock size={14} title="Locked template" />
                      </div>
                    </div>

                    <h3 className="text-sm font-bold text-gray-855 leading-snug text-left flex items-start gap-1.5 pt-0.5">
                      {task.priority === 'Frog' && (
                        <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>
                      )}
                      <span>{task.description}</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 pt-2 border-t border-gray-100 mt-2">
                    <span className="text-sm select-none">{getDurationEmoji(task.duration)}</span>
                    <span>{task.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DESKTOP TABLE VIEW (Visible on Desktop/Large Viewports) */}
        <div className="hidden lg:block p-4 sm:p-5 overflow-x-auto min-h-[250px]">
          <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[700px] max-w-5xl">
            <thead>
              <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px] sm:text-[11px]">
                <th className="pb-3 text-center font-bold w-[12%] align-middle">Action</th>
                <th className="pb-3 text-left font-bold w-2/5 align-middle">Task Description</th>
                <th className="pb-3 text-left font-bold w-1/5 align-middle">Time</th>
                <th className="pb-3 text-left font-bold w-1/5 align-middle">Category</th>
                <th className="pb-3 text-left font-bold w-[13%] align-middle">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recurringTasks.length === 0 && unsavedTasks.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    <div className="flex flex-col items-center justify-center py-4 text-center">
                      <span className="text-2xl select-none mb-1">💤</span>
                      <p className="text-xs font-semibold">No tasks found for this date.</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Use the inline task row below to add custom tasks.</p>
                    </div>
                  </td>
                </tr>
              )}

              {/* 1. Recurring Tasks */}
              {recurringTasks.map((task) => (
                <tr key={`rec-${task.id}`} className="hover:bg-gray-50/50 transition-colors">
                  <td className="py-3.5 text-center align-middle text-gray-400">
                    <Lock size={13} className="mx-auto" title="Locked template" />
                  </td>
                  <td className="py-3.5 text-left font-bold text-slate-800 align-middle">
                    <div className="flex items-center gap-1.5">
                      {task.priority === 'Frog' && <span className="select-none text-sm shrink-0" title="Frog Task">🐸</span>}
                      <span className="truncate">{task.description}</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-left font-bold text-slate-700 align-middle">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-gray-400 shrink-0" />
                      <span>{task.duration}</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-left whitespace-nowrap align-middle">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-green-50/70 border border-green-150 rounded-md text-[10px] font-extrabold uppercase text-green-700 tracking-wider select-none w-max">
                      <span>{getCategoryEmoji(task.category)}</span>
                      <span>{task.category}</span>
                    </span>
                  </td>
                  <td className="py-3.5 text-left align-middle">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[9px] font-bold text-slate-500 select-none uppercase tracking-wide">
                      🔄 Recurring
                    </span>
                  </td>
                </tr>
              ))}

              {/* 2. Unsaved Custom Tasks */}
              {unsavedTasks.map((task) => (
                <tr key={`cust-${task.id}`} className="hover:bg-gray-50/50 transition-colors bg-amber-50/10">
                  <td className="py-3.5 text-center align-middle">
                    <div className="flex items-center justify-center gap-2">
                      <input 
                        type="checkbox"
                        checked={task.status === 'Completed'}
                        onChange={() => handleToggleSavedTaskStatus(task)}
                        className="w-4 h-4 text-emerald-605 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                        title="Toggle status"
                      />
                      <button 
                        onClick={() => handleDeleteSavedTask(task.id)}
                        className="text-red-400 hover:text-red-650 hover:bg-rose-50 p-1 rounded transition" 
                        title="Delete temporary task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                  <td className={`py-3.5 text-left font-bold align-middle ${task.status === 'Completed' ? 'text-gray-400 line-through opacity-70' : 'text-slate-850'}`}>
                    <div className="flex items-center gap-1.5">
                      {task.priority === 'Frog' && <span className="select-none text-sm shrink-0" title="Frog Task">🐸</span>}
                      <span className="truncate">{task.description}</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-left font-bold text-slate-700 align-middle">
                    <div className="flex items-center gap-1.5">
                      <Clock size={13} className="text-gray-400 shrink-0" />
                      <span>{task.duration}</span>
                    </div>
                  </td>
                  <td className="py-3.5 text-left whitespace-nowrap align-middle">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-indigo-50/70 border border-indigo-150 rounded-md text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider select-none w-max">
                      <span>{getCategoryEmoji(task.category)}</span>
                      <span>{task.category}</span>
                    </span>
                  </td>
                  <td className="py-3.5 text-left align-middle">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 border border-amber-250 text-amber-600 rounded text-[9px] font-bold select-none uppercase tracking-wide animate-pulse">
                      ✍️ Unsaved Draft
                    </span>
                  </td>
                </tr>
              ))}

              {/* 3. Inline Input Form Row */}
              <tr className="bg-slate-50/60 border-t-2 border-slate-200">
                {/* Column 1: Action (Add task on left) */}
                <td className="py-3 text-center align-middle">
                  <button
                    type="button"
                    onClick={handleAddInlineTask}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center px-3.5 py-1.5 text-xs font-bold shadow-sm transition active:scale-95 duration-100 h-[34px] gap-1 shrink-0 mx-auto border border-emerald-700"
                    title="Add custom task"
                  >
                    {submitting ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                    <span>Add</span>
                  </button>
                </td>

                {/* Column 2: Task Description (Frog button + Description Input) */}
                <td className="py-3 text-left align-middle pr-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setInlineTask(prev => ({ ...prev, priority: prev.priority === 'Frog' ? '' : 'Frog' }))}
                      className={`p-1.5 rounded-lg border text-xs transition-all flex items-center justify-center shadow-sm shrink-0 h-[34px] w-[34px] ${
                        inlineTask.priority === 'Frog' 
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-extrabold scale-105' 
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                      }`}
                      title="Toggle Frog Task"
                    >
                      🐸
                    </button>
                    <input
                      type="text"
                      placeholder="Add custom task description..."
                      value={inlineTask.description}
                      onChange={(e) => setInlineTask(prev => ({ ...prev, description: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddInlineTask();
                        }
                      }}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[34px] bg-white font-medium shadow-sm transition"
                    />
                  </div>
                </td>

                {/* Column 3: Time Select */}
                <td className="py-3 text-left align-middle pr-2">
                  <select
                    value={inlineTask.duration}
                    onChange={(e) => setInlineTask(prev => ({ ...prev, duration: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[34px] bg-white font-semibold shadow-sm"
                  >
                    {durationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>

                {/* Column 4: Category Select */}
                <td className="py-3 text-left align-middle pr-2">
                  {inlineTask.isCreatingCategory ? (
                    <div className="flex gap-1 items-center">
                      <input
                        type="text"
                        placeholder="New category..."
                        value={inlineTask.newCategoryText || ''}
                        onChange={(e) => setInlineTask(prev => ({ ...prev, newCategoryText: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[34px] bg-white font-medium"
                        autoFocus
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') { 
                            e.preventDefault(); 
                            handleConfirmInlineCategory(); 
                          } 
                        }}
                      />
                      <button 
                        type="button" 
                        onClick={handleConfirmInlineCategory} 
                        className="h-[34px] w-[30px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-sm"
                      >
                        ✓
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setInlineTask(prev => ({ ...prev, isCreatingCategory: false }))} 
                        className="h-[34px] w-[30px] flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-500 rounded-lg text-xs shrink-0"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <select
                      value={inlineTask.category}
                      onChange={(e) => handleInlineCategoryChange(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs h-[34px] bg-white font-semibold shadow-sm"
                    >
                      {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      <option value="__NEW__">+ Custom...</option>
                    </select>
                  )}
                </td>

                {/* Column 5: Source */}
                <td className="py-3 text-left align-middle text-gray-400 text-[10px] font-bold uppercase tracking-wider select-none">
                  [Inline Draft]
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Alert Popup */}
      <ModalAlert
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

    </div>
  );
}
