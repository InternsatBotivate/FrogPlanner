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
 * Maps a recurring_tasks row to the shape the UI consumes.
 * Extracted because the same mapping was repeated in three places.
 */
const mapRow = (r) => ({
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
  timestamp: r.created_at,
  recurrence: {
    // Rows created before the frequency migration have no value; they were
    // daily by definition.
    frequency: r.frequency || 'Daily',
    daysOfWeek: r.days_of_week || [],
    dayOfMonth: r.day_of_month ?? null,
    monthOfYear: r.month_of_year ?? null,
    intervalDays: r.interval_days ?? null,
    startDate: r.start_date ?? null,
    endDate: r.end_date ?? null,
  },
});

/**
 * Builds the schedule columns for a write. Only the fields the chosen
 * frequency actually uses are set — the rest are cleared so a template
 * switched from Weekly to Monthly doesn't keep stale days_of_week that the
 * DB check constraint would then reject.
 */
const scheduleColumns = (recurrence) => {
  const frequency = recurrence?.frequency || 'Daily';
  const usesDayOfMonth = frequency === 'Monthly' || frequency === 'Yearly';
  return {
    frequency,
    days_of_week: frequency === 'Weekly' ? recurrence?.daysOfWeek || [] : [],
    day_of_month: usesDayOfMonth ? recurrence?.dayOfMonth ?? null : null,
    month_of_year: frequency === 'Yearly' ? recurrence?.monthOfYear ?? null : null,
    interval_days: frequency === 'Custom' ? recurrence?.intervalDays ?? null : null,
    // start/end bound any frequency, so they are never cleared by frequency.
    start_date: recurrence?.startDate ?? null,
    end_date: recurrence?.endDate ?? null,
  };
};

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

    return (data || []).map(mapRow);
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
      is_active: t.isActive !== undefined ? t.isActive : true,
      ...scheduleColumns(t.recurrence)
    }));

    const { data, error } = await supabase
      .from('recurring_tasks')
      .insert(dbRows)
      .select();

    if (error) throw error;

    return (data || []).map(mapRow);
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
        is_active: taskPayload.isActive !== undefined ? taskPayload.isActive : true,
        ...scheduleColumns(taskPayload.recurrence)
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    return mapRow(data);
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
