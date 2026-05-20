import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Plus, Search, Trash2, Pencil, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import {
  fetchUpcomingTasks,
  createUpcomingTasks,
  updateUpcomingTaskField,
  updateUpcomingTask,
  deleteUpcomingTask,
  migrateUpcomingTasksLegacyData
} from '../../lib/upcomingPlannerService';
import DataTable from '../../components/DataTable';
import ModalForm from '../../components/ModalForm';
import ModalAlert from '../../components/ModalAlert';
import { getCategoryEmoji } from '../../utils/helpers';

const STORAGE_KEY = 'upcoming_planner_tasks';

const DUMMY_TASKS = [
  { id: 'UPTSK-DEMO-1',  description: 'Prepare Q3 strategy presentation slides', duration: 'Morning',   category: 'Work',     priority: 'Frog', date: '2026-05-22', status: 'Pending',   selectValue: 'Pending', remarks: '',                      timestamp: '' },
  { id: 'UPTSK-DEMO-2',  description: 'Team standup & sprint planning meeting',   duration: 'Morning',   category: 'Meeting',  priority: '',     date: '2026-05-22', status: 'Pending',   selectValue: 'Pending', remarks: 'Zoom link sent',        timestamp: '' },
  { id: 'UPTSK-DEMO-3',  description: 'Review client proposal and send feedback', duration: 'Afternoon', category: 'Review',   priority: '',     date: '2026-05-22', status: 'Pending',   selectValue: 'Pending', remarks: '',                      timestamp: '' },
  { id: 'UPTSK-DEMO-4',  description: 'Follow-up call with Rajesh – partnership', duration: 'Afternoon', category: 'Call',     priority: 'Frog', date: '2026-05-23', status: 'Pending',   selectValue: 'Pending', remarks: 'Confirm availability',  timestamp: '' },
  { id: 'UPTSK-DEMO-5',  description: 'Submit monthly expense report to finance',  duration: 'Morning',   category: 'Work',     priority: '',     date: '2026-05-23', status: 'Pending',   selectValue: 'Pending', remarks: '',                      timestamp: '' },
  { id: 'UPTSK-DEMO-6',  description: 'Gym session – upper body strength training',duration: 'Evening',   category: 'Health',   priority: '',     date: '2026-05-23', status: 'Pending',   selectValue: 'Pending', remarks: '',                      timestamp: '' },
  { id: 'UPTSK-DEMO-7',  description: 'Onboarding session for new joinee Priya',   duration: 'Morning',   category: 'Meeting',  priority: '',     date: '2026-05-26', status: 'Pending',   selectValue: 'Pending', remarks: 'Prepare welcome kit',   timestamp: '' },
  { id: 'UPTSK-DEMO-8',  description: 'Finalise and publish blog post on AI tools', duration: 'Afternoon', category: 'Work',     priority: '',     date: '2026-05-26', status: 'Pending',   selectValue: 'Pending', remarks: '',                      timestamp: '' },
  { id: 'UPTSK-DEMO-9',  description: 'Annual health check-up appointment',         duration: 'Morning',   category: 'Health',   priority: 'Frog', date: '2026-05-27', status: 'Pending',   selectValue: 'Pending', remarks: 'Carry previous reports', timestamp: '' },
  { id: 'UPTSK-DEMO-10', description: 'Investor deck review with co-founders',      duration: 'Evening',   category: 'Meeting',  priority: 'Frog', date: '2026-05-28', status: 'Pending',   selectValue: 'Pending', remarks: '',                      timestamp: '' },
  { id: 'UPTSK-DEMO-11', description: 'Code review – payment gateway integration',  duration: 'Afternoon', category: 'Work',     priority: '',     date: '2026-05-29', status: 'Completed', selectValue: 'Done',    remarks: 'Approved & merged',     timestamp: '' },
  { id: 'UPTSK-DEMO-12', description: 'Personal – read 30 pages of Deep Work',      duration: 'Night',     category: 'Personal', priority: '',     date: '2026-05-30', status: 'Pending',   selectValue: 'Pending', remarks: '',                      timestamp: '' },
];

