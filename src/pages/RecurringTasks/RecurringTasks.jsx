import React, { useState, useEffect, useMemo } from 'react';
import FrogLogo from '../../components/FrogLogo';
import { Search, Plus, Filter, Edit, Trash2, CheckCircle2, PauseCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import DataTable from '../../components/DataTable';
import ModalAlert from '../../components/ModalAlert';
import ModalForm from '../../components/ModalForm';
import CategoryIcon from '../../components/CategoryIcon';
import { useAuthStore } from '../../store/authStore';
import {
  fetchRecurringTasks,
  addRecurringTasks,
  updateRecurringTask,
  deleteRecurringTask
} from '../../lib/recurringTasksService';

export default function RecurringTasks() {
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);

  const { user, updateCustomCategories } = useAuthStore();

  // Custom categories derived from user profile
  const customCategories = user?.custom_categories || ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];

  const [customCategoryText, setCustomCategoryText] = useState('');

  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: () => { } });

  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const priorityOptions = ['Low', 'Medium', 'High'];

  const [formData, setFormData] = useState({
    description: '',
    duration: 'Morning',
    category: 'Work',
    priority: '',
    remarks: '',
    isActive: true,
    frequency: 'Daily',
    daysOfWeek: [],
    dayOfMonth: 1,
    monthOfYear: 1,
    intervalDays: 2,
    startDate: '',
    endDate: '',
    skipDaysOfWeek: []
  });

  const headers = ['Action', 'Task Description', 'Time', 'Repeats', 'Category', 'Remarks', 'Status'];

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  /** "except Sun, Sat" suffix shared by every frequency's summary; empty when nothing is skipped. */
  const describeSkips = (recurrence) => {
    const skips = recurrence?.skipDaysOfWeek || [];
    if (skips.length === 0) return '';
    return ` except ${[...skips].sort((a, b) => a - b).map(d => DAY_NAMES[d]).join(', ')}`;
  };

  /** One-line plain-English summary of a template's schedule. */
  const describeSchedule = (recurrence) => {
    const skipSuffix = describeSkips(recurrence);
    if (!recurrence || recurrence.frequency === 'Daily') return `Every day${skipSuffix}`;
    if (recurrence.frequency === 'Weekly') {
      const days = recurrence.daysOfWeek || [];
      if (days.length === 0) return `Weekly${skipSuffix}`;
      if (days.length === 7) return `Every day${skipSuffix}`;
      return [...days].sort((a, b) => a - b).map(d => DAY_NAMES[d]).join(', ') + skipSuffix;
    }
    if (recurrence.frequency === 'Monthly') {
      const day = recurrence.dayOfMonth ?? 1;
      const suffix = day === 1 || day === 21 || day === 31 ? 'st'
        : day === 2 || day === 22 ? 'nd'
        : day === 3 || day === 23 ? 'rd' : 'th';
      return `Monthly on the ${day}${suffix}${skipSuffix}`;
    }
    if (recurrence.frequency === 'Yearly') {
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      return `Every ${months[(recurrence.monthOfYear ?? 1) - 1] || ''} ${recurrence.dayOfMonth ?? 1}${skipSuffix}`;
    }
    const n = recurrence.intervalDays ?? 1;
    return (n === 1 ? 'Every day' : `Every ${n} days`) + skipSuffix;
  };

  /** Bounded range summary, e.g. "until 2026-09-01". Empty when unbounded. */
  const describeBounds = (recurrence) => {
    if (!recurrence) return '';
    const { startDate, endDate } = recurrence;
    if (startDate && endDate) return `${startDate} → ${endDate}`;
    if (endDate) return `until ${endDate}`;
    if (startDate) return `from ${startDate}`;
    return '';
  };

  // Load recurring tasks directly from the recurring tasks service
  useEffect(() => {
    const initData = async () => {
      if (user?.id) {
        setLoading(true);
        const data = await fetchRecurringTasks(user.id);
        setTasks(data);
        setLoading(false);
      }
    };
    initData();
  }, [user]);

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const q = searchQuery.toLowerCase();
      return (
        t.description?.toLowerCase().includes(q) ||
        t.category?.toLowerCase().includes(q) ||
        t.duration?.toLowerCase().includes(q) ||
        (t.remarks && t.remarks.toLowerCase().includes(q)) ||
        (t.priority && t.priority.toLowerCase().includes(q))
      );
    });
  }, [tasks, searchQuery]);

  const sortedTasks = useMemo(() => [...filteredTasks].reverse(), [filteredTasks]);

  const totalPages = Math.ceil(sortedTasks.length / itemsPerPage);
  const paginatedTasks = sortedTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAdd = () => {
    setEditingId(null);
    setFormData({
      description: '',
      duration: 'Morning',
      category: customCategories[0] || 'Work',
      priority: '',
      remarks: '',
      isActive: true,
      frequency: 'Daily',
      daysOfWeek: [],
      dayOfMonth: 1,
      monthOfYear: 1,
      intervalDays: 2,
      startDate: '',
      endDate: '',
      skipDaysOfWeek: []
    });
    setCustomCategoryText('');
    setShowModal(true);
  };

  const handleEdit = (task) => {
    setEditingId(task.id);
    const isCustomCat = !customCategories.includes(task.category);
    setFormData({
      description: task.description || '',
      duration: task.duration || 'Morning',
      category: isCustomCat ? 'custom' : (task.category || 'Work'),
      priority: task.priority || '',
      remarks: task.remarks || '',
      isActive: task.isActive !== undefined ? task.isActive : true,
      frequency: task.recurrence?.frequency || 'Daily',
      daysOfWeek: task.recurrence?.daysOfWeek || [],
      dayOfMonth: task.recurrence?.dayOfMonth ?? 1,
      monthOfYear: task.recurrence?.monthOfYear ?? 1,
      intervalDays: task.recurrence?.intervalDays ?? 2,
      startDate: task.recurrence?.startDate ?? '',
      endDate: task.recurrence?.endDate ?? '',
      skipDaysOfWeek: task.recurrence?.skipDaysOfWeek ?? []
    });
    setCustomCategoryText(isCustomCat ? task.category : '');
    setShowModal(true);
  };

  const showAlert = (type, title, message, onConfirm = () => { }) => {
    setAlertConfig({ isOpen: true, type, title, message, onConfirm });
  };

  const handleDelete = (id) => {
    showAlert('confirm', 'Delete Task?', 'Are you sure you want to delete this task?', async () => {
      const toastId = toast.loading('Deleting task...');
      const success = await deleteRecurringTask(id);
      if (success) {
        setTasks(prev => prev.filter(t => t.id !== id));
        toast.success('Task has been successfully removed.', { id: toastId });
      } else {
        toast.error('Failed to delete task from Supabase.', { id: toastId });
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    let finalCategory = formData.category;
    if (formData.category === 'custom') {
      const cleanCat = customCategoryText.trim();
      if (!cleanCat) {
        showAlert('error', 'Validation Error', 'Please enter a category name.');
        return;
      }
      finalCategory = cleanCat;

      // Add to dropdown list if it's not already there
      if (!customCategories.includes(cleanCat)) {
        const updatedCats = [...customCategories, cleanCat];
        await updateCustomCategories(updatedCats);
      }
    }

    // Each frequency needs its own parameter. The DB enforces this too
    // (recurring_tasks_schedule_check), but failing here gives a real message
    // instead of a constraint violation.
    if (formData.frequency === 'Weekly' && formData.daysOfWeek.length === 0) {
      toast.error('Pick at least one day of the week.');
      return;
    }
    if (formData.frequency === 'Monthly' && (formData.dayOfMonth < 1 || formData.dayOfMonth > 31)) {
      toast.error('Day of month must be between 1 and 31.');
      return;
    }
    if (formData.frequency === 'Custom' && (formData.intervalDays < 1 || formData.intervalDays > 365)) {
      toast.error('Interval must be between 1 and 365 days.');
      return;
    }
    if (formData.frequency === 'Yearly' && (formData.monthOfYear < 1 || formData.monthOfYear > 12)) {
      toast.error('Pick a month for the yearly repeat.');
      return;
    }
    // Mirrors recurring_tasks_date_range_check.
    if (formData.startDate && formData.endDate && formData.endDate < formData.startDate) {
      toast.error('End date must be on or after the start date.');
      return;
    }

    const payload = {
      description: formData.description,
      duration: formData.duration,
      category: finalCategory,
      priority: formData.priority,
      isRecurring: true,
      remarks: formData.remarks || '',
      isActive: formData.isActive !== undefined ? formData.isActive : true,
      recurrence: {
        frequency: formData.frequency,
        daysOfWeek: formData.daysOfWeek,
        dayOfMonth: formData.dayOfMonth,
        monthOfYear: formData.monthOfYear,
        intervalDays: formData.intervalDays,
        startDate: formData.startDate || null,
        endDate: formData.endDate || null,
        skipDaysOfWeek: formData.skipDaysOfWeek
      }
    };

    if (!user?.id) return;

    setModalLoading(true);
    if (editingId) {
      const updatedTask = await updateRecurringTask(editingId, payload);
      if (updatedTask) {
        setTasks(prev => prev.map(t => t.id === editingId ? updatedTask : t));
        showAlert('success', 'Updated!', 'Task has been modified successfully.');
        setShowModal(false);
      } else {
        showAlert('error', 'Database Error', 'Failed to update task in Supabase.');
      }
    } else {
      const createdTasks = await addRecurringTasks(user.id, [payload]);
      if (createdTasks && createdTasks.length > 0) {
        setTasks(prev => [...prev, ...createdTasks]);
        showAlert('success', 'Created!', 'New task has been added successfully.');
        setShowModal(false);
      } else {
        showAlert('error', 'Database Error', 'Failed to add task to Supabase.');
      }
    }
    setModalLoading(false);
  };

  const renderRow = (item) => (
    <tr key={item.id} className="hover:bg-gray-50 transition-colors text-center text-sm border-b border-gray-100">
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleEdit(item)} className="p-2 bg-indigo-50 text-indigo-605 rounded-lg" title="Edit">
            <Edit size={14} />
          </button>
          <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-50 text-red-500 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-900 font-bold text-left text-xs md:text-sm max-w-[250px] truncate" title={item.description}>
        <div className="flex items-center gap-2">
          {item.priority === 'Frog' && (
            <FrogLogo className="w-5 h-5 flex-shrink-0 select-none" title="Frog Task" />
          )}
          <span>{item.description}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-755 whitespace-nowrap text-xs md:text-sm font-bold">
        {item.duration}
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap text-center">
        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded text-[11px] font-bold">
          {describeSchedule(item.recurrence)}
        </span>
        {describeBounds(item.recurrence) && (
          <div className="mt-1 text-[10px] font-semibold text-gray-500">{describeBounds(item.recurrence)}</div>
        )}
      </td>
      <td className="px-4 py-3.5 text-gray-755 whitespace-nowrap text-xs md:text-sm text-center">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-605 border border-indigo-100 rounded text-[11px] font-bold uppercase">
          <CategoryIcon category={item.category} size={12} /> {item.category}
        </span>
      </td>
      <td className="px-4 py-3.5 text-gray-700 text-left text-xs md:text-sm max-w-[200px] truncate" title={item.remarks}>
        {item.remarks || <span className="text-gray-400 italic font-normal">No remarks</span>}
      </td>
      <td className="px-4 py-3.5 text-center whitespace-nowrap">
        {item.isActive ? (
          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Active
          </span>
        ) : (
          <span className="px-2.5 py-0.5 bg-gray-100 text-gray-550 border border-gray-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
            Paused
          </span>
        )}
      </td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3.5 text-left animate-in fade-in duration-100">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2.5">
        <div className="flex gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
            <CategoryIcon category={item.category} size={11} /> {item.category}
          </span>
          <span className="text-[10px] font-bold text-gray-550 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-wider">{item.duration}</span>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">{describeSchedule(item.recurrence)}</span>
          {describeBounds(item.recurrence) && (
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">{describeBounds(item.recurrence)}</span>
          )}
          {item.isActive ? (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">Active</span>
          ) : (
            <span className="text-[10px] font-bold text-gray-555 bg-gray-100 px-2 py-0.5 rounded border border-gray-250 uppercase tracking-wider">Paused</span>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleEdit(item)} className="p-1.5 bg-indigo-50 text-indigo-606 rounded-lg" title="Edit">
            <Edit size={14} />
          </button>
          <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-50 text-red-550 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="text-sm md:text-base font-bold text-gray-800 leading-tight flex items-start gap-1.5">
        {item.priority === 'Frog' && <FrogLogo className="w-5 h-5 flex-shrink-0 select-none" />}
        <span>{item.description}</span>
      </p>
      {item.remarks && (
        <p className="text-xs text-gray-500 bg-gray-55/60 p-2 rounded border border-gray-100 leading-relaxed font-normal">
          <strong className="text-[9px] uppercase text-gray-400 block tracking-wider mb-0.5">Remarks</strong>
          {item.remarks}
        </p>
      )}
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <FrogLogo className="w-16 h-16 animate-bounce" />
        <div className="text-gray-500 font-bold tracking-wide animate-pulse">Loading Recurring Tasks from Supabase...</div>
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-2 md:p-6 space-y-2 md:space-y-6 flex flex-col h-full min-h-0">
      {/* Header with Filters */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-2 lg:gap-4 w-full">
        <div className="flex flex-col lg:flex-row w-full gap-2 lg:gap-3 items-center">

          {/* Top Row for Mobile: Filter + Add */}
          <div className="flex items-center gap-2 w-full lg:w-auto">

            {/* Mobile Filter Button */}
            <button
              onClick={() => setShowMobileFilters(!showMobileFilters)}
              className={`lg:hidden flex items-center justify-center rounded-lg shadow-sm h-[32px] w-[32px] flex-shrink-0 transition ${showMobileFilters ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-55'}`}
            >
              <Filter size={14} />
            </button>

            {/* Mobile Add Button */}
            <button
              onClick={handleAdd}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center lg:hidden h-[32px] w-[32px] flex-shrink-0 shadow-sm transition active:scale-95"
            >
              <Plus size={16} />
            </button>
          </div>

          {/* Search Bar (Toggleable on mobile) */}
          <div className={`${showMobileFilters ? 'block' : 'hidden'} lg:block w-full lg:flex-[1.5] relative animate-in slide-in-from-top-2 duration-200`}>
            <Search className="absolute left-2.5 top-[9px] lg:top-[11px] text-gray-400" size={14} />
            <input
              type="text"
              placeholder="Search Tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg lg:rounded pl-8 pr-2 py-1.5 focus:outline-none focus:border-sky-500 text-base md:text-sm h-[32px] md:h-[38px] shadow-sm"
            />
          </div>
        </div>

        {/* Desktop Add Button */}
        <button
          onClick={handleAdd}
          className="hidden lg:flex bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 h-[38px] rounded-lg font-semibold items-center justify-center gap-2 transition shadow-sm w-full lg:w-auto flex-shrink-0 active:scale-95 mt-2 lg:mt-0"
        >
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col mt-2 flex-1 min-h-0 overflow-hidden">
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
          emptyTitle={searchQuery ? 'No matching recurring tasks' : 'No recurring tasks yet'}
          emptyDescription={searchQuery ? 'Try a different search term or clear the current filter.' : 'Create a template once, then let Frog Planner add it to the right days automatically.'}
          emptyAction={!searchQuery ? (
            <button type="button" onClick={handleAdd} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-2 text-[11px] font-semibold text-white hover:bg-emerald-800 transition-colors">
              <Plus size={13} /> Add recurring task
            </button>
          ) : null}
        />
      </div>

      <ModalAlert
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <ModalForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Task Template' : 'Add New Task Template'}
        onSubmit={handleSubmit}
        submitText={editingId ? 'Update' : 'Save'}
        loading={modalLoading}
      >
        <div className="space-y-4 text-left font-medium text-gray-800">

          <div className="space-y-1">
            <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Task Description *</label>
            <textarea
              required
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px]"
              placeholder="Enter task details..."
            />
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Remarks</label>
            <textarea
              rows={2}
              value={formData.remarks || ''}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px]"
              placeholder="Any additional templates instructions or notes..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Time select */}
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Time *</label>
              <select
                required
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
              >
                {durationOptions.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            {/* Category select */}
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Category *</label>
              <select
                required
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
              >
                {customCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="custom">+ Add Custom Category</option>
              </select>
            </div>
          </div>

          {/* ── Repeat schedule ── */}
          <div className="space-y-1">
            <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Repeats *</label>
            <select
              required
              value={formData.frequency}
              onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
              className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
            >
              {['Daily', 'Weekly', 'Monthly', 'Yearly', 'Custom'].map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {formData.frequency === 'Weekly' && (
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">On these days *</label>
              <div className="flex gap-1.5">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => {
                  const on = formData.daysOfWeek.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        daysOfWeek: on
                          ? formData.daysOfWeek.filter(d => d !== day)
                          : [...formData.daysOfWeek, day]
                      })}
                      className={`flex-1 h-[32px] rounded text-[11px] font-bold border transition ${
                        on
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {formData.frequency === 'Monthly' && (
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Day of month *</label>
              <select
                value={formData.dayOfMonth}
                onChange={(e) => setFormData({ ...formData, dayOfMonth: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <p className="text-[10px] text-gray-400">Days after a month&rsquo;s length fall on its last day.</p>
            </div>
          )}

          {formData.frequency === 'Yearly' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Month *</label>
                <select
                  value={formData.monthOfYear}
                  onChange={(e) => setFormData({ ...formData, monthOfYear: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
                >
                  {['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December']
                    .map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Day *</label>
                <select
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
                >
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {formData.frequency === 'Custom' && (
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Repeat every (days) *</label>
              <input
                type="number"
                min="1"
                max="365"
                value={formData.intervalDays}
                onChange={(e) => setFormData({ ...formData, intervalDays: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
                placeholder="e.g. 3"
              />
              <p className="text-[10px] text-gray-400">Counted from the start date below.</p>
            </div>
          )}

          {/* Skip specific weekdays — applies to any frequency EXCEPT Weekly,
              where the day picker above already says exactly which days fire;
              a second, overlapping "skip" control there would just invite
              contradictions (e.g. picked Sunday above, skipped it here). */}
          {formData.frequency !== 'Weekly' && (
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Skip these days (optional)</label>
              <div className="flex gap-1.5">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => {
                  const on = formData.skipDaysOfWeek.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => setFormData({
                        ...formData,
                        skipDaysOfWeek: on
                          ? formData.skipDaysOfWeek.filter(d => d !== day)
                          : [...formData.skipDaysOfWeek, day]
                      })}
                      className={`flex-1 h-[32px] rounded text-[11px] font-bold border transition ${
                        on
                          ? 'bg-rose-500 text-white border-rose-500'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-gray-400">e.g. a daily task that shouldn&rsquo;t generate on Sundays.</p>
            </div>
          )}

          {/* Optional date bounds — apply to every frequency, though they matter
              most for Custom, whose interval is counted from the start date.
              Leave blank to repeat indefinitely. */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Starts (optional)</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Ends (optional)</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px] bg-white font-medium"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Frog selector */}
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Frog Task?</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, priority: formData.priority === 'Frog' ? '' : 'Frog' })}
                className={`w-full border rounded px-2.5 py-1.5 text-[11px] md:text-[13px] h-[30px] md:h-[34px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${formData.priority === 'Frog'
                    ? 'bg-emerald-50 border-emerald-355 text-emerald-700'
                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                  }`}
              >
                {formData.priority === 'Frog' ? <><FrogLogo className="w-3.5 h-3.5 inline-block mr-1" />Frog!</> : <><FrogLogo className="w-3.5 h-3.5 inline-block mr-1" />Mark Frog</>}
              </button>
            </div>

            {/* Active selector */}
            <div className="space-y-1">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Template Status</label>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}
                className={`w-full border rounded px-2.5 py-1.5 text-[11px] md:text-[13px] h-[30px] md:h-[34px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${formData.isActive
                    ? 'bg-emerald-50 border-emerald-355 text-emerald-700'
                    : 'bg-gray-50 border-gray-300 text-gray-500 hover:bg-gray-100'
                  }`}
              >
                {formData.isActive ? <><CheckCircle2 size={14} /> Active</> : <><PauseCircle size={14} /> Paused</>}
              </button>
            </div>
          </div>

          {formData.category === 'custom' && (
            <div className="space-y-1 animate-in slide-in-from-top-2 duration-150">
              <label className="block text-[10px] md:text-[12px] text-gray-700 uppercase tracking-tight font-bold">Custom Category Name *</label>
              <input
                required
                type="text"
                value={customCategoryText}
                onChange={(e) => setCustomCategoryText(e.target.value)}
                placeholder="Enter new category name..."
                className="w-full border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[30px] md:h-[34px]"
              />
            </div>
          )}
        </div>
      </ModalForm>
    </div>
  );
}
