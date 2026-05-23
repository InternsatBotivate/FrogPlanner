import React, { useState, useEffect, useMemo } from 'react';
import { Clock, ChevronLeft, ChevronRight, Plus, Trash2, Search, SlidersHorizontal, Save, Edit } from 'lucide-react';
import DataTable from '../../components/DataTable';
import ModalForm from '../../components/ModalForm';
import ModalAlert from '../../components/ModalAlert';
import { getCategoryEmoji } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import { usePlannerStore } from '../../store/plannerStore';
import { migrateLegacyData } from '../../lib/plannerService';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

const formatDateLocal = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

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

export default function Planner() {
  const { user } = useAuthStore();
  const storeTasks = usePlannerStore(state => state.tasks);
  const storeCompletions = usePlannerStore(state => state.completions);
  const storeLoading = usePlannerStore(state => state.loading);

  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(formatDateLocal(new Date()));
  
  // Editing states
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTaskData, setEditTaskData] = useState({
    id: '',
    description: '',
    duration: 'Morning',
    category: 'Work',
    priority: '',
    isCreatingCategory: false,
    newCategoryText: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [weekOffset, setWeekOffset] = useState(0);
  
  const [masterTasks, setMasterTasks] = useState([]);
  const [completions, setCompletions] = useState({});

  // Synchronize store data to local state
  useEffect(() => {
    setMasterTasks(storeTasks || []);
    setCompletions(storeCompletions || {});
  }, [storeTasks, storeCompletions]);

  useEffect(() => {
    // Only show loading spinner on initial load, not background updates
    if (!usePlannerStore.getState().hasLoaded) {
      setLoading(storeLoading);
    } else {
      setLoading(false);
    }
  }, [storeLoading]);

  // Sync date selection
  const [showModal, setShowModal] = useState(false);
  const [showFrogModal, setShowFrogModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState('Pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFrog, setFilterFrog] = useState('');
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: () => {} });
  
  // Selection states
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [dirtyTasks, setDirtyTasks] = useState({});
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [submittingFrogIds, setSubmittingFrogIds] = useState([]);

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
    setSelectedTaskIds([]); // Reset selection when date changes
    setActiveFilter('Pending'); // Reset filter when date changes
  }, [selectedDate]);

  const handleEditTaskClick = (item) => {
    setEditTaskData({
      id: item.id,
      description: item.description,
      duration: item.duration || 'Morning',
      category: item.category || customCategories[0] || 'Work',
      priority: item.priority || '',
      isCreatingCategory: false,
      newCategoryText: ''
    });
    setShowEditModal(true);
  };

  const handleEditCategoryChange = (value) => {
    if (value === '__NEW__') {
      setEditTaskData(prev => ({ ...prev, isCreatingCategory: true }));
    } else {
      setEditTaskData(prev => ({ ...prev, category: value }));
    }
  };

  const handleAddEditCategoryInline = () => {
    const text = (editTaskData.newCategoryText || '').trim();
    if (!text) return;
    if (customCategories.includes(text)) {
      setEditTaskData(prev => ({ ...prev, category: text, isCreatingCategory: false, newCategoryText: '' }));
      return;
    }
    const updated = [...customCategories, text];
    localStorage.setItem('index_custom_categories', JSON.stringify(updated));
    setCustomCategories(updated);
    setEditTaskData(prev => ({ ...prev, category: text, isCreatingCategory: false, newCategoryText: '' }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editTaskData.description.trim()) {
      showAlert('error', 'Validation Error', 'Please enter a task description.');
      return;
    }

    if (!user?.id) return;

    setModalLoading(true);
    const payload = {
      description: editTaskData.description.trim(),
      duration: editTaskData.duration,
      category: editTaskData.category,
      priority: editTaskData.priority
    };

    const updatedTask = await usePlannerStore.getState().updateTask(editTaskData.id, payload);
    if (updatedTask) {
      toast.success('Task updated successfully.');
      setShowEditModal(false);
    } else {
      toast.error('Failed to update task.');
    }
    setModalLoading(false);
  };

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
    setSelectedTaskIds([]); // Reset selection when filters change
  }, [searchQuery, filterDuration, filterCategory, filterFrog, activeFilter, selectedDate]);

  // Load tasks and completions from Supabase with legacy migration on mount
  useEffect(() => {
    const initData = async () => {
      if (user?.id) {
        await usePlannerStore.getState().fetchPlannerData(user.id);
      }
    };
    initData();
  }, [user]);



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

  const isTaskCompletedForDate = React.useCallback((task, dateStr = selectedDate) => {
    const taskDate = task.date || dateStr;
    const doneIds = completions[taskDate] || [];
    return doneIds.includes(task.id) || task.selectValue === 'Done';
  }, [completions, selectedDate]);

  const isTaskLocallyCompletedPendingSubmit = React.useCallback((task, dateStr = selectedDate) => {
    const taskDate = task.date || dateStr;
    const dirtyEntry = dirtyTasks[task.id];
    if (!dirtyEntry || dirtyEntry.date !== taskDate) return false;
    return dirtyEntry.selectValue === 'Done' && !dirtyEntry.originalDone;
  }, [dirtyTasks, selectedDate]);

  // Map master tasks to include date-specific completion status & priority
  const filteredTasks = useMemo(() => {
    const todayStr = formatDateLocal(new Date());
    let tasksToMap = [];

    if (activeFilter === 'Overdue') {
      // Find all tasks whose date is in the past AND not completed in DB (saved)
      tasksToMap = masterTasks.filter(task => {
        if (task.isRecurring || !task.date || task.date >= todayStr) return false;
        const savedCompletions = storeCompletions[task.date] || [];
        const isSavedDone = savedCompletions.includes(task.id);
        return !isSavedDone;
      });
    } else {
      tasksToMap = masterTasks.filter(task => task.date === selectedDate);
    }

    const mapped = tasksToMap.map(task => {
      const isDone = isTaskCompletedForDate(task, selectedDate);
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

    let result = mapped;

    if (activeFilter === 'Completed') {
      result = result.filter(t => t.status === 'Completed');
    } else if (activeFilter === 'Pending') {
      result = result.filter(t => (
        !isTaskCompletedForDate(t, selectedDate) || isTaskLocallyCompletedPendingSubmit(t, selectedDate)
      ));
    } else if (activeFilter === 'PendingFrogs') {
      result = result.filter(t => (
        t.priority === 'Frog' && (
          !isTaskCompletedForDate(t, selectedDate) || isTaskLocallyCompletedPendingSubmit(t, selectedDate)
        )
      ));
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
  }, [masterTasks, completions, selectedDate, activeFilter, searchQuery, filterDuration, filterCategory, filterFrog, isTaskCompletedForDate, isTaskLocallyCompletedPendingSubmit]);

  // Compute stats for current day's KPI filter cards
  const stats = useMemo(() => {
    const todayStr = formatDateLocal(new Date());
    const dayTasks = masterTasks.filter(task => task.date === selectedDate);
    
    let completed = 0;
    let pending = 0;
    let pendingFrogs = 0;

    dayTasks.forEach(task => {
      const isDone = isTaskCompletedForDate(task, selectedDate);
      if (isDone) {
        completed++;
      } else {
        pending++;
        if (task.priority === 'Frog') {
          pendingFrogs++;
        }
      }
    });

    const overdue = masterTasks.filter(t => {
      if (t.isRecurring || !t.date || t.date >= todayStr) return false;
      return !isTaskCompletedForDate(t, t.date);
    }).length;

    const total = completed + pending;
    return { total, completed, pending, pendingFrogs, overdue };
  }, [masterTasks, completions, selectedDate, isTaskCompletedForDate]);

  // Get all Frog Tasks for selected date
  const allTodayFrogTasks = useMemo(() => {
    return masterTasks
      .filter(t => t.date === selectedDate)
      .filter(t => t.priority === 'Frog')
      .map(t => ({
        ...t,
        isCompleted: isTaskCompletedForDate(t, selectedDate)
      }));
  }, [masterTasks, completions, selectedDate, isTaskCompletedForDate]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const headers = ['Action', 'Status', 'Remarks', 'Time', 'Task Description', 'Category', 'Edit'];

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

  // Handle status change from dropdown to ensure 100% synchronization with completion state
  const handleStatusDropdownChange = (taskId, value) => {
    if (!user?.id) return;
    
    const task = masterTasks.find(t => t.id === taskId);
    const taskDate = task ? (task.date || selectedDate) : selectedDate;
    if (!task) return;
    
    const isAdding = (value === 'Done');
    const currentCompleted = completions[taskDate] || [];
    const hasCompleted = currentCompleted.includes(taskId);
    
    // 1. Update completion state locally if the done state actually changed
    if (isAdding !== hasCompleted) {
      let newCompleted;
      if (!isAdding) {
        newCompleted = currentCompleted.filter(id => id !== taskId);
      } else {
        newCompleted = [...currentCompleted, taskId];
      }
      setCompletions(prev => ({
        ...prev,
        [taskDate]: newCompleted
      }));
    }
    
    // 2. Update selectValue field in the local state
    setMasterTasks(prev => prev.map(t => t.id === taskId ? { ...t, selectValue: value } : t));
    
    // 3. Mark the task as dirty
    setDirtyTasks(prev => {
      const existing = prev[taskId] || {
        id: taskId,
        date: taskDate,
        selectValue: task.selectValue,
        remarks: task.remarks,
        originalDone: hasCompleted
      };
      return {
        ...prev,
        [taskId]: {
          ...existing,
          selectValue: value
        }
      };
    });
  };

  // Toggle completion status for specific date (called by checkbox)
  const handleToggleStatus = (taskId) => {
    const task = masterTasks.find(t => t.id === taskId);
    const taskDate = task ? (task.date || selectedDate) : selectedDate;
    const currentCompleted = completions[taskDate] || [];
    const isAdding = !currentCompleted.includes(taskId);
    const newSelectVal = isAdding ? 'Done' : 'Select';
    handleStatusDropdownChange(taskId, newSelectVal);
  };

  const handleEatFrogNow = async (taskId) => {
    if (!user?.id) return;

    const task = masterTasks.find(t => t.id === taskId);
    if (!task) return;

    const taskDate = task.date || selectedDate;
    if (isTaskCompletedForDate(task, taskDate)) return;

    const existingDirty = dirtyTasks[taskId];
    const remarksToSave = existingDirty?.remarks ?? task.remarks ?? '';
    const previousCompletions = completions;
    const previousMasterTasks = masterTasks;

    setSubmittingFrogIds(prev => [...prev, taskId]);

    setCompletions(prev => {
      const dateCompletions = prev[taskDate] || [];
      if (dateCompletions.includes(taskId)) return prev;
      return {
        ...prev,
        [taskDate]: [...dateCompletions, taskId]
      };
    });

    setMasterTasks(prev => prev.map(t => (
      t.id === taskId
        ? { ...t, selectValue: 'Done', remarks: remarksToSave }
        : t
    )));

    const toastId = toast.loading('Saving frog task as completed...');

    try {
      const [taskUpdate, completionInsert] = await Promise.all([
        supabase
          .from('tasks')
          .update({
            select_value: 'Done',
            remarks: remarksToSave
          })
          .eq('id', taskId),
        supabase
          .from('task_completions')
          .insert({
            user_id: user.id,
            task_id: taskId,
            completion_date: taskDate
          })
      ]);

      if (taskUpdate.error) throw taskUpdate.error;
      if (completionInsert.error && completionInsert.error.code !== '23505') throw completionInsert.error;

      setDirtyTasks(prev => {
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });

      toast.success('Frog task marked completed and submitted.', { id: toastId });
      await usePlannerStore.getState().fetchPlannerData(user.id, true);
    } catch (error) {
      console.error('[Eat Frog Submit Error]', error);
      setCompletions(previousCompletions);
      setMasterTasks(previousMasterTasks);
      toast.error('Failed to submit frog task. Reverted to previous state.', { id: toastId });
      await usePlannerStore.getState().fetchPlannerData(user.id, true);
    } finally {
      setSubmittingFrogIds(prev => prev.filter(id => id !== taskId));
    }
  };

  // Bulk Actions
  const handleBulkComplete = () => {
    if (!user?.id || selectedTaskIds.length === 0) return;
    
    const tasksToComplete = masterTasks.filter(t => selectedTaskIds.includes(t.id));
    
    // 1. Update completions locally
    setCompletions(prev => {
      const completionsUpdates = { ...prev };
      tasksToComplete.forEach(task => {
        const taskDate = task.date || selectedDate;
        const dateCompletions = completionsUpdates[taskDate] || [];
        if (!dateCompletions.includes(task.id)) {
          completionsUpdates[taskDate] = [...dateCompletions, task.id];
        }
      });
      return completionsUpdates;
    });
    
    // 2. Update selectValue locally
    setMasterTasks(prev => prev.map(t => selectedTaskIds.includes(t.id) ? { ...t, selectValue: 'Done' } : t));
    
    // 3. Track in dirtyTasks state
    setDirtyTasks(prev => {
      const updatedDirty = { ...prev };
      tasksToComplete.forEach(task => {
        const taskDate = task.date || selectedDate;
        const currentCompleted = completions[taskDate] || [];
        const hasCompleted = currentCompleted.includes(task.id);
        
        updatedDirty[task.id] = {
          ...(updatedDirty[task.id] || {
            id: task.id,
            date: taskDate,
            selectValue: task.selectValue,
            remarks: task.remarks,
            originalDone: hasCompleted
          }),
          selectValue: 'Done'
        };
      });
      return updatedDirty;
    });
    
    toast.success(`Locally marked ${selectedTaskIds.length} task(s) as completed. Click Submit to save!`);
    setSelectedTaskIds([]);
  };

  const handleBulkDelete = async () => {
    if (!user?.id || selectedTaskIds.length === 0) return;
    
    setAlertConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Confirm Delete',
      message: `Are you sure you want to permanently delete the ${selectedTaskIds.length} selected task(s)?`,
      onConfirm: async () => {
        const toastId = toast.loading('Deleting selected task(s)...');
        try {
          const { error } = await supabase
            .from('tasks')
            .delete()
            .in('id', selectedTaskIds);
            
          if (error) throw error;
          
          await usePlannerStore.getState().fetchPlannerData(user.id, true);
          setSelectedTaskIds([]);
          toast.success('Selected task(s) deleted successfully.', { id: toastId });
        } catch (error) {
          console.error('[Bulk Delete]', error);
          toast.error('Failed to delete selected tasks.', { id: toastId });
        }
      }
    });
  };

  const handleSaveAll = async () => {
    if (!user?.id) return;
    const dirtyList = Object.values(dirtyTasks);
    if (dirtyList.length === 0) {
      toast.success('No changes to submit.');
      return;
    }

    const toastId = toast.loading('Submitting changes to database...');
    try {
      // 1. Prepare updates for tasks table
      const taskPromises = dirtyList.map(item => {
        const dbFieldVal = item.selectValue || 'Select';
        return supabase
          .from('tasks')
          .update({
            select_value: dbFieldVal,
            remarks: item.remarks || ''
          })
          .eq('id', item.id);
      });

      // 2. Prepare task_completions insertions and deletions
      const completionsToInsert = [];
      const completionsToDelete = [];

      dirtyList.forEach(item => {
        const isCurrentlyDone = (item.selectValue === 'Done');
        if (isCurrentlyDone && !item.originalDone) {
          completionsToInsert.push({
            user_id: user.id,
            task_id: item.id,
            completion_date: item.date
          });
        } else if (!isCurrentlyDone && item.originalDone) {
          completionsToDelete.push(item.id);
        }
      });

      // Execute all task updates in parallel
      const taskResults = await Promise.all(taskPromises);
      for (const res of taskResults) {
        if (res.error) throw res.error;
      }

      // Execute insertions if any
      if (completionsToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('task_completions')
          .insert(completionsToInsert);
        if (insertErr && insertErr.code !== '23505') throw insertErr;
      }

      // Execute deletions if any
      if (completionsToDelete.length > 0) {
        const { error: deleteErr } = await supabase
          .from('task_completions')
          .delete()
          .eq('user_id', user.id)
          .in('task_id', completionsToDelete);
        if (deleteErr) throw deleteErr;
      }

      // Success! Clear dirty state
      setDirtyTasks({});
      toast.success(`Successfully submitted ${dirtyList.length} change(s) to database!`, { id: toastId });
      await usePlannerStore.getState().fetchPlannerData(user.id, true);
    } catch (error) {
      console.error('[Planner Submit Error]', error);
      toast.error('Failed to submit changes to the database. Reverting to server state...', { id: toastId });
      // Revert states by refetching through central store
      await usePlannerStore.getState().fetchPlannerData(user.id, true);
      setDirtyTasks({});
    }
  };
  
  const handleUpdateTaskField = (taskId, field, value) => {
    if (!user?.id) return;
    
    // 1. Update state immediately (optimistic)
    setMasterTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, [field]: value };
      }
      return t;
    }));

    // 2. Track in dirtyTasks state
    const task = masterTasks.find(t => t.id === taskId);
    if (!task) return;
    const taskDate = task.date || selectedDate;
    const currentCompleted = completions[taskDate] || [];
    const hasCompleted = currentCompleted.includes(taskId);

    setDirtyTasks(prev => {
      const existing = prev[taskId] || {
        id: taskId,
        date: taskDate,
        selectValue: task.selectValue,
        remarks: task.remarks,
        originalDone: hasCompleted
      };
      return {
        ...prev,
        [taskId]: {
          ...existing,
          [field]: value
        }
      };
    });
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

    setModalLoading(true);
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

    const createdTasks = await usePlannerStore.getState().addPlannerTasks(user.id, tasksToCreate);
    if (createdTasks && createdTasks.length > 0) {
      showAlert('success', 'Created!', `${createdTasks.length} task(s) added successfully.`);
    } else {
      showAlert('error', 'Database Error', 'Failed to save tasks to Supabase.');
    }
    setModalLoading(false);
    setShowModal(false);
  };

  const renderRow = (item) => {
    const isCompleted = isTaskCompletedForDate(item, item.date || selectedDate);
    const isSavedCompleted = (storeCompletions[item.date || selectedDate] || []).includes(item.id);
    const isDisabled = activeFilter === 'Completed' || (isCompleted && isSavedCompleted);
    return (
      <tr key={item.id} className="hover:bg-gray-50/80 transition-colors text-center text-sm border-b border-gray-100">
        {/* Action Checkbox */}
        <td className="px-2 py-2 w-[60px] whitespace-nowrap">
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              checked={item.status === 'Completed'}
              onChange={() => handleToggleStatus(item.id)}
              disabled={isDisabled}
              className={`w-[18px] h-[18px] text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 ${
                isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            />
          </div>
        </td>
        {/* Status Column (Dropdown Done/Pending/Select) */}
        <td className="px-2 py-2 w-[110px] whitespace-nowrap text-center">
          <select
            value={item.status === 'Completed' ? 'Done' : (item.selectValue || 'Select')}
            onChange={(e) => handleStatusDropdownChange(item.id, e.target.value)}
            disabled={isDisabled}
            className={`border border-gray-300 rounded px-2 py-1 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-semibold ${
              isDisabled ? 'cursor-not-allowed bg-gray-50 opacity-80' : ''
            }`}
          >
            <option value="Select">Select</option>
            <option value="Pending">Pending</option>
            <option value="Done">Done</option>
          </select>
        </td>
        {/* Remarks Column (Input text box) */}
        <td className="px-2 py-2 w-[180px] whitespace-nowrap text-center">
          <input
            type="text"
            value={item.remarks || ''}
            onChange={(e) => handleUpdateTaskField(item.id, 'remarks', e.target.value)}
            disabled={isDisabled}
            placeholder={isDisabled ? 'No remarks' : 'Remarks...'}
            className={`border border-gray-355 rounded px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full max-w-[150px] font-medium ${
              isDisabled ? 'cursor-not-allowed bg-gray-50 opacity-80' : ''
            }`}
          />
        </td>
        {/* Time */}
        <td className="px-2 py-2 w-[110px] text-gray-900 font-bold whitespace-nowrap text-xs md:text-sm">
          <div className="flex items-center justify-center gap-1.5">
            <Clock size={14} className="text-gray-400" /> {item.time}
          </div>
        </td>
        {/* Task Description */}
        <td className="px-4 py-2 text-gray-800 text-xs md:text-sm text-center font-medium">
          <div className="flex items-center justify-center gap-2">
            {item.priority === 'Frog' && (
              <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>
            )}
            <span>{item.description}</span>
          </div>
        </td>
        {/* Category */}
        <td className="px-2 py-2 w-[140px] text-gray-700 whitespace-nowrap text-xs md:text-sm text-center">
          <span className="font-extrabold uppercase text-[11px] text-gray-650 tracking-wider flex items-center justify-center gap-1.5 select-none">
            <span>{getCategoryEmoji(item.category)}</span>
            <span>{item.category}</span>
          </span>
        </td>
        {/* Edit Action Button */}
        <td className="px-2 py-2 w-[60px] whitespace-nowrap">
          <div className="flex items-center justify-center">
            <button
              onClick={() => handleEditTaskClick(item)}
              className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 p-1.5 rounded-lg transition"
              title="Edit Task"
            >
              <Edit size={14} />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  const renderCard = (item) => {
    const isCompleted = isTaskCompletedForDate(item, item.date || selectedDate);
    const isSavedCompleted = (storeCompletions[item.date || selectedDate] || []).includes(item.id);
    const isDisabled = activeFilter === 'Completed' || (isCompleted && isSavedCompleted);
    return (
      <div key={item.id} className="bg-white p-3 rounded-xl border border-gray-150 shadow-sm space-y-2 transition-all duration-200 hover:shadow-md">
        {/* Row 1: Description + Edit + Checkbox */}
        <div className="flex justify-between items-start gap-2">
          <h3 className="text-sm font-bold text-gray-800 leading-snug text-left flex items-start gap-1">
            {item.priority === 'Frog' && (
              <span className="text-sm select-none flex-shrink-0" title="Frog Task">🐸</span>
            )}
            <span>{item.description}</span>
          </h3>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleEditTaskClick(item)}
              className="text-indigo-600 hover:text-indigo-900 hover:bg-indigo-50 p-1 rounded transition"
              title="Edit Task"
            >
              <Edit size={14} />
            </button>
            <input
              type="checkbox"
              checked={item.status === 'Completed'}
              onChange={() => handleToggleStatus(item.id)}
              disabled={isDisabled}
              className={`w-[18px] h-[18px] text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 ${
                isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
              }`}
            />
          </div>
        </div>

        {/* Row 2: Badges (Category, Time, Status) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${getCategoryColorClass(item.category)}`}>
            {getCategoryEmoji(item.category)} {item.category}
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-50 border border-gray-150 rounded text-[9px] font-bold text-gray-500">
            <span className="text-[11px] select-none">{getDurationEmoji(item.time)}</span>
            <span>{item.time}</span>
          </span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
            item.status === 'Completed' 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
              : 'bg-amber-50 border-amber-100 text-amber-600'
          }`}>
            {item.status}
          </span>
        </div>

        {/* Row 3: Action controls (Status dropdown + Remarks input inline) */}
        <div className="flex items-center gap-2 pt-1 text-xs">
          <select
            value={item.status === 'Completed' ? 'Done' : (item.selectValue || 'Select')}
            onChange={(e) => handleStatusDropdownChange(item.id, e.target.value)}
            disabled={isDisabled}
            className={`border border-gray-250 rounded-lg px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold shrink-0 ${
              isDisabled ? 'cursor-not-allowed bg-gray-50 opacity-80' : ''
            }`}
          >
            <option value="Select">Status</option>
            <option value="Pending">Pending</option>
            <option value="Done">Done</option>
          </select>
          <input
            type="text"
            value={item.remarks || ''}
            onChange={(e) => handleUpdateTaskField(item.id, 'remarks', e.target.value)}
            disabled={isDisabled}
            placeholder={isDisabled ? 'No remarks' : 'Remarks...'}
            className={`border border-gray-250 rounded-lg px-2.5 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 font-medium min-w-0 ${
              isDisabled ? 'cursor-not-allowed bg-gray-50 opacity-80' : ''
            }`}
          />
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <div className="text-5xl animate-bounce">🐸</div>
        <div className="text-gray-500 font-bold tracking-wide animate-pulse">Loading Planner Data from Supabase...</div>
      </div>
    );
  }

  return (
    <div className="p-1.5 sm:p-3 lg:p-4 space-y-3 lg:space-y-4 flex flex-col h-full min-h-0 overflow-hidden text-left relative">
      {/* Status Filter KPI Cards Bar */}
      <div className="grid grid-cols-5 gap-1 md:gap-2.5 shrink-0">
        
        {/* Total Card */}
        <button
          onClick={() => setActiveFilter('Total')}
          className={`py-1.5 px-1 sm:px-3 rounded-xl border text-center transition-all duration-155 flex flex-col justify-center items-center h-[54px] sm:h-[58px] shadow-sm font-bold active:scale-95 ${
            activeFilter === 'Total'
              ? 'bg-slate-800 border-slate-900 text-white scale-[1.02] shadow-md'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100/50'
          }`}
        >
          <span className="text-sm sm:text-base md:text-lg leading-none font-extrabold">{stats.total}</span>
          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5 opacity-90">Total</span>
        </button>

        {/* Completed Card */}
        <button
          onClick={() => setActiveFilter(prev => prev === 'Completed' ? 'Pending' : 'Completed')}
          className={`py-1.5 px-1 sm:px-3 rounded-xl border text-center transition-all duration-155 flex flex-col justify-center items-center h-[54px] sm:h-[58px] shadow-sm font-bold active:scale-95 ${
            activeFilter === 'Completed'
              ? 'bg-emerald-600 border-emerald-700 text-white scale-[1.02] shadow-md'
              : 'bg-emerald-50/80 border-emerald-100 text-emerald-700 hover:bg-emerald-100/50'
          }`}
        >
          <span className="text-sm sm:text-base md:text-lg leading-none font-extrabold">{stats.completed}</span>
          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5 opacity-90">Done</span>
        </button>

        {/* Pending Card */}
        <button
          onClick={() => setActiveFilter(prev => prev === 'Pending' ? 'Total' : 'Pending')}
          className={`py-1.5 px-1 sm:px-3 rounded-xl border text-center transition-all duration-155 flex flex-col justify-center items-center h-[54px] sm:h-[58px] shadow-sm font-bold active:scale-95 ${
            activeFilter === 'Pending'
              ? 'bg-amber-600 border-amber-700 text-white scale-[1.02] shadow-md'
              : 'bg-amber-50/80 border-amber-100 text-amber-700 hover:bg-amber-100/50'
          }`}
        >
          <span className="text-sm sm:text-base md:text-lg leading-none font-extrabold">{stats.pending}</span>
          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5 opacity-90">Pending</span>
        </button>

        {/* Pending Frogs Card */}
        <button
          onClick={() => setActiveFilter(prev => prev === 'PendingFrogs' ? 'Pending' : 'PendingFrogs')}
          className={`py-1.5 px-1 sm:px-3 rounded-xl border text-center transition-all duration-155 flex flex-col justify-center items-center h-[54px] sm:h-[58px] shadow-sm font-bold active:scale-95 ${
            activeFilter === 'PendingFrogs'
              ? 'bg-emerald-750 border-emerald-800 text-white scale-[1.02] shadow-md'
              : 'bg-green-50 border-green-150 text-green-800 hover:bg-green-100/50'
          }`}
        >
          <span className="text-sm sm:text-base md:text-lg leading-none font-extrabold flex items-center gap-0.5">🐸{stats.pendingFrogs}</span>
          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5 opacity-90">Frogs</span>
        </button>

        {/* Overdue Card */}
        <button
          onClick={() => setActiveFilter(prev => prev === 'Overdue' ? 'Pending' : 'Overdue')}
          className={`py-1.5 px-1 sm:px-3 rounded-xl border text-center transition-all duration-155 flex flex-col justify-center items-center h-[54px] sm:h-[58px] shadow-sm font-bold active:scale-95 ${
            activeFilter === 'Overdue'
              ? 'bg-rose-600 border-rose-700 text-white scale-[1.02] shadow-md'
              : 'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100/50'
          }`}
        >
          <span className="text-sm sm:text-base md:text-lg leading-none font-extrabold">{stats.overdue}</span>
          <span className="text-[8px] sm:text-[9px] uppercase tracking-wider mt-0.5 opacity-90">Overdue</span>
        </button>

      </div>

      {/* Weekly Date Selector */}
      <div className="flex flex-col w-full">
        <div className="flex items-center gap-1 sm:gap-2">
          <button 
            onClick={() => setWeekOffset(prev => prev - 1)}
            className="p-1 sm:px-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 transition-colors flex-shrink-0 h-[38px] md:h-[44px] flex items-center justify-center shadow-sm"
          >
            <ChevronLeft size={16} />
          </button>
          
          <div className="flex-1 flex overflow-x-auto scrollbar-hide gap-1.5 py-1 items-center">
            {weekDates.map((date, idx) => {
              const dateStr = formatDateLocal(date);
              const isSelected = selectedDate === dateStr;
              
              let btnClass = '';
              let textDayNameClass = '';
              let textDayNumberClass = '';

              if (isSelected) {
                // Selected date (vibrant solid green)
                btnClass = 'bg-emerald-600 border-emerald-700 text-white shadow-md shadow-emerald-100 scale-105 font-bold';
                textDayNameClass = 'text-emerald-100 font-semibold';
                textDayNumberClass = 'text-white';
              } else {
                // Other dates (soft blue/cyan background, text-sky-500)
                btnClass = 'bg-sky-50/20 border-sky-100/50 text-sky-500 hover:bg-sky-100/30';
                textDayNameClass = 'text-sky-400 font-semibold';
                textDayNumberClass = 'text-sky-700 font-bold';
              }
              
              return (
                <button
                   key={idx}
                   onClick={() => setSelectedDate(dateStr)}
                   className={`flex flex-col items-center justify-center flex-1 min-w-[42px] md:min-w-[56px] py-1 rounded-xl border transition-all ${btnClass}`}
                >
                  <span className={`text-[8px] md:text-[9px] uppercase tracking-wider ${textDayNameClass}`}>
                    {getDayName(date)}
                  </span>
                  <span className={`text-xs sm:text-sm md:text-base leading-none mt-0.5 ${textDayNumberClass}`}>
                    {getDayNumber(date)}
                  </span>
                </button>
              );
            })}
          </div>

          <button 
            onClick={() => setWeekOffset(prev => prev + 1)}
            className="p-1 sm:px-2.5 rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 transition-colors flex-shrink-0 h-[38px] md:h-[44px] flex items-center justify-center shadow-sm"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden mt-0">
        
        {/* DESKTOP HEADER (Hidden on Mobile/Tablet) */}
        <div className="hidden lg:flex items-center justify-between gap-3 p-3 sm:p-4 border-b border-gray-100 bg-white">
          {/* 1. Title */}
          <h2 className="text-sm font-extrabold text-gray-850 shrink-0">
            {activeFilter === 'Overdue'
              ? 'Overdue Tasks'
              : `Tasks for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}`}
          </h2>

          {/* 2. Filters */}
          <div className="flex items-center gap-2 flex-1 ml-4">
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
              className="border border-gray-300 rounded-lg text-xs px-2 py-0.5 bg-white text-gray-755 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
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
              className="border border-gray-300 rounded-lg text-xs px-2 py-0.5 bg-white text-gray-755 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
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
            {/* Frog Tasks Modal Button */}
            <button
              onClick={() => setShowFrogModal(true)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-1.5 h-[28px] text-[11px] font-bold shadow-sm transition active:scale-95 border border-emerald-700"
            >
              <span>🐸 View Frog Tasks</span>
              {allTodayFrogTasks.filter(t => !t.isCompleted).length > 0 && (
                <span className="bg-white text-emerald-700 font-black text-[9px] rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {allTodayFrogTasks.filter(t => !t.isCompleted).length}
                </span>
              )}
            </button>

            <button 
              onClick={handleSaveAll}
              disabled={Object.keys(dirtyTasks).length === 0}
              className={`rounded-lg flex items-center justify-center px-3.5 py-1 text-xs font-extrabold shadow-sm transition-all duration-150 active:scale-95 h-[28px] ${
                Object.keys(dirtyTasks).length > 0 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white ring-2 ring-emerald-400 ring-offset-1 animate-pulse' 
                  : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
              }`}
            >
              Submit {Object.keys(dirtyTasks).length > 0 ? `(${Object.keys(dirtyTasks).length})` : ''}
            </button>

            <button 
              onClick={handleAddTaskClick}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center px-3.5 py-1 text-xs font-semibold shadow-sm transition active:scale-95 h-[28px]"
            >
              Add Task
            </button>
          </div>
        </div>

        {/* MOBILE/TABLET HEADER (Visible on Mobile/Tablet) */}
        <div className="flex lg:hidden flex-col gap-2.5 p-3 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2 w-full">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-8 pr-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[34px] font-medium"
              />
            </div>

            {/* Sliders / Filters Toggle */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`p-2 border rounded-lg flex items-center justify-center transition-all h-[34px] w-[34px] ${
                showMobileFilters 
                  ? 'bg-sky-50 border-sky-300 text-sky-600' 
                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50 shadow-sm'
              }`}
            >
              <SlidersHorizontal size={16} />
            </button>

            {/* View Frog Tasks Button */}
            <button
              onClick={() => setShowFrogModal(true)}
              className="relative p-2 border border-gray-300 rounded-lg flex items-center justify-center bg-white hover:bg-emerald-50 hover:border-emerald-300 transition-all h-[34px] w-[34px] shadow-sm text-sm active:scale-95 shrink-0"
              title="View Frog Tasks"
            >
              <span>🐸</span>
              {allTodayFrogTasks.filter(t => !t.isCompleted).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-emerald-600 text-white font-extrabold text-[8px] rounded-full w-4 h-4 flex items-center justify-center leading-none ring-1 ring-white">
                  {allTodayFrogTasks.filter(t => !t.isCompleted).length}
                </span>
              )}
            </button>

            {/* Save/Submit Button */}
            <button 
              onClick={handleSaveAll}
              disabled={Object.keys(dirtyTasks).length === 0}
              className={`rounded-lg flex items-center justify-center h-[34px] w-[34px] transition-all duration-150 active:scale-95 ${
                Object.keys(dirtyTasks).length > 0 
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400 ring-offset-1 animate-pulse border border-emerald-700 shadow-sm' 
                  : 'bg-slate-50 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
              }`}
            >
              <Save size={16} />
            </button>

            {/* Add Task Button */}
            <button 
              onClick={handleAddTaskClick}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center h-[34px] w-[34px] transition active:scale-95 shadow-sm border border-emerald-700"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Collapsible mobile/tablet filters panel */}
          {showMobileFilters && (
            <div className="flex flex-col gap-2 p-3 bg-slate-50/70 border border-slate-100 rounded-xl animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 gap-2">
                {/* Time Drop-down */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">Time</span>
                  <select
                    value={filterDuration}
                    onChange={(e) => setFilterDuration(e.target.value)}
                    className="border border-gray-300 rounded-lg text-xs px-2 py-1.5 bg-white text-gray-750 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[34px]"
                  >
                    <option value="">All Times</option>
                    {durationOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
                
                {/* Category Drop-down */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">Category</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="border border-gray-300 rounded-lg text-xs px-2 py-1.5 bg-white text-gray-750 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[34px]"
                  >
                    <option value="">All Categories</option>
                    {customCategories.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div className="flex items-center justify-between gap-2 mt-1 pt-1.5 border-t border-slate-150">
                {/* Frog Tasks Toggle */}
                <button
                  onClick={() => setFilterFrog(prev => prev === 'Frog' ? '' : 'Frog')}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center gap-1.5 h-[32px] ${
                    filterFrog === 'Frog'
                      ? 'bg-emerald-50 border-emerald-250 text-emerald-700 shadow-sm'
                      : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span>🐸 Frog Tasks Only</span>
                  {filterFrog === 'Frog' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>}
                </button>
              </div>

              {/* Reset/Clear button */}
              {(searchQuery || filterDuration || filterCategory || filterFrog) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterDuration('');
                    setFilterCategory('');
                    setFilterFrog('');
                  }}
                  className="w-full mt-1.5 text-center text-xs text-rose-500 hover:text-rose-700 font-bold hover:underline py-1.5 bg-rose-50/50 rounded-lg border border-rose-100/50"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          )}
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
        loading={modalLoading}
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

      {/* EDIT TASK POPUP MODAL */}
      <ModalForm
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Task"
        onSubmit={handleEditSubmit}
        submitText="Save Changes"
        loading={modalLoading}
      >
        <div className="space-y-4 text-left">
          {/* Task Description Field */}
          <div className="space-y-1">
            <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Task Description *</label>
            <input
              type="text"
              required
              placeholder="What needs to be done?"
              value={editTaskData.description}
              onChange={(e) => setEditTaskData(prev => ({ ...prev, description: e.target.value }))}
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
                value={editTaskData.duration}
                onChange={(e) => setEditTaskData(prev => ({ ...prev, duration: e.target.value }))}
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
              {editTaskData.isCreatingCategory ? (
                <div className="flex gap-1 items-center">
                  <input
                    type="text"
                    placeholder="New category..."
                    value={editTaskData.newCategoryText || ''}
                    onChange={(e) => setEditTaskData(prev => ({ ...prev, newCategoryText: e.target.value }))}
                    className="w-full border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] h-[32px] bg-white font-medium"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEditCategoryInline();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAddEditCategoryInline}
                    className="h-[32px] w-[30px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold shrink-0"
                    title="Confirm"
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTaskData(prev => ({ ...prev, isCreatingCategory: false }))}
                    className="h-[32px] w-[30px] flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-600 rounded text-[11px] shrink-0"
                    title="Cancel"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  required
                  value={editTaskData.category}
                  onChange={(e) => handleEditCategoryChange(e.target.value)}
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
                onClick={() => setEditTaskData(prev => ({ ...prev, priority: prev.priority === 'Frog' ? '' : 'Frog' }))}
                className={`w-full border rounded text-[10px] md:text-[11px] h-[32px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm ${
                  editTaskData.priority === 'Frog'
                    ? 'bg-emerald-50 border-emerald-355 text-emerald-700 font-extrabold'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                }`}
              >
                {editTaskData.priority === 'Frog' ? '🐸 Frog!' : '🐸 Mark Frog'}
              </button>
            </div>
          </div>
        </div>
      </ModalForm>

      <ModalAlert 
        {...alertConfig} 
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })} 
      />

      {showFrogModal && (() => {
        const frogTasks = allTodayFrogTasks.filter(t => !t.isCompleted);
        const frogDone = allTodayFrogTasks.filter(t => t.isCompleted).length;
        const frogTotal = allTodayFrogTasks.length;
        return (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowFrogModal(false); }}
          >
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200" style={{ maxHeight: '85vh' }}>

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
                      key={`frog-modal-${t.id}`}
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
                        {(t.date || selectedDate) && (
                          <span className="ml-auto px-2 py-0.5 bg-slate-50 text-slate-400 border border-slate-100 rounded text-[9px] font-semibold">
                            {t.date || selectedDate}
                          </span>
                        )}
                      </div>
                      {/* Description + action */}
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold text-gray-800 leading-snug flex-1">{t.description}</p>
                        <button
                          onClick={() => handleEatFrogNow(t.id)}
                          disabled={submittingFrogIds.includes(t.id)}
                          className={`shrink-0 px-3 py-1.5 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center gap-1 ${
                            submittingFrogIds.includes(t.id)
                              ? 'bg-emerald-300 cursor-not-allowed opacity-80'
                              : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
                          }`}
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
