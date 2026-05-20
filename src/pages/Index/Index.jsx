import React, { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Filter, Edit, Trash2 } from 'lucide-react';
import DataTable from '../../components/DataTable';
import ModalAlert from '../../components/ModalAlert';
import ModalForm from '../../components/ModalForm';
import { getCategoryEmoji } from '../../utils/helpers';
import { useAuthStore } from '../../store/authStore';
import { fetchPlannerData, addPlannerTasks, updateTask, deleteTask, migrateLegacyData } from '../../lib/plannerService';

export default function Index() {
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(100);
  const [searchQuery, setSearchQuery] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // Custom categories state
  const [customCategories, setCustomCategories] = useState(() => {
    const saved = localStorage.getItem('index_custom_categories');
    return saved ? JSON.parse(saved) : ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
  });

  const [customCategoryText, setCustomCategoryText] = useState('');

  const [alertConfig, setAlertConfig] = useState({ isOpen: false, type: 'success', title: '', message: '', onConfirm: () => { } });

  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];
  const priorityOptions = ['Low', 'Medium', 'High'];

  const [formData, setFormData] = useState({
    description: '',
    duration: 'Morning',
    category: 'Work',
    priority: ''
  });

  const headers = ['Action', 'Task Description', 'Time', 'Category'];

  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      if (user?.id) {
        setLoading(true);
        // Migrate legacy data
        await migrateLegacyData(user.id);
        // Fetch planner data
        const { tasks: dbTasks } = await fetchPlannerData(user.id);
        // Filter recurring template tasks (date IS NULL / !t.date)
        const recurringTasks = dbTasks.filter(t => !t.date);
        setTasks(recurringTasks);
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
      priority: ''
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
      priority: task.priority || ''
    });
    setCustomCategoryText(isCustomCat ? task.category : '');
    setShowModal(true);
  };

  const showAlert = (type, title, message, onConfirm = () => { }) => {
    setAlertConfig({ isOpen: true, type, title, message, onConfirm });
  };

  const handleDelete = (id) => {
    showAlert('confirm', 'Delete Task?', 'Are you sure you want to delete this task?', async () => {
      setLoading(true);
      const success = await deleteTask(id);
      if (success) {
        setTasks(prev => prev.filter(t => t.id !== id));
        showAlert('success', 'Deleted!', 'Task has been successfully removed.');
      } else {
        showAlert('error', 'Database Error', 'Failed to delete task from Supabase.');
      }
      setLoading(false);
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
        setCustomCategories(updatedCats);
        localStorage.setItem('index_custom_categories', JSON.stringify(updatedCats));
      }
    }

    const payload = {
      description: formData.description,
      duration: formData.duration,
      category: finalCategory,
      priority: formData.priority
    };

    if (!user?.id) return;

    setLoading(true);
    if (editingId) {
      const updatedTask = await updateTask(editingId, payload);
      if (updatedTask) {
        setTasks(prev => prev.map(t => t.id === editingId ? updatedTask : t));
        showAlert('success', 'Updated!', 'Task has been modified successfully.');
      } else {
        showAlert('error', 'Database Error', 'Failed to update task in Supabase.');
      }
    } else {
      const createdTasks = await addPlannerTasks(user.id, [{
        ...payload,
        date: null, // baseline template task
        selectValue: 'Select',
        remarks: ''
      }]);
      if (createdTasks && createdTasks.length > 0) {
        setTasks(prev => [...prev, ...createdTasks]);
        showAlert('success', 'Created!', 'New task has been added successfully.');
      } else {
        showAlert('error', 'Database Error', 'Failed to add task to Supabase.');
      }
    }
    setLoading(false);
    setShowModal(false);
  };

  const renderRow = (item) => (
    <tr key={item.id} className="hover:bg-gray-50 transition-colors text-center text-sm border-b border-gray-100">
      <td className="px-4 py-3.5 whitespace-nowrap">
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handleEdit(item)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg" title="Edit">
            <Edit size={14} />
          </button>
          <button onClick={() => handleDelete(item.id)} className="p-2 bg-red-50 text-red-500 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-900 font-bold text-left text-xs md:text-sm max-w-[300px] truncate" title={item.description}>
        <div className="flex items-center gap-2">
          {item.priority === 'Frog' && (
            <span className="text-base select-none flex-shrink-0" title="Frog Task">🐸</span>
          )}
          <span>{item.description}</span>
        </div>
      </td>
      <td className="px-4 py-3.5 text-gray-750 whitespace-nowrap text-xs md:text-sm font-bold">
        {item.duration}
      </td>
      <td className="px-4 py-3.5 text-gray-700 whitespace-nowrap text-xs md:text-sm text-center">
        <span className="px-2.5 py-1 bg-indigo-50 text-indigo-605 border border-indigo-100 rounded text-[11px] font-bold uppercase">
          {getCategoryEmoji(item.category)} {item.category}
        </span>
      </td>
    </tr>
  );

  const renderCard = (item) => (
    <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-3.5 text-left animate-in fade-in duration-100">
      <div className="flex justify-between items-start border-b border-gray-100 pb-2.5">
        <div className="flex gap-2 flex-wrap">
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 uppercase tracking-wider">
            {getCategoryEmoji(item.category)} {item.category}
          </span>
          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase tracking-wider">{item.duration}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleEdit(item)} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg" title="Edit">
            <Edit size={14} />
          </button>
          <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg" title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <p className="text-sm md:text-base font-bold text-gray-800 leading-tight flex items-start gap-1.5">
        {item.priority === 'Frog' && <span className="text-base select-none flex-shrink-0">🐸</span>}
        <span>{item.description}</span>
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
        <div className="text-5xl animate-bounce">🐸</div>
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
              className={`lg:hidden flex items-center justify-center rounded-lg shadow-sm h-[32px] w-[32px] flex-shrink-0 transition ${showMobileFilters ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col pt-1 mt-2 flex-1 min-h-0 overflow-hidden">
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

      <ModalAlert
        {...alertConfig}
        onClose={() => setAlertConfig({ ...alertConfig, isOpen: false })}
      />

      <ModalForm
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Edit Task' : 'Add New Task'}
        onSubmit={handleSubmit}
        submitText={editingId ? 'Update' : 'Save'}
      >
        <div className="space-y-4 text-left">

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

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

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
                {formData.priority === 'Frog' ? '🐸 Frog!' : '🐸 Mark Frog'}
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