const getTasks = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
    // First visit – seed dummy data
    saveTasks(DUMMY_TASKS);
    return DUMMY_TASKS;
  } catch { return DUMMY_TASKS; }
};

const saveTasks = (tasks) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
};

export default function UpcomingPlanner() {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeFilter, setActiveFilter] = useState('Total');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDuration, setFilterDuration] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: () => {} });

  const [customCategories, setCustomCategories] = useState(() => {
    const saved = localStorage.getItem('index_custom_categories');
    return saved ? JSON.parse(saved) : ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
  });

  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];

  const [formData, setFormData] = useState({ date: '' });
  const [tasksList, setTasksList] = useState([
    { description: '', duration: 'Morning', category: 'Work', priority: '' }
  ]);

  // Load and Migrate tasks from legacy localStorage
  useEffect(() => {
    const initUpcomingPlanner = async () => {
      if (!user?.id) return;
      setLoading(true);
      try {
        await migrateUpcomingTasksLegacyData(user.id);
        const dbTasks = await fetchUpcomingTasks(user.id);
        setTasks(dbTasks);
      } catch (error) {
        console.error('[Supabase Upcoming] Failed to load planner data:', error);
        toast.error('Failed to load upcoming tasks.');
      } finally {
        setLoading(false);
      }
    };
    initUpcomingPlanner();
  }, [user?.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterDuration, filterCategory, filterFromDate, filterToDate, activeFilter]);

  const showAlert = (type, title, message) => {
    setAlertConfig({ isOpen: true, type, title, message, onConfirm: () => {} });
  };

  const handleUpdateTaskField = async (taskId, field, value) => {
    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updated = { ...t, [field]: value };
          if (field === 'status') {
            updated.selectValue = value === 'Completed' ? 'Done' : 'Pending';
          }
          return updated;
        }
        return t;
      })
    );

    const success = await updateUpcomingTaskField(taskId, field, value);
    if (!success) {
      toast.error('Failed to update task.');
      // Restore from database
      const dbTasks = await fetchUpcomingTasks(user.id);
      setTasks(dbTasks);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      // Optimistic UI update
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      const success = await deleteUpcomingTask(taskId);
      if (success) {
        toast.success('Task deleted successfully.');
      } else {
        toast.error('Failed to delete task.');
        // Restore from database
        const dbTasks = await fetchUpcomingTasks(user.id);
        setTasks(dbTasks);
      }
    }
  };

  const handleEditTask = (item) => {
    setEditingTask(item);
    setFormData({ date: item.date || '' });
    setTasksList([{ description: item.description, duration: item.duration, category: item.category, priority: item.priority || '' }]);
    setShowModal(true);
  };

  const filteredTasks = useMemo(() => {
    let result = tasks.map(t => ({
      ...t,
      time: t.duration,
      status: t.status || 'Pending'
    }));

    if (activeFilter === 'Active') result = result.filter(t => t.status !== 'Completed');
    else if (activeFilter === 'Completed') result = result.filter(t => t.status === 'Completed');
    else if (activeFilter === 'Pending') result = result.filter(t => t.status === 'Pending');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.description.toLowerCase().includes(q));
    }
    if (filterDuration) result = result.filter(t => t.duration === filterDuration);
    if (filterCategory) result = result.filter(t => t.category === filterCategory);
    if (filterFromDate) result = result.filter(t => t.date && t.date >= filterFromDate);
    if (filterToDate)   result = result.filter(t => t.date && t.date <= filterToDate);

    return result;
  }, [tasks, activeFilter, searchQuery, filterDuration, filterCategory, filterFromDate, filterToDate]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'Completed').length;
    const pending = tasks.filter(t => t.status === 'Pending' || !t.status).length;
    const active = total - completed;
    return { total, completed, pending, active };
  }, [tasks]);

  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const paginatedTasks = filteredTasks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const headers = ['Action', 'Date', 'Time', 'Task Description', 'Category'];

  // --- Form handlers ---
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
    const updated = customCategories.includes(text) ? customCategories : [...customCategories, text];
    if (!customCategories.includes(text)) {
      localStorage.setItem('index_custom_categories', JSON.stringify(updated));
      setCustomCategories(updated);
    }
    handleFieldChange(idx, 'category', text);
    handleFieldChange(idx, 'isCreatingCategory', false);
    handleFieldChange(idx, 'newCategoryText', '');
  };

  const handleCategorySelectChange = (idx, value) => {
    if (value === '__NEW__') handleFieldChange(idx, 'isCreatingCategory', true);
    else handleFieldChange(idx, 'category', value);
  };

  const handleAddTaskClick = () => {
    setEditingTask(null);
    setFormData({ date: '' });
    setTasksList([{ description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }]);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validRows = tasksList.filter(r => r.description.trim().length > 0);
    if (validRows.length === 0) {
      showAlert('error', 'Validation Error', 'Please enter at least one task description.');
      return;
    }

    if (editingTask) {
      // Edit mode – update single task
      const row = validRows[0];
      const payload = {
        description: row.description.trim(),
        duration: row.duration,
        category: row.category,
        priority: row.priority,
        date: formData.date
      };

      const updatedTask = await updateUpcomingTask(editingTask.id, payload);
      if (updatedTask) {
        setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));
        toast.success('Task updated successfully.');
      } else {
        toast.error('Failed to update task.');
      }
    } else {
      // Create mode – batch create tasks
      const newTasksPayload = validRows.map(row => ({
        description: row.description.trim(),
        duration: row.duration,
        category: row.category,
        priority: row.priority || '',
        date: formData.date,
        status: 'Pending'
      }));

      const createdTasks = await createUpcomingTasks(user.id, newTasksPayload);
      if (createdTasks && createdTasks.length > 0) {
        setTasks(prev => [...prev, ...createdTasks]);
        toast.success(`${createdTasks.length} upcoming task(s) added successfully.`);
      } else {
        toast.error('Failed to add tasks.');
      }
    }

    setEditingTask(null);
    setShowModal(false);
  };

  const handleSaveAll = () => {
    toast.success('All changes are fully synchronized in real-time!');
  };

  const renderRow = (item) => (
    <tr key={item.id} className="hover:bg-gray-50 transition-colors text-center text-sm border-b border-gray-100">
      {/* Action */}
      <td className="px-2 py-2 w-[100px] whitespace-nowrap">
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => handleUpdateTaskField(item.id, 'status', item.status === 'Completed' ? 'Pending' : 'Completed')}
            className={`p-1 rounded transition ${
              item.status === 'Completed'
                ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'
                : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'
            }`}
            title={item.status === 'Completed' ? 'Mark as Pending' : 'Mark as Completed'}
          >
            {item.status === 'Completed' ? <CheckSquare size={13} /> : <Square size={13} />}
          </button>
          <button
            onClick={() => handleEditTask(item)}
            className="text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded transition"
            title="Edit task"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => handleDeleteTask(item.id)}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition"
            title="Delete task"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
      {/* Date */}
      <td className="px-2 py-2 w-[120px] text-gray-700 font-semibold whitespace-nowrap text-xs">
        {item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
      </td>
      {/* Time */}
      <td className="px-2 py-2 w-[110px] text-gray-900 font-bold whitespace-nowrap text-xs md:text-sm">
        <div className="flex items-center justify-center gap-1.5">
          <Clock size={14} className="text-gray-400" /> {item.time}
        </div>
      </td>
      {/* Task Description */}
      <td className={`px-4 py-2 text-xs md:text-sm text-center font-medium ${item.status === 'Completed' ? 'text-gray-400 line-through opacity-70' : 'text-gray-800'}`}>
        <div className="flex items-center justify-center gap-2">
          {item.priority === 'Frog' && <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>}
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
            <span
              onClick={() => handleUpdateTaskField(item.id, 'status', item.status === 'Completed' ? 'Pending' : 'Completed')}
              className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-widest cursor-pointer hover:opacity-85 transition-all select-none ${
                item.status === 'Completed'
                  ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                  : 'bg-amber-50 border-amber-100 text-amber-600'
              }`}
              title="Click to toggle status"
            >
              {item.status}
            </span>
          </div>
          <h3 className={`text-sm md:text-base font-bold leading-tight text-left flex items-start gap-1.5 ${item.status === 'Completed' ? 'text-gray-400 line-through opacity-70' : 'text-gray-800'}`}>
            {item.priority === 'Frog' && <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>}
            <span>{item.description}</span>
          </h3>
        </div>
        <div className="flex ml-2 items-center gap-1.5">
          <button onClick={() => handleEditTask(item)} className="text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 p-1 rounded transition" title="Edit task">
            <Pencil size={14} />
          </button>
          <button onClick={() => handleDeleteTask(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition" title="Delete task">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="pt-1 flex items-center justify-between text-gray-500">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          <Clock size={13} />
          <span>{item.time}</span>
        </div>
        <span className="text-[10px] text-gray-400 font-semibold">
          {item.date ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
        </span>
      </div>

    </div>
  );

  if (loading) {
    return (
      <div className="p-0 sm:p-2 md:p-4 space-y-2 md:space-y-3 flex flex-col h-full min-h-0">
        <div className="flex-1 flex flex-col items-center justify-center py-16 bg-gray-50/50 rounded-2xl border border-gray-100">
          <span className="text-4xl animate-bounce select-none block mb-3">🐸</span>
          <p className="text-sm font-semibold text-gray-400">Loading upcoming planner...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-2 md:p-4 space-y-2 md:space-y-3 flex flex-col h-full min-h-0">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {[
          { key: 'Total', val: stats.total, active: 'bg-slate-700 border-slate-800 text-white', inactive: 'bg-slate-50 border-slate-100 text-slate-700' },
          { key: 'Active', val: stats.active, active: 'bg-blue-600 border-blue-700 text-white', inactive: 'bg-blue-50/70 border-blue-100 text-blue-700' },
          { key: 'Completed', val: stats.completed, active: 'bg-emerald-600 border-emerald-700 text-white', inactive: 'bg-emerald-50/70 border-emerald-100 text-emerald-700' },
          { key: 'Pending', val: stats.pending, active: 'bg-amber-600 border-amber-700 text-white', inactive: 'bg-amber-50/70 border-amber-100 text-amber-700' },
        ].map(({ key, val, active, inactive }) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key)}
            className={`py-2 px-3 rounded-xl border text-center transition-all flex flex-col justify-center items-center h-[54px] shadow-sm font-bold hover:opacity-90 ${activeFilter === key ? active : inactive}`}
          >
            <span className="text-sm md:text-base leading-none">{val}</span>
            <span className="text-[9px] uppercase tracking-wider mt-0.5 opacity-80">{key}</span>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-gray-100 flex flex-wrap lg:flex-nowrap items-center justify-between gap-3 bg-white">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1 justify-center lg:justify-start">
            {/* Search */}
            <div className="relative w-40">
              <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full pl-8 pr-2.5 py-1 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
              />
            </div>

            {/* From – To Date (single inline group) */}
            <div className="flex items-center h-[28px] border border-gray-300 rounded-lg overflow-hidden bg-white divide-x divide-gray-300">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-2 whitespace-nowrap bg-gray-50">From</span>
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="text-xs px-2 h-full bg-white text-gray-700 font-semibold focus:outline-none"
              />
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide px-2 whitespace-nowrap bg-gray-50">To</span>
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="text-xs px-2 h-full bg-white text-gray-700 font-semibold focus:outline-none"
              />
            </div>

            {/* Time */}
            <select
              value={filterDuration}
              onChange={(e) => setFilterDuration(e.target.value)}
              className="border border-gray-300 rounded-lg text-xs px-2 py-0.5 bg-white text-gray-750 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
            >
              <option value="">All Times</option>
              {durationOptions.map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            {/* Category */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-gray-300 rounded-lg text-xs px-2 py-0.5 bg-white text-gray-750 font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 h-[28px]"
            >
              <option value="">All Categories</option>
              {customCategories.map(o => <option key={o} value={o}>{o}</option>)}
            </select>

            {/* Clear */}
            {(searchQuery || filterDuration || filterCategory || filterFromDate || filterToDate) && (
              <button
                onClick={() => { setSearchQuery(''); setFilterDuration(''); setFilterCategory(''); setFilterFromDate(''); setFilterToDate(''); }}
                className="text-[10px] text-red-500 hover:text-red-700 font-bold hover:underline"
              >Clear</button>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleSaveAll} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center px-3.5 py-1 text-xs font-bold shadow-sm transition active:scale-95 h-[28px]">Save</button>
            <button onClick={handleAddTaskClick} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center px-3.5 py-1 text-xs font-semibold shadow-sm transition active:scale-95 h-[28px]">Add Task</button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col min-h-0 pt-1">
          <DataTable
            headers={headers}
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
      </div>

      {/* Modal Form */}
      <ModalForm
        isOpen={showModal}
        onClose={() => { setShowModal(false); setEditingTask(null); }}
        title={editingTask ? 'Edit Task' : 'Add Upcoming Task(s)'}
        onSubmit={handleSubmit}
        submitText={editingTask ? 'Update Task' : 'Save Tasks'}
      >
        <div className="space-y-4 text-left">
          <div className="space-y-1">
            <label className="block text-[10px] md:text-[11px] text-gray-650 font-bold uppercase tracking-wider">Scheduled Date</label>
            <input
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px] bg-white"
            />
          </div>

          <div className="space-y-3.5 border-t border-gray-150 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Task Item Rows</h4>
                <p className="text-[9px] text-gray-405">Configure duration, category, priority, and description for each task item</p>
              </div>
              <button type="button" onClick={handleAddRow} className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-lg border border-indigo-200 transition active:scale-95 flex items-center gap-1 shadow-sm">
                <Plus size={12} /> Add Task Row
              </button>
            </div>

            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {tasksList.map((row, idx) => (
                <div key={idx} className="bg-gray-50/70 p-3.5 rounded-xl border border-gray-200 relative space-y-2.5 text-left">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-1.5">
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">Task Item #{idx + 1}</span>
                    {tasksList.length > 1 && (
                      <button type="button" onClick={() => handleRemoveRow(idx)} className="text-red-500 hover:text-red-750 hover:bg-rose-50 p-1 rounded-md transition" title="Remove task row">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>

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

                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Time *</label>
                      <select
                        required
                        value={row.duration}
                        onChange={(e) => handleFieldChange(idx, 'duration', e.target.value)}
                        className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] md:text-[12px] h-[32px] bg-white font-medium"
                      >
                        {durationOptions.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>

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
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddCategoryInline(idx); } }}
                          />
                          <button type="button" onClick={() => handleAddCategoryInline(idx)} className="h-[32px] w-[30px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded text-[11px] font-bold shrink-0">✓</button>
                          <button type="button" onClick={() => handleFieldChange(idx, 'isCreatingCategory', false)} className="h-[32px] w-[30px] flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-600 rounded text-[11px] shrink-0">✕</button>
                        </div>
                      ) : (
                        <select
                          required
                          value={row.category}
                          onChange={(e) => handleCategorySelectChange(idx, e.target.value)}
                          className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] md:text-[12px] h-[32px] bg-white font-medium"
                        >
                          {customCategories.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="__NEW__">+ New Category...</option>
                        </select>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide">Frog Task?</label>
                      <button
                        type="button"
                        onClick={() => handleFieldChange(idx, 'priority', row.priority === 'Frog' ? '' : 'Frog')}
                        className={`w-full border rounded text-[10px] md:text-[11px] h-[32px] font-bold transition-all flex items-center justify-center gap-1 shadow-sm ${row.priority === 'Frog' ? 'bg-emerald-50 border-emerald-355 text-emerald-700 font-extrabold' : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'}`}
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
    </div>
  );
}
