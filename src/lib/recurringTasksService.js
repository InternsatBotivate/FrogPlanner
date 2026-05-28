/**
 * recurringTasksService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Service layer for managing Recurring Tasks in Supabase.
 * Handles CRUD operations for the 'recurring_tasks' table and maps database
 * fields to front-end compatible formats.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabaseClient';

/**
 * fetchRecurringTasks
 * Loads all active/inactive recurring task templates for the logged-in user.
 */
export const fetchRecurringTasks = async (userId) => {
  try {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('recurring_tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      description: r.description,
      duration: r.time_slot, // Map time_slot to duration
      category: r.category,
      priority: r.priority,
      date: null, // Baseline template task has no specific date
      selectValue: 'Select',
      remarks: r.remarks || '',
      isRecurring: true,
      isActive: r.is_active,
      timestamp: r.created_at
    }));
  } catch (error) {
    console.error('[Supabase RecurringTasks] Fetch Error:', error);
    return [];
  }
};

/**
 * addRecurringTasks
 * Batch inserts new recurring task templates.
 */
export const addRecurringTasks = async (userId, newTasksArray) => {
  try {
    if (!userId || newTasksArray.length === 0) return [];

    const dbRows = newTasksArray.map(t => ({
      user_id: userId,
      description: t.description,
      category: t.category,
      priority: t.priority || '',
      remarks: t.remarks || '',
      time_slot: t.duration || 'Morning', // Map duration to time_slot
      is_active: t.isActive !== undefined ? t.isActive : true
    }));

    const { data, error } = await supabase
      .from('recurring_tasks')
      .insert(dbRows)
      .select();

    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      description: r.description,
      duration: r.time_slot, // Map time_slot to duration
      category: r.category,
      priority: r.priority,
      date: null,
      selectValue: 'Select',
      remarks: r.remarks || '',
      isRecurring: true,
      isActive: r.is_active,
      timestamp: r.created_at
    }));
  } catch (error) {
    console.error('[Supabase RecurringTasks] Add Error:', error);
    return [];
  }
};

/**
 * updateRecurringTask
 * Updates a recurring task template's fields.
 */
export const updateRecurringTask = async (taskId, taskPayload) => {
  try {
    const { data, error } = await supabase
      .from('recurring_tasks')
      .update({
        description: taskPayload.description,
        category: taskPayload.category,
        priority: taskPayload.priority || '',
        remarks: taskPayload.remarks || '',
        time_slot: taskPayload.duration || 'Morning',
        is_active: taskPayload.isActive !== undefined ? taskPayload.isActive : true
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      description: data.description,
      duration: data.time_slot,
      category: data.category,
      priority: data.priority,
      date: null,
      selectValue: 'Select',
      remarks: data.remarks || '',
      isRecurring: true,
      isActive: data.is_active,
      timestamp: data.created_at
    };
  } catch (error) {
    console.error('[Supabase RecurringTasks] Update Error:', error);
    return null;
  }
};

/**
 * updateRecurringTaskField
 * Updates a single column for a recurring task.
 */
export const updateRecurringTaskField = async (taskId, field, value) => {
  try {
    const dbField = field === 'duration' ? 'time_slot' : field;
    const { error } = await supabase
      .from('recurring_tasks')
      .update({ [dbField]: value })
      .eq('id', taskId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Supabase RecurringTasks] Update Field Error:', error);
    return false;
  }
};

/**
 * deleteRecurringTask
 * Deletes a single recurring task template by ID.
 */
export const deleteRecurringTask = async (taskId) => {
  try {
    const { data, error } = await supabase
      .from('recurring_tasks')
      .delete()
      .eq('id', taskId)
      .select();

    if (error) throw error;
    return data && data.length > 0;
  } catch (error) {
    console.error('[Supabase RecurringTasks] Delete Error:', error);
    return false;
  }
};
