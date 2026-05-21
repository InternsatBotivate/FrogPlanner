import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, Plus, Trash2, ClipboardPaste, Lock, Calendar, Sparkles, 
  Send, RefreshCw, AlertCircle, CalendarRange, Info, ListTodo, 
  CheckCircle2, PlusCircle, Check, HelpCircle, Flame, ArrowRight,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { fetchPlannerData } from '../../lib/plannerService';
import {
  fetchUpcomingTasks,
  createUpcomingTasks,
  deleteUpcomingTask,
  updateUpcomingTaskField,
  migrateUpcomingTasksLegacyData
} from '../../lib/upcomingPlannerService';
import { getCategoryEmoji } from '../../utils/helpers';
import ModalAlert from '../../components/ModalAlert';

export default function UpcomingPlanner() {
  const { user } = useAuthStore();
  
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
  const [planningDate, setPlanningDate] = useState(getTomorrowStr());

  // Core Data States
  const [recurringTasks, setRecurringTasks] = useState([]); // Loaded from main 'tasks' template (date is null)
  const [newTasks, setNewTasks] = useState([
    { description: '', duration: 'Morning', category: 'Work', priority: '', isCreatingCategory: false, newCategoryText: '' }
  ]);
  const [alreadyPlannedTasks, setAlreadyPlannedTasks] = useState([]); // Loaded from 'upcoming_tasks' for target date
  
  // Custom Categories
  const [customCategories, setCustomCategories] = useState(() => {
    const saved = localStorage.getItem('index_custom_categories');
    return saved ? JSON.parse(saved) : ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
  });
  
  // Bulk Paste State
  const [showBulkPaste, setShowBulkPaste] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  
  // Filter for Already Planned list
  const [plannedSearch, setPlannedSearch] = useState('');

  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];

  // 1. Initial Load & Legacy Migration
  useEffect(() => {
    const initPlanner = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        // Run migration first
        await migrateUpcomingTasksLegacyData(user.id);
        
        // Fetch recurring templates from standard tasks table (where date is null)
        const { tasks: dbTasks } = await fetchPlannerData(user.id);
        const recurringTemplates = dbTasks.filter(t => !t.date);
        setRecurringTasks(recurringTemplates);
        
        // Fetch manual tasks already saved for the selected date
        await loadSavedTasksForDate(planningDate);
      } catch (error) {
        console.error('[UpcomingPlanner] Init failed:', error);
        toast.error('Failed to load planned tasks data.');
      } finally {
        setLoading(false);
      }
    };
    initPlanner();
  }, [user?.id]);

  // Load saved manual tasks for target date
  const loadSavedTasksForDate = async (targetDate) => {
    if (!user?.id) return;
    try {
      const allUpcoming = await fetchUpcomingTasks(user.id);
      // Filter tasks matching target date
      const filtered = allUpcoming.filter(t => t.date === targetDate);
      setAlreadyPlannedTasks(filtered);
    } catch (err) {
      console.error('[UpcomingPlanner] Failed to load saved tasks:', err);
    }
  };

  // Reload already planned tasks whenever planning date changes
  useEffect(() => {
    if (user?.id && !loading) {
      loadSavedTasksForDate(planningDate);
    }
  }, [planningDate]);

  // Alert Modal helper
  const showAlert = (type, title, message, onConfirm = () => {}) => {
    setAlertConfig({ isOpen: true, type, title, message, onConfirm });
  };

  // Live Count Calculations
  const counts = useMemo(() => {
    const recurringCount = recurringTasks.length;
    const newTasksAddedCount = newTasks.filter(t => t.description.trim().length > 0).length;
    const totalPlannedCount = recurringCount + newTasksAddedCount;
    return {
      recurring: recurringCount,
      newAdded: newTasksAddedCount,
      totalPlanned: totalPlannedCount
    };
  }, [recurringTasks, newTasks]);

  // --- Manual Tasks Editor Handlers ---
  const handleAddTaskRow = () => {
    setNewTasks([
      ...newTasks,
      { description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '', isCreatingCategory: false, newCategoryText: '' }
    ]);
  };

  const handleFieldChange = (index, field, value) => {
    const updated = [...newTasks];
    updated[index][field] = value;
    setNewTasks(updated);
  };

  const handleRemoveTaskRow = (index) => {
    if (newTasks.length > 1) {
      setNewTasks(newTasks.filter((_, i) => i !== index));
    } else {
      setNewTasks([
        { description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '', isCreatingCategory: false, newCategoryText: '' }
      ]);
    }
  };

  // Category select change (detect Custom)
  const handleCategorySelectChange = (index, value) => {
    if (value === '__NEW__') {
      handleFieldChange(index, 'isCreatingCategory', true);
    } else {
      handleFieldChange(index, 'category', value);
    }
  };

  // Confirm custom category inline
  const handleAddCategoryInline = (index) => {
    const text = (newTasks[index].newCategoryText || '').trim();
    if (!text) {
      handleFieldChange(index, 'isCreatingCategory', false);
      return;
    }
    
    // Add to dropdown list if it's not already there
    const updatedCategories = customCategories.includes(text) 
      ? customCategories 
      : [...customCategories, text];
      
    if (!customCategories.includes(text)) {
      setCustomCategories(updatedCategories);
      localStorage.setItem('index_custom_categories', JSON.stringify(updatedCategories));
    }
    
    handleFieldChange(index, 'category', text);
    handleFieldChange(index, 'isCreatingCategory', false);
    handleFieldChange(index, 'newCategoryText', '');
    toast.success(`Category "${text}" added!`);
  };

  // Bulk Import Handler
  const handleBulkImport = () => {
    const lines = bulkPasteText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      toast.error('Please enter at least one task line.');
      return;
    }

    const imported = lines.map(line => {
      let isFrog = false;
      let cleanDesc = line;
      if (line.includes('🐸')) {
        isFrog = true;
        cleanDesc = line.replace(/🐸/g, '').trim();
      }
      return {
        description: cleanDesc,
        duration: 'Morning',
        category: customCategories[0] || 'Work',
        priority: isFrog ? 'Frog' : '',
        isCreatingCategory: false,
        newCategoryText: ''
      };
    });

    if (newTasks.length === 1 && !newTasks[0].description.trim()) {
      setNewTasks(imported);
    } else {
      setNewTasks([...newTasks, ...imported]);
    }

    setBulkPasteText('');
    setShowBulkPaste(false);
    toast.success(`Successfully imported ${imported.length} task(s)!`);
  };

  // --- Saved Tasks Real-Time Handlers ---
  const handleToggleSavedTaskStatus = async (item) => {
    const newStatus = item.status === 'Completed' ? 'Pending' : 'Completed';
    // Optimistic UI update
    setAlreadyPlannedTasks(prev =>
      prev.map(t => t.id === item.id ? { ...t, status: newStatus, selectValue: newStatus === 'Completed' ? 'Done' : 'Pending' } : t)
    );
    const success = await updateUpcomingTaskField(item.id, 'status', newStatus);
    if (!success) {
      toast.error('Failed to update status.');
      loadSavedTasksForDate(planningDate);
    } else {
      toast.success(newStatus === 'Completed' ? 'Task completed!' : 'Task set to pending.');
    }
  };

  const handleDeleteSavedTask = async (taskId) => {
    showAlert('confirm', 'Remove Task?', 'Are you sure you want to delete this task from the database?', async () => {
      setLoading(true);
      const success = await deleteUpcomingTask(taskId);
      if (success) {
        setAlreadyPlannedTasks(prev => prev.filter(t => t.id !== taskId));
        toast.success('Task removed from planner.');
      } else {
        toast.error('Failed to delete task.');
      }
      setLoading(false);
    });
  };

  // --- Batch Submit ---
  const handleSubmitPlanning = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    // Filter valid custom tasks
    const validRows = newTasks.filter(r => r.description.trim().length > 0);
    if (validRows.length === 0) {
      toast.error('Please configure at least one manual task with a description.');
      return;
    }

    setSubmitting(true);
    try {
      // Build upcoming payload - ONLY newly added manual tasks are sent. Recurring tasks are completely excluded.
      const payload = validRows.map(row => ({
        description: row.description.trim(),
        duration: row.duration,
        category: row.category,
        priority: row.priority || '',
        date: planningDate,
        status: 'Pending',
        remarks: ''
      }));

      const created = await createUpcomingTasks(user.id, payload);
      if (created && created.length > 0) {
        toast.success(`Successfully planned ${created.length} custom task(s) for next day!`);
        
        // Reset manual planner input state
        setNewTasks([
          { description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '', isCreatingCategory: false, newCategoryText: '' }
        ]);
        
        // Refresh saved list
        await loadSavedTasksForDate(planningDate);
      } else {
        toast.error('Failed to save manual planner tasks.');
      }
    } catch (err) {
      console.error('[UpcomingPlanner] Submit failed:', err);
      toast.error('Error occurred while submitting.');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter already planned tasks locally by search input
  const filteredPlannedTasks = useMemo(() => {
    if (!plannedSearch.trim()) return alreadyPlannedTasks;
    const q = plannedSearch.toLowerCase();
    return alreadyPlannedTasks.filter(t => 
      t.description.toLowerCase().includes(q) || 
      t.category.toLowerCase().includes(q) ||
      t.duration.toLowerCase().includes(q)
    );
  }, [alreadyPlannedTasks, plannedSearch]);

  if (loading) {
    return (
      <div className="p-4 space-y-4 text-left flex flex-col min-h-screen justify-center items-center bg-gray-55/30">
        <div className="flex flex-col items-center justify-center p-8 bg-white rounded-2xl border border-gray-150 shadow-sm max-w-sm w-full">
          <span className="text-4xl animate-bounce select-none block mb-3">🐸</span>
          <p className="text-sm font-semibold text-gray-500 animate-pulse flex items-center gap-1.5">
            <RefreshCw size={14} className="animate-spin text-indigo-500" />
            Loading Next Day Planner...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-5 lg:p-6 space-y-5 lg:space-y-6 text-left flex flex-col min-h-0 h-full overflow-y-auto bg-gray-50/50 pb-20">
      
      {/* 1. Header with Title & Date Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-green-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold text-green-700 tracking-tight flex items-center gap-2">
            <span>🐸</span> Next Day Planner
          </h1>
          <p className="text-xs sm:text-sm text-gray-500">
            Align your schedule in advance. Auto-generates recurring templates and lets you layer custom daily tasks.
          </p>
        </div>
        
        {/* Date Selector */}
        <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 shrink-0">
          <CalendarRange size={16} className="text-indigo-505 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="text-[9px] uppercase tracking-wider text-gray-400 font-bold">Planning Target Date</span>
            <input 
              type="date"
              value={planningDate}
              onChange={(e) => setPlanningDate(e.target.value)}
              className="text-xs font-bold text-gray-700 bg-transparent focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 2. KPI Counters Bar */}
      <div className="grid grid-cols-3 gap-3">
        {/* Recurring templates */}
        <div className="bg-white p-3 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mb-1 text-slate-500">
            <Lock size={14} />
          </div>
          <span className="text-lg sm:text-2xl font-extrabold text-slate-700 leading-tight">{counts.recurring}</span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1 mt-0.5 justify-center">
            <span>🔄 Recurring</span>
          </span>
        </div>

        {/* New Manual added */}
        <div className="bg-white p-3 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center items-center text-center">
          <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-1 text-indigo-500">
            <PlusCircle size={14} />
          </div>
          <span className="text-lg sm:text-2xl font-extrabold text-indigo-700 leading-tight">{counts.newAdded}</span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-indigo-400 tracking-wider flex items-center gap-1 mt-0.5 justify-center">
            <span>✍️ Added New</span>
          </span>
        </div>

        {/* Total Planned */}
        <div className="bg-white p-3 rounded-2xl border border-gray-150 shadow-sm flex flex-col justify-center items-center text-center ring-2 ring-green-100/50">
          <div className="w-8 h-8 rounded-full bg-green-50 border border-green-150 flex items-center justify-center mb-1 text-green-600">
            <Sparkles size={14} />
          </div>
          <span className="text-lg sm:text-2xl font-extrabold text-green-700 leading-tight">{counts.totalPlanned}</span>
          <span className="text-[9px] sm:text-[10px] uppercase font-bold text-green-650 tracking-wider flex items-center gap-1 mt-0.5 justify-center">
            <span>🐸 Total Planned</span>
          </span>
        </div>
      </div>

      {/* 3. Main Workspace: Stacked Layout (Top & Bottom View) */}
      <div className="grid grid-cols-1 gap-6 items-start">
        
        {/* LEFT COLUMN: Auto Recurring Tasks (Informational Template) */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col h-full">
          <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col text-left">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-bold text-slate-700 flex items-center gap-2">
                <Lock size={15} className="text-slate-400" />
                <span>Recurring Templates</span>
              </h2>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span>🔄 Informational</span>
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
              These template tasks are loaded dynamically and will be automatically generated for you on the scheduled day by the system.
            </p>
          </div>

          <div className="p-4 sm:p-5 overflow-x-auto min-h-[200px]">
            {recurringTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400">
                <span className="text-2xl select-none mb-2">💤</span>
                <p className="text-xs font-semibold">No recurring tasks configured.</p>
                <p className="text-[10px] text-gray-400 max-w-[200px] mt-0.5">Use the "Recurring Tasks" section in the sidebar to define master templates.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs sm:text-sm border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-400 font-bold uppercase tracking-wider text-[10px] sm:text-[11px]">
                    <th className="pb-3 text-left font-bold w-3/5">Task Description</th>
                    <th className="pb-3 text-center font-bold w-1/5">Time</th>
                    <th className="pb-3 text-right font-bold w-1/5">Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recurringTasks.map((task) => (
                    <tr key={task.id} className="hover:bg-gray-50/50 transition-colors">
                      {/* Task Description */}
                      <td className="py-3.5 text-left font-bold text-slate-800">
                        <div className="flex items-center gap-1.5">
                          {task.priority === 'Frog' && <span className="select-none text-sm shrink-0" title="Frog Task">🐸</span>}
                          <span className="truncate">{task.description}</span>
                        </div>
                      </td>
                      {/* Time */}
                      <td className="py-3.5 text-center font-bold text-slate-700">
                        {task.duration}
                      </td>
                      {/* Category */}
                      <td className="py-3.5 text-right whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-green-50/70 border border-green-150 rounded-md text-[10px] font-extrabold uppercase text-green-700 tracking-wider select-none w-max">
                          <span>{getCategoryEmoji(task.category)}</span>
                          <span>{task.category}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Custom Tasks Editor Workspace */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 sm:p-5 border-b border-gray-100 bg-indigo-50/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-left">
            <div className="space-y-0.5">
              <h2 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
                <PlusCircle size={16} className="text-indigo-500" />
                <span>Custom Tasks for Next Day</span>
              </h2>
              <p className="text-[11px] text-gray-400 leading-normal">
                Layer on additional custom manual tasks for this date.
              </p>
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={() => setShowBulkPaste(!showBulkPaste)}
                className="px-2.5 py-1 text-[10px] font-bold text-indigo-650 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition flex items-center gap-1 active:scale-95"
              >
                <ClipboardPaste size={12} /> Bulk Paste
              </button>

              <button 
                type="button" 
                onClick={handleAddTaskRow} 
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition active:scale-95 flex items-center gap-1 shadow-sm"
              >
                <Plus size={12} /> Add Row
              </button>
            </div>
          </div>

          {/* Quick Bulk Paste Drawer */}
          {showBulkPaste && (
            <div className="p-4 bg-indigo-50/30 border-b border-gray-150 space-y-2 text-left animate-in slide-in-from-top duration-200">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                <ClipboardPaste size={14} />
                <span>Bulk Import Tasks</span>
              </div>
              <p className="text-[10px] text-indigo-650 leading-relaxed">
                Enter tasks (one per line). Mark highly critical ones with a 🐸 emoji to toggle their Frog status.
              </p>
              <textarea
                value={bulkPasteText}
                onChange={(e) => setBulkPasteText(e.target.value)}
                placeholder="Example:&#10;🐸 Schedule team alignment call&#10;Submit Q3 pricing proposal&#10;🐸 Complete draft slide decks"
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[80px] bg-white font-medium placeholder-gray-400 shadow-sm"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowBulkPaste(false)}
                  className="px-3 py-1 text-[10px] text-gray-500 hover:bg-gray-100 rounded-md font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBulkImport}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-md transition shadow-sm"
                >
                  Import Rows
                </button>
              </div>
            </div>
          )}

          {/* Manual Task Row Workspace */}
          <form onSubmit={handleSubmitPlanning} className="flex flex-col">
            <div className="p-4 sm:p-5 space-y-4 max-h-[480px] overflow-y-auto min-h-[200px]">
              {newTasks.map((row, idx) => (
                <div 
                  key={idx} 
                  className="bg-gray-50/70 p-3.5 rounded-2xl border border-gray-200/80 relative space-y-3 text-left transition hover:shadow-sm"
                >
                  {/* Row Header */}
                  <div className="flex justify-between items-center border-b border-gray-200/60 pb-1.5">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
                      Task Item #{idx + 1}
                    </span>
                    {newTasks.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveTaskRow(idx)} 
                        className="text-red-400 hover:text-red-650 hover:bg-rose-50 p-1 rounded-md transition" 
                        title="Remove row"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Task Description */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide">Task Description *</label>
                    <input
                      type="text"
                      required={idx === 0 || row.description.trim().length > 0}
                      placeholder="What needs to be done next day?"
                      value={row.description}
                      onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs sm:text-sm h-[34px] bg-white font-medium shadow-sm transition"
                    />
                  </div>

                  {/* Row Config Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Time Select */}
                    <div className="space-y-1 text-left">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide">Time *</label>
                      <select
                        required
                        value={row.duration}
                        onChange={(e) => handleFieldChange(idx, 'duration', e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] sm:text-xs h-[34px] bg-white font-medium"
                      >
                        {durationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

                    {/* Category Select */}
                    <div className="space-y-1 text-left">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide">Category *</label>
                      {row.isCreatingCategory ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            placeholder="New..."
                            value={row.newCategoryText || ''}
                            onChange={(e) => handleFieldChange(idx, 'newCategoryText', e.target.value)}
                            className="w-full border border-gray-300 rounded-xl px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] h-[34px] bg-white font-medium"
                            autoFocus
                            onKeyDown={(e) => { 
                              if (e.key === 'Enter') { 
                                e.preventDefault(); 
                                handleAddCategoryInline(idx); 
                              } 
                            }}
                          />
                          <button 
                            type="button" 
                            onClick={() => handleAddCategoryInline(idx)} 
                            className="h-[34px] w-[30px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shrink-0"
                          >
                            ✓
                          </button>
                          <button 
                            type="button" 
                            onClick={() => handleFieldChange(idx, 'isCreatingCategory', false)} 
                            className="h-[34px] w-[30px] flex items-center justify-center bg-gray-250 hover:bg-gray-300 text-gray-500 rounded-xl text-xs shrink-0"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <select
                          required
                          value={row.category}
                          onChange={(e) => handleCategorySelectChange(idx, e.target.value)}
                          className="w-full border border-gray-300 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] sm:text-xs h-[34px] bg-white font-medium"
                        >
                          {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__NEW__">+ Custom...</option>
                        </select>
                      )}
                    </div>

                    {/* Frog Task Toggle */}
                    <div className="space-y-1 text-left">
                      <label className="block text-[9px] font-bold text-gray-400 uppercase tracking-wide">Frog Task?</label>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(idx, 'priority', row.priority === 'Frog' ? '' : 'Frog')}
                        className={`w-full border rounded-xl text-[11px] sm:text-xs h-[34px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                          row.priority === 'Frog' 
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700 font-extrabold' 
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {row.priority === 'Frog' ? '🐸 Frog!' : '🐸 Mark Frog'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Form Submit Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50/50 flex justify-end">
              <button
                type="submit"
                disabled={submitting || counts.newAdded === 0}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-sm transition-all active:scale-95 ${
                  counts.newAdded > 0 && !submitting
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-300 ring-offset-1 animate-pulse'
                    : 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" /> Saving Planner...
                  </>
                ) : (
                  <>
                    <Send size={14} /> Submit & Plan Tomorrow ({counts.newAdded})
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* 4. Already Scheduled Bottom Area */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col text-left">
        <div className="p-4 sm:p-5 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
              <Calendar size={16} className="text-green-600" />
              <span>Already Saved in Tomorrow's Planner</span>
            </h2>
            <p className="text-[11px] text-gray-400">
              Manual tasks previously planned and currently stored in the database for the selected date ({planningDate}).
            </p>
          </div>
          
          {/* Search bar inside Section */}
          {alreadyPlannedTasks.length > 0 && (
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="absolute left-2.5 top-[9px] w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={plannedSearch}
                onChange={(e) => setPlannedSearch(e.target.value)}
                placeholder="Search tomorrow's tasks..."
                className="w-full pl-8 pr-2.5 py-1.5 border border-gray-350 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[30px] bg-white font-medium"
              />
            </div>
          )}
        </div>

        <div className="p-4 sm:p-5">
          {alreadyPlannedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400">
              <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center mb-2">
                <ListTodo size={18} />
              </div>
              <p className="text-xs font-semibold">No manual tasks planned yet for this date.</p>
              <p className="text-[10px] text-gray-400 max-w-xs mt-0.5">Use the Custom Tasks box above to list extra meetings or items specifically scheduled for {planningDate}.</p>
            </div>
          ) : filteredPlannedTasks.length === 0 ? (
            <div className="py-6 text-center text-gray-400 text-xs font-medium">
              No planned tasks match your query.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {filteredPlannedTasks.map((item) => (
                <div 
                  key={item.id} 
                  className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm space-y-3 hover:border-indigo-150 transition"
                >
                  <div className="flex justify-between items-start border-b border-gray-100 pb-2 flex-wrap gap-2">
                    <div className="flex gap-1.5 flex-wrap">
                      <span className="text-[9px] font-extrabold text-indigo-650 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wide">
                        {getCategoryEmoji(item.category)} {item.category}
                      </span>
                      <span 
                        onClick={() => handleToggleSavedTaskStatus(item)}
                        className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase cursor-pointer hover:opacity-85 select-none transition ${
                          item.status === 'Completed'
                            ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                            : 'bg-amber-50 border-amber-100 text-amber-600'
                        }`}
                        title="Toggle Status"
                      >
                        {item.status}
                      </span>
                    </div>

                    <button 
                      onClick={() => handleDeleteSavedTask(item.id)} 
                      className="text-red-400 hover:text-red-600 hover:bg-rose-50 p-1 rounded transition" 
                      title="Delete saved task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  <p className={`text-xs sm:text-sm font-bold leading-tight ${item.status === 'Completed' ? 'text-gray-400 line-through opacity-70' : 'text-gray-800'}`}>
                    {item.priority === 'Frog' && <span className="text-base select-none mr-1" title="Frog Task">🐸</span>}
                    <span>{item.description}</span>
                  </p>

                  <div className="flex items-center justify-between text-gray-400 pt-1">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-gray-500">
                      <Clock size={11} className="text-gray-400" />
                      <span>{item.duration}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
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
