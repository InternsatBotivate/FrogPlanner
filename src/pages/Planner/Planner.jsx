import React, { useState, useEffect, useMemo } from 'react';
import { Clock, ChevronLeft, ChevronRight, Plus, Trash2, Search } from 'lucide-react';
import DataTable from '../../components/DataTable';
import ModalForm from '../../components/ModalForm';
import ModalAlert from '../../components/ModalAlert';
import { getCategoryEmoji } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import { fetchPlannerData, addPlannerTasks, updateTaskField, toggleCompletion, migrateLegacyData } from '../../lib/plannerService';

const formatDateLocal = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function Planner() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(formatDateLocal(new Date()));
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [weekOffset, setWeekOffset] = useState(0);
  
  const [masterTasks, setMasterTasks] = useState([]);
  const [completions, setCompletions] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [showFrogModal, setShowFrogModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Total');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrog, setFilterFrog] = useState('');
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: () => {} });

  // Custom categories list loaded from localStorage if it exists
  const [customCategories, setCustomCategories] = useState(() => {
    const saved = localStorage.getItem('index_custom_categories');
    return saved ? JSON.parse(saved) : ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
  });

  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const priorityOptions = ['Low', 'Medium', 'High'];

  // Form states
  const [formData, setFormData] = useState({
    date: selectedDate
  });

  // Dynamic row array of descriptions, duration, category, and priority selections
  const [tasksList, setTasksList] = useState([
    { description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }
  ]);

  // Keep date sync when active date selector changes
  useEffect(() => {
    setFormData({ date: selectedDate });
  }, [selectedDate]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDuration, filterCategory, filterFrog, activeFilter, selectedDate]);

  // Load tasks and completions from Supabase with legacy migration on mount
  useEffect(() => {
    const initData = async () => {
      if (user?.id) {
        setLoading(true);
        // Step 1: Migrate legacy data first
        await migrateLegacyData(user.id);
        // Step 2: Fetch database data
        const { tasks: dbTasks, completions: dbCompletions } = await fetchPlannerData(user.id);
        setMasterTasks(dbTasks);
        setCompletions(dbCompletions);
        setLoading(false);
      }
    };
    initData();
  }, [user]);

  const [committedDoneTaskIds, setCommittedDoneTaskIds] = useState([]);

  // Hide already Done tasks on load or date change
  useEffect(() => {
    const doneIds = masterTasks
      .filter(t => t.date === selectedDate && t.selectValue === 'Done')
      .map(t => t.id);
    setCommittedDoneTaskIds(doneIds);
  }, [selectedDate, masterTasks]);

  // Generate current week dates
  const weekDates = useMemo(() => {
    const dates = [];
    const curr = new Date();
    curr.setDate(curr.getDate() + (weekOffset * 7));
    
    // Start from Monday
    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); 
    
    for (let i = 0; i < 7; i++) {
      const day = new Date(curr.getFullYear(), curr.getMonth(), first + i);
      dates.push(day);
    }
    return dates;
  }, [weekOffset]);

  const headers = ['Action', 'Status', 'Remarks', 'Time', 'Task Description', 'Category'];

  // Map master tasks to include date-specific completion status & priority
  const filteredTasks = useMemo(() => {
    const dateCompletions = completions[selectedDate] || [];
    const mapped = masterTasks
      .filter(task => task.date === selectedDate) // Show ONLY tasks scheduled for this specific date
      .map(task => {
        const isDone = dateCompletions.includes(task.id);
        let calculatedStatus = 'Pending';
        if (isDone) {
          calculatedStatus = 'Completed';
        } else if (task.category === 'Review' || task.category === 'Call') {
          calculatedStatus = 'Delayed';
        } else if (task.duration === 'Morning' || task.duration === 'Afternoon') {
          calculatedStatus = 'Progress';
        }
        return {
          ...task,
          time: task.duration,
          status: calculatedStatus
        };
      });

    let result = mapped.filter(t => !committedDoneTaskIds.includes(t.id));

    if (activeFilter === 'Active') {
      result = result.filter(t => t.status !== 'Completed');
    } else if (activeFilter === 'Completed') {
      result = result.filter(t => t.status === 'Completed');
    } else if (activeFilter === 'Pending') {
      result = result.filter(t => t.status === 'Pending');
    } else if (activeFilter === 'Progress') {
      result = result.filter(t => t.status === 'Progress');
    } else if (activeFilter === 'Delayed') {
      result = result.filter(t => t.status === 'Delayed');
    }

    // Search query filter
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.description.toLowerCase().includes(q));
    }

    // Duration filter
    if (filterDuration) {
      result = result.filter(t => t.duration === filterDuration);
    }

    // Category filter
    if (filterCategory) {
      result = result.filter(t => t.category === filterCategory);
    }

    // Frog task filter
    if (filterFrog === 'Frog') {
      result = result.filter(t => t.priority === 'Frog');
    }

    return result;
  }, [masterTasks, completions, selectedDate, activeFilter, searchQuery, filterDuration, filterCategory, filterFrog, committedDoneTaskIds]);

  // Compute stats for current day's KPI filter cards
  const stats = useMemo(() => {
    const dateCompletions = completions[selectedDate] || [];
    const dayTasks = masterTasks.filter(task => task.date === selectedDate);
    
    let total = dayTasks.length;
    let completed = 0;
    let active = 0;
    let pending = 0;
    let progress = 0;
    let delayed = 0;

    dayTasks.forEach(task => {
      const isDone = dateCompletions.includes(task.id);
      if (isDone) {
        completed++;
      } else {
        if (committedDoneTaskIds.includes(task.id)) {
          total--;
          return;
        }
        active++;
        if (task.category === 'Review' || task.category === 'Call') {
          delayed++;
        } else if (task.duration === 'Morning' || task.duration === 'Afternoon') {
          progress++;
        } else {
          pending++;
        }
      }
    });

    return { total, active, completed, pending, progress, delayed };
  }, [masterTasks, completions, selectedDate, committedDoneTaskIds]);

  // Get all Frog Tasks for selected date
  const allTodayFrogTasks = useMemo(() => {
    const dateCompletions = completions[selectedDate] || [];
    return masterTasks
      .filter(t => t.date === selectedDate)
      .filter(t => t.priority === 'Frog')
      .map(t => ({
        ...t,
        isCompleted: dateCompletions.includes(t.id)
      }));
  }, [masterTasks, completions, selectedDate]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  };

  const getDayNumber = (date) => {
    return date.getDate();
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Toggle completion status for specific date
  const handleToggleStatus = async (taskId) => {
    if (!user?.id) return;
    const currentCompleted = completions[selectedDate] || [];
    const isAdding = !currentCompleted.includes(taskId);
    
    // Optimistic UI update
    let newCompleted;
    if (!isAdding) {
      newCompleted = currentCompleted.filter(id => id !== taskId);
    } else {
      newCompleted = [...currentCompleted, taskId];
    }
    const updatedCompletions = {
      ...completions,
      [selectedDate]: newCompleted
    };
    setCompletions(updatedCompletions);

    // Call Supabase service
    const success = await toggleCompletion(user.id, taskId, selectedDate, isAdding);
    if (success) {
      // Also update selectValue field
      const newSelectVal = isAdding ? 'Done' : 'Select';
      await updateTaskField(taskId, 'selectValue', newSelectVal);
      // Update masterTasks state
      setMasterTasks(prev => prev.map(t => t.id === taskId ? { ...t, selectValue: newSelectVal } : t));
    } else {
      // Revert state if failed
      setCompletions(completions);
      showAlert('error', 'Sync Error', 'Failed to update completion status. Please try again.');
    }
  };

  const handleSaveAll = () => {
    const doneIds = masterTasks
      .filter(t => (!t.date || t.date === selectedDate) && t.selectValue === 'Done')
      .map(t => t.id);
    setCommittedDoneTaskIds(prev => {
      const merged = new Set([...prev, ...doneIds]);
      return Array.from(merged);
    });
    showAlert('success', 'Saved Successfully!', 'All task updates and selections have been committed.');
  };
  
  const handleUpdateTaskField = async (taskId, field, value) => {
    if (!user?.id) return;
    
    // 1. Update state immediately (optimistic)
    setMasterTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, [field]: value };
      }
      return t;
    }));

    // 2. Call Supabase update
    const success = await updateTaskField(taskId, field, value);
    if (!success) {
      showAlert('error', 'Sync Error', 'Failed to update task. Reverting changes.');
      // Refetch planner data to revert
      const { tasks: dbTasks, completions: dbComps } = await fetchPlannerData(user.id);
      setMasterTasks(dbTasks);
      setCompletions(dbComps);
    }
  };

  const handleAddTaskClick = () => {
    setFormData({
      date: selectedDate
    });
    setTasksList([{ description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }]);
    setShowModal(true);
  };

  const handleAddRow = () => {
    setTasksList([...tasksList, { description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }]);
  };

  const handleFieldChange = (index, field, value) => {
    const newList = [...tasksList];
    newList[index][field] = value;
    setTasksList(newList);
  };

  const handleRemoveRow = (index) => {
    if (tasksList.length > 1) {
      setTasksList(tasksList.filter((_, i) => i !== index));
    } else {
      setTasksList([{ description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }]);
    }
  };

  const handleAddCategoryInline = (idx) => {
    const text = (tasksList[idx].newCategoryText || '').trim();
    if (!text) return;
    if (customCategories.includes(text)) {
      handleFieldChange(idx, 'category', text);
      handleFieldChange(idx, 'isCreatingCategory', false);
      return;
    }
    const updated = [...customCategories, text];
    localStorage.setItem('index_custom_categories', JSON.stringify(updated));
    setCustomCategories(updated);
    handleFieldChange(idx, 'category', text);
    handleFieldChange(idx, 'isCreatingCategory', false);
    handleFieldChange(idx, 'newCategoryText', '');
  };

  const handleCategorySelectChange = (idx, value) => {
    if (value === '__NEW__') {
      handleFieldChange(idx, 'isCreatingCategory', true);
    } else {
      handleFieldChange(idx, 'category', value);
    }
  };

  const showAlert = (type, title, message) => {
    setAlertConfig({ isOpen: true, type, title, message, onConfirm: () => {} });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validRows = tasksList.filter(row => row.description.trim().length > 0);

    if (validRows.length === 0) {
      showAlert('error', 'Validation Error', 'Please enter at least one task description.');
      return;
    }

    if (!user?.id) return;

    setLoading(true);
    // Format rows correctly for addPlannerTasks
    const tasksToCreate = validRows.map(row => ({
      description: row.description.trim(),
      duration: row.duration,
      category: row.category,
      priority: row.priority || '',
      date: formData.date,
      selectValue: 'Select',
      remarks: ''
    }));

    const createdTasks = await addPlannerTasks(user.id, tasksToCreate);
    if (createdTasks && createdTasks.length > 0) {
      setMasterTasks(prev => [...prev, ...createdTasks]);
      showAlert('success', 'Created!', `${createdTasks.length} task(s) added successfully.`);
    } else {
      showAlert('error', 'Database Error', 'Failed to save tasks to Supabase.');
    }
    setLoading(false);
    setShowModal(false);
  };

  const renderRow = (item) => (
    <tr key={item.id} className="hover:bg-gray-50 transition-colors text-center text-sm border-b border-gray-100">
      {/* 1. Action Checkbox */}
      <td className="px-2 py-2 w-[60px] whitespace-nowrap">
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={item.status === 'Completed'}
            onChange={() => handleToggleStatus(item.id)}
            className="w-[18px] h-[18px] text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
          />
        </div>
      </td>
      {/* 2. Status Column (Dropdown Done/Pending/Select) */}
      <td className="px-2 py-2 w-[110px] whitespace-nowrap text-center">
        <select
          value={item.status === 'Completed' ? 'Done' : (item.selectValue || 'Select')}
          onChange={(e) => handleUpdateTaskField(item.id, 'selectValue', e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
        >
          <option value="Select">Select</option>
          <option value="Pending">Pending</option>
          <option value="Done">Done</option>
        </select>
      </td>
      {/* 3. Remarks Column (Input text box) */}
      <td className="px-2 py-2 w-[180px] whitespace-nowrap text-center">
        <input
          type="text"
          value={item.remarks || ''}
          onChange={(e) => handleUpdateTaskField(item.id, 'remarks', e.target.value)}
          placeholder="Remarks..."
          className="border border-gray-355 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-[150px] font-medium"
        />
      </td>
      {/* 4. Time */}
      <td className="px-2 py-2 w-[110px] text-gray-900 font-bold whitespace-nowrap text-xs md:text-sm">
        <div className="flex items-center justify-center gap-1.5">
          <Clock size={14} className="text-gray-400" /> {item.time}
        </div>
      </td>
      {/* 5. Task Description */}
      <td className="px-4 py-2 text-gray-800 text-xs md:text-sm text-center font-medium">
        <div className="flex items-center justify-center gap-2">
          {item.priority === 'Frog' && (
            <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>
          )}
          <span>{item.description}</span>
        </div>
      </td>
      {/* 6. Category */}
      <td className="px-2 py-2 w-[140px] text-gray-700 whitespace-nowrap text-xs md:text-sm text-center">
        <span className="font-extrabold uppercase text-[11px] text-gray-650 tracking-wider flex items-center justify-center gap-1.5 select-none">
          <span>{getCategoryEmoji(item.category)}</span>
          <span>{item.category}</span>
        </span>
      </td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3.5">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2.5">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 uppercase tracking-widest">
              {getCategoryEmoji(item.category)} {item.category}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest ${item.status === 'Completed' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-amber-50 border-amber-100 text-amber-600'}`}>{item.status}</span>
          </div>
          <h3 className="text-sm md:text-base font-bold text-gray-800 leading-tight text-left flex items-start gap-1.5">
            {item.priority === 'Frog' && (
              <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>
            )}
            <span>{item.description}</span>
          </h3>
        </div>
        <div className="flex ml-2 items-center">
          <input
            type="checkbox"
            checked={item.status === 'Completed'}
            onChange={() => handleToggleStatus(item.id)}
            className="w-5 h-5 text-emerald-650 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
          />
        </div>
      </div>
      <div className="pt-1 flex items-center justify-between text-gray-500">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Clock size={13} />
          <span>{item.time}</span>
        </div>
      </div>
      {/* Mobile Card inputs for Status & Remarks */}
      <div className="pt-2.5 border-t border-gray-100 flex flex-col gap-2.5">
        <div className="flex items-center justify-between text-xs md:text-sm">
          <span className="font-bold text-gray-500">Status:</span>
          <select
            value={item.status === 'Completed' ? 'Done' : (item.selectValue || 'Select')}
            onChange={(e) => handleUpdateTaskField(item.id, 'selectValue', e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold"
          >
            <option value="Select">Select</option>
            <option value="Pending">Pending</option>
            <option value="Done">Done</option>
          </select>
        </div>
        <div className="flex flex-col gap-1 text-xs md:text-sm text-left">
          <span className="font-bold text-gray-500">Remarks:</span>
          <input
            type="text"
            value={item.remarks || ''}
            onChange={(e) => handleUpdateTaskField(item.id, 'remarks', e.target.value)}
            placeholder="Enter remarks..."
            className="border border-gray-300 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full font-medium"
          />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <div className="text-5xl animate-bounce">🐸</div>
        <div className="text-gray-500 font-bold tracking-wide animate-pulse">Loading Planner Data from Supabase...</div>
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-2 md:p-4 space-y-2 md:space-y-3 flex flex-col h-full min-h-0">
      {/* Status Filter KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Total Card */}
        <button
          onClick={() => setActiveFilter('Total')}
          className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col justify-center items-center h-[54px] shadow-sm ${
            activeFilter === 'Total'
              ? 'bg-slate-700 border-slate-800 text-white font-extrabold shadow'
              : 'bg-slate-50 border-slate-100 text-slate-700 font-bold hover:bg-slate-100'
          }`}
        >
          <span className="text-sm md:text-base leading-none">{stats.total}</span>
          <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-80">Total</span>
        </button>

        {/* Active Card */}
        <button
          onClick={() => setActiveFilter('Active')}
          className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col justify-center items-center h-[54px] shadow-sm ${
            activeFilter === 'Active'
              ? 'bg-blue-600 border-blue-700 text-white font-extrabold shadow'
              : 'bg-blue-50/70 border-blue-100 text-blue-700 font-bold hover:bg-blue-100'
          }`}
        >
          <span className="text-sm md:text-base leading-none">{stats.active}</span>
          <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-85">Active</span>
        </button>

        {/* Completed Card */}
        <button
          onClick={() => setActiveFilter('Completed')}
          className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col justify-center items-center h-[54px] shadow-sm ${
            activeFilter === 'Completed'
              ? 'bg-emerald-600 border-emerald-700 text-white font-extrabold shadow'
              : 'bg-emerald-50/70 border-emerald-100 text-emerald-700 font-bold hover:bg-emerald-100'
          }`}
        >
          <span className="text-sm md:text-base leading-none">{stats.completed}</span>
          <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-85">Completed</span>
        </button>

        {/* Pending Card */}
        <button
          onClick={() => setActiveFilter('Pending')}
          className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col justify-center items-center h-[54px] shadow-sm ${
            activeFilter === 'Pending'
              ? 'bg-amber-600 border-amber-700 text-white font-extrabold shadow'
              : 'bg-amber-50/70 border-amber-100 text-amber-700 font-bold hover:bg-amber-100'
          }`}
        >
          <span className="text-sm md:text-base leading-none">{stats.pending}</span>
          <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-85">Pending</span>
        </button>

        {/* Progress Card */}
        <button
          onClick={() => setActiveFilter('Progress')}
          className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col justify-center items-center h-[54px] shadow-sm ${
            activeFilter === 'Progress'
              ? 'bg-indigo-600 border-indigo-700 text-white font-extrabold shadow'
              : 'bg-indigo-50/70 border-indigo-100 text-indigo-750 font-bold hover:bg-indigo-100'
          }`}
        >
          <span className="text-sm md:text-base leading-none">{stats.progress}</span>
          <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-85">Progress</span>
        </button>

        {/* Delayed Card */}
        <button
          onClick={() => setActiveFilter('Delayed')}
          className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col justify-center items-center h-[54px] shadow-sm ${
            activeFilter === 'Delayed'
              ? 'bg-rose-600 border-rose-700 text-white font-extrabold shadow'
              : 'bg-rose-50/70 border-rose-100 text-rose-700 font-bold hover:bg-rose-100'
          }`}
        >
          <span className="text-sm md:text-base leading-none">{stats.delayed}</span>
          <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-85">Delayed</span>
        </button>

      </div>

      {/* Weekly Date Selector */}
      <div className="flex flex-col w-full">
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-1 sm:px-1.5 rounded-md md:rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 transition-colors flex-shrink-0 h-[38px] md:h-[44px] flex items-center justify-center shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex-1 flex overflow-x-auto hide-scrollbar gap-1.5 py-1 items-center">
            {weekDates.map((date, idx) => {
              const dateStr = formatDateLocal(date);
              const isSelected = selectedDate === dateStr;
              const isTodayDate = isToday(date);
              
              let btnClass = '';
              let textDayNameClass = '';
              let textDayNumberClass = '';

              if (isTodayDate) {
                // Today's date in solid blue (highlighted)
                btnClass = isSelected
                  ? 'bg-blue-600 border-blue-700 text-white shadow-md shadow-blue-200 scale-105'
                  : 'bg-blue-500 border-blue-500 text-white shadow-sm hover:bg-blue-600';
                textDayNameClass = 'text-blue-100 font-semibold';
                textDayNumberClass = 'text-white';
              } else if (isSelected) {
                // Selected date (faded blue, active)
                btnClass = 'bg-sky-100 border-sky-300 text-sky-700 font-bold';
                textDayNameClass = 'text-sky-650';
                textDayNumberClass = 'text-sky-900';
              } else {
                // Other dates (faded blue, inactive)
                btnClass = 'bg-sky-50/40 border-sky-100 text-sky-500 hover:bg-sky-100/30 hover:border-sky-200';
                textDayNameClass = 'text-sky-400 font-medium';
                textDayNumberClass = 'text-sky-700 font-bold';
              }
              
              return (
                <button
                  key={idx}
                  onClick={() => setSelectedDate(dateStr)}
                  className={`flex flex-col items-center justify-center flex-1 min-w-[42px] md:min-w-[56px] py-1 rounded-md md:rounded-lg border transition-all ${btnClass}`}
                >
                  <span className={`text-[8px] md:text-[9px] uppercase tracking-wider ${textDayNameClass}`}>
                    {getDayName(date)}
                  </span>
                  <span className={`text-sm md:text-base leading-none mt-0.5 ${textDayNumberClass}`}>
                    {getDayNumber(date)}
                  </span>
                  {isTodayDate && !isSelected && <span className="w-1 h-1 rounded-full bg-white mt-0.5 animate-pulse"></span>}
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-1 sm:px-1.5 rounded-md md:rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 transition-colors flex-shrink-0 h-[38px] md:h-[44px] flex items-center justify-center shadow-sm"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden mt-0">
        <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 bg-white">
          {/* 1. Title */}
          <h2 className="text-sm font-extrabold text-gray-850 shrink-0">
            Tasks for {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>

          {/* 2. Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-center lg:justify-start lg:ml-4">
            {/* Search Input */}
            <div className="relative w-44 md:w-52">
              <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-8 pr-2.5 py-1 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
              />
            </div>

            {/* Time Drop-down */}
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
              className="border border-gray-300 rounded-lg text-xs px-2 py-0.5 bg-white text-gray-750 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
            >
              <option value="">All Times</option>
              {durationOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* Category Drop-down */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-lg text-xs px-2 py-0.5 bg-white text-gray-750 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
            >
              <option value="">All Categories</option>
              {customCategories.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* Frog Task Toggle Button */}
            <button
              onClick={() => setFilterFrog(prev => prev === 'Frog' ? '' : 'Frog')}
              className={`px-2.5 py-0.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 h-[28px] ${
                filterFrog === 'Frog'
                  ? 'bg-emerald-50 border-emerald-250 text-emerald-700 shadow-sm'
                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span>🐸 Frog Tasks</span>
              {filterFrog === 'Frog' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
            </button>

            {/* Reset Filters button if any are active */}
            {(searchQuery || filterDuration || filterCategory || filterFrog) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterDuration('');
                  setFilterCategory('');
                  setFilterFrog('');
                }}
                className="text-[10px] text-red-500 hover:text-red-700 font-bold hover:underline ml-1"
              >
                Clear
              </button>
            )}
          </div>

          {/* 3. Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {allTodayFrogTasks.length > 0 && (
              <button
                onClick={() => setShowFrogModal(true)}
                className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-705 rounded-lg flex items-center justify-center px-2.5 py-1 text-[11px] font-bold shadow-sm transition active:scale-95 gap-1 h-[28px]"
              >
                <span>🐸 Frog Info ({allTodayFrogTasks.filter(t => t.isCompleted).length}/{allTodayFrogTasks.length})</span>
              </button>
            )}

            <button 
              onClick={handleSaveAll}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center px-3.5 py-1 text-xs font-bold shadow-sm transition active:scale-95 h-[28px]"
            >
              Save
            </button>

            <button 
              onClick={handleAddTaskClick}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center px-3.5 py-1 text-xs font-semibold shadow-sm transition active:scale-95 h-[28px]"
            >
              Add Task
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-1">
          <DataTable 
            headers={headers} 
            data={paginatedTasks}
            renderRow={renderRow}
            renderCard={renderCard}
            minWidth="800px"
            currentPage={currentPage}
            totalPages={totalPages}
            itemsPerPage={itemsPerPage}
            totalResults={filteredTasks.length}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={(val) => { setItemsPerPage(val); setCurrentPage(1); }}
          />
        </div>
      </div>

      {/* DYNAMIC POPUP MODAL FORM FOR NEW TASKS */}
      <ModalForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="Add New Task(s)"
        onSubmit={handleSubmit}
        submitText="Save Schedule"
      >
        <div className="space-y-4 text-left">
          
          {/* Select the date */}
          <div className="space-y-1">
            <label className="block text-[10px] md:text-[11px] text-gray-650 font-bold uppercase tracking-wider">Select the date *</label>
            <input 
              type="date"
              required 
              value={formData.date} 
              onChange={(e) => setFormData({...formData, date: e.target.value})} 
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px] bg-white" 
            />
          </div>

          {/* Dynamic Task List Items - Multi-field Rows */}
          <div className="space-y-3.5 border-t border-gray-150 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Task Item Rows</h4>
                <p className="text-[9px] text-gray-405">Configure duration, category, priority, and description for each task item</p>
              </div>
              <button
                type="button"
                onClick={handleAddRow}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition active:scale-95 flex items-center gap-1 shadow-sm"
              >
                <Plus size={12} /> Add Task Row
              </button>
            </div>

            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {tasksList.map((row, idx) => (
                <div key={idx} className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 relative space-y-2.5 text-left">
                  
                  <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
                      Task Item #{idx + 1}
                    </span>
                    
                    {tasksList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="text-red-500 hover:text-red-750 hover:bg-rose-50 p-1 rounded-md transition"
                        title="Remove task row"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

                  {/* Task Description Field */}
                  <div className="space-y-1">
                    <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Task Description *</label>
                    <input
                      type="text"
                      required
                      placeholder="What needs to be done?"
                      value={row.description}
                      onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[32px] bg-white font-medium shadow-sm"
                    />
                  </div>

                  {/* Grid Fields: Duration, Category, Priority */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {/* Time Select */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Time *</label>
                      <select
                        required
                        value={row.duration}
                        onChange={(e) => handleFieldChange(idx, 'duration', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] md:text-[12px] h-[32px] bg-white font-medium"
                      >
                        {durationOptions.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    {/* Category Select / Add */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Category *</label>
                      {row.isCreatingCategory ? (
                        <div className="flex gap-1 items-center">
                          <input
                            type="text"
                            placeholder="New category..."
                            value={row.newCategoryText || ''}
                            onChange={(e) => handleFieldChange(idx, 'newCategoryText', e.target.value)}
                            className="w-full border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] h-[32px] bg-white font-medium"
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
                            className="h-[32px] w-[30px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold shrink-0"
                            title="Confirm"
                          >
                            ✓
                          </button>
                          <button
                            type="button"
                            onClick={() => handleFieldChange(idx, 'isCreatingCategory', false)}
                            className="h-[32px] w-[30px] flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-600 rounded text-[11px] shrink-0"
                            title="Cancel"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <select
                          required
                          value={row.category}
                          onChange={(e) => handleCategorySelectChange(idx, e.target.value)}
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] md:text-[12px] h-[32px] bg-white font-medium"
                        >
                          {customCategories.map(c => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                          <option value="__NEW__">+ New Category...</option>
                        </select>
                      )}
                    </div>

                    {/* Frog Toggle */}
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Frog Task?</label>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(idx, 'priority', row.priority === 'Frog' ? '' : 'Frog')}
                        className={`w-full border rounded text-[10px] md:text-[11px] h-[32px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm ${
                          row.priority === 'Frog'
                            ? 'bg-emerald-50 border-emerald-355 text-emerald-700 font-extrabold'
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
          </div>

        </div>
      </ModalForm>

      <ModalAlert 
        {...alertConfig} 
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} 
      />

      {/* FROG TASK DETAILS DIALOG MODAL */}
      {showFrogModal && (
        <div className="fixed inset-0 lg:left-56 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-gray-150 animate-in zoom-in-95 duration-200" style={{ maxHeight: '80vh' }}>
            
            {/* Header */}
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50 text-emerald-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">🐸</span>
                <div>
                  <h2 className="text-sm font-extrabold tracking-tight">Today's Frog Tasks</h2>
                  <p className="text-[10px] text-emerald-600 font-medium">High priority tasks that must be accomplished first</p>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-250 text-[10px] font-black rounded-full">
                {allTodayFrogTasks.filter(t => t.isCompleted).length} / {allTodayFrogTasks.length} Done
              </span>
            </div>

            {/* Scrollable list of Frog Tasks */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
              {allTodayFrogTasks.length > 0 ? (
                allTodayFrogTasks.map((task) => (
                  <div 
                    key={task.id} 
                    className={`p-3 border rounded-xl flex items-center justify-between gap-3 transition-all ${
                      task.isCompleted 
                        ? 'bg-gray-50 border-gray-205 opacity-70' 
                        : 'bg-white border-emerald-150 hover:border-emerald-250 shadow-sm'
                    }`}
                  >
                    <div className="space-y-1 text-left min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase">
                          {task.duration}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-650 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase">
                          {task.category}
                        </span>
                      </div>
                      <p className={`text-xs font-bold text-gray-800 break-words ${task.isCompleted ? 'line-through text-gray-405 font-semibold' : ''}`}>
                        {task.description}
                      </p>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(task.id)}
                      className={`px-3 py-1.5 text-[10px] font-extrabold rounded-lg border shadow-sm transition-all flex-shrink-0 ${
                        task.isCompleted
                          ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-500 hover:text-white'
                          : 'bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700'
                      }`}
                    >
                      {task.isCompleted ? 'Undo' : '🐸 Eat Frog'}
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400 font-bold space-y-2">
                  <span className="text-2xl">💤</span>
                  <p className="text-xs">No Frog tasks scheduled for today.</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex justify-end">
              <button
                onClick={() => setShowFrogModal(false)}
                className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 font-bold border border-gray-300 rounded-xl text-xs shadow-sm transition active:scale-95"
              >
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
