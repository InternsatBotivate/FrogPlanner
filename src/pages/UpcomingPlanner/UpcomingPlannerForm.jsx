import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import ModalForm from '../../components/ModalForm';

const STORAGE_KEY = 'upcoming_planner_tasks';

// NOTE: Legacy helper — only kept to support existing localStorage data cleanup.
// New tasks are saved directly to Supabase via onSaved callback, NOT to localStorage.
const getTasks = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch { return []; }
};


/**
 * UpcomingPlannerForm
 * Props:
 *  - isOpen: boolean
 *  - onClose: () => void
 *  - onSaved: (newTasks) => void  — callback after tasks are saved
 */
export default function UpcomingPlannerForm({ isOpen, onClose, onSaved }) {
  const [customCategories, setCustomCategories] = useState(() => {
    const saved = localStorage.getItem('index_custom_categories');
    return saved ? JSON.parse(saved) : ['Work', 'Meeting', 'Call', 'Personal', 'Review', 'Break', 'Health'];
  });

  const durationOptions = ['Morning', 'Afternoon', 'Evening', 'Night'];

  const [formData, setFormData] = useState({ date: '' });
  const [tasksList, setTasksList] = useState([
    { description: '', duration: 'Morning', category: 'Work', priority: '' }
  ]);
  const [error, setError] = useState('');

  const resetForm = () => {
    setFormData({ date: '' });
    setTasksList([{ description: '', duration: 'Morning', category: 'Work', priority: '' }]);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAddRow = () => {
    setTasksList(prev => [...prev, { description: '', duration: 'Morning', category: customCategories[0] || 'Work', priority: '' }]);
  };

  const handleFieldChange = (index, field, value) => {
    setTasksList(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleRemoveRow = (index) => {
    if (tasksList.length > 1) {
      setTasksList(prev => prev.filter((_, i) => i !== index));
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    const validRows = tasksList.filter(r => r.description.trim().length > 0);
    if (validRows.length === 0) {
      setError('Please enter at least one task description.');
      return;
    }
    const newTasks = validRows.map((row, idx) => ({
      id: `UPTSK-${Date.now()}-${idx}`,
      description: row.description.trim(),
      duration: row.duration,
      category: row.category,
      priority: row.priority,
      date: formData.date,
      status: 'Pending',
      selectValue: 'Select',
      timestamp: new Date().toISOString()
    }));
    // Do NOT persist to localStorage — tasks go directly to Supabase via onSaved callback.
    // This prevents new-user migration from picking up tasks created by other sessions.
    if (onSaved) onSaved(newTasks);
    resetForm();
    onClose();
  };

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Upcoming Task(s)"
      onSubmit={handleSubmit}
      submitText="Save Tasks"
    >
      <div className="space-y-4 text-left">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        {/* Date Field */}
        <div className="space-y-1">
          <label className="block text-[10px] md:text-[11px] text-gray-650 font-bold uppercase tracking-wider">
            Scheduled Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[11px] md:text-[13px] h-[34px] bg-white"
          />
        </div>

        {/* Task Rows */}
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
                    <button type="button" onClick={() => handleRemoveRow(idx)} className="text-red-500 hover:text-red-750 hover:bg-rose-50 p-1 rounded-md transition" title="Remove task row">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>

                {/* Description */}
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

                {/* Grid: Time, Category, Frog */}
                <div className="grid grid-cols-3 gap-2.5">
                  {/* Time */}
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

                  {/* Category */}
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

                  {/* Frog Toggle */}
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
  );
}
