/**
 * upcomingPlannerService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Centralized service layer for managing Upcoming Planner Tasks in Supabase.
 * Uses public.tasks database table with UUID keys.
 * Handles automatic, seamless legacy localStorage migrations.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabaseClient';

/**
 * fetchUpcomingTasks
 * Loads all upcoming tasks for the logged-in user, ordered by date and creation time.
 */
export const fetchUpcomingTasks = async (userId) => {
  try {
    if (!userId) return [];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('task_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Map DB snake_case columns to frontend camelCase formats
    return data.map(t => ({
      id: t.id, // UUID primary key string
      description: t.description,
      duration: t.duration,
      category: t.category,
      priority: t.priority,
      date: t.task_date,
      status: t.select_value === 'Done' ? 'Completed' : 'Pending',
      selectValue: t.select_value || 'Select',
      remarks: t.remarks || '',
      isRecurring: false,
      timestamp: t.created_at
    }));
  } catch (error) {
    console.error('[Supabase Upcoming] Fetch Error:', error);
    return [];
  }
};

/**
 * createUpcomingTasks
 * Performs a bulk insert of new upcoming tasks into Supabase.
 */
export const createUpcomingTasks = async (userId, newTasksArray) => {
  try {
    if (!userId || newTasksArray.length === 0) return [];

    const rowsToInsert = newTasksArray.map(t => ({
      user_id: userId,
      description: t.description,
      duration: t.duration,
      category: t.category,
      priority: t.priority || '',
      task_date: t.date || null,
      select_value: t.status === 'Completed' ? 'Done' : 'Pending',
      remarks: t.remarks || ''
    }));

    const { data, error } = await supabase
      .from('tasks')
      .insert(rowsToInsert)
      .select();

    if (error) throw error;

    return data.map(t => ({
      id: t.id,
      description: t.description,
      duration: t.duration,
      category: t.category,
      priority: t.priority,
      date: t.task_date,
      status: t.select_value === 'Done' ? 'Completed' : 'Pending',
      selectValue: t.select_value || 'Select',
      remarks: t.remarks || '',
      isRecurring: false,
      timestamp: t.created_at
    }));
  } catch (error) {
    console.error('[Supabase Upcoming] Create Tasks Error:', error);
    return [];
  }
};

/**
 * updateUpcomingTaskField
 * Updates a single field of a task (e.g. status/select_value, remarks).
 */
export const updateUpcomingTaskField = async (taskId, field, value) => {
  try {
    if (!taskId) return false;

    const dbField = field === 'date' ? 'task_date' : (field === 'status' ? 'select_value' : field);
    const dbValue = field === 'status' ? (value === 'Completed' ? 'Done' : 'Pending') : value;

    const { error } = await supabase
      .from('tasks')
      .update({ [dbField]: dbValue })
      .eq('id', taskId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Supabase Upcoming] Update Field Error:', error);
    return false;
  }
};

/**
 * updateUpcomingTask
 * Updates all principal editable fields of an upcoming task in a single payload.
 */
export const updateUpcomingTask = async (taskId, taskPayload) => {
  try {
    if (!taskId) return null;

    const { data, error } = await supabase
      .from('tasks')
      .update({
        description: taskPayload.description,
        duration: taskPayload.duration,
        category: taskPayload.category,
        priority: taskPayload.priority || '',
        task_date: taskPayload.date
      })
      .eq('id', taskId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      description: data.description,
      duration: data.duration,
      category: data.category,
      priority: data.priority,
      date: data.task_date,
      status: data.select_value === 'Done' ? 'Completed' : 'Pending',
      selectValue: data.select_value || 'Select',
      remarks: data.remarks || '',
      isRecurring: false,
      timestamp: data.created_at
    };
  } catch (error) {
    console.error('[Supabase Upcoming] Update Task Error:', error);
    return null;
  }
};

/**
 * deleteUpcomingTask
 * Deletes a single upcoming task by ID.
 */
export const deleteUpcomingTask = async (taskId) => {
  try {
    if (!taskId) return false;

    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Supabase Upcoming] Delete Task Error:', error);
    return false;
  }
};

/**
 * migrateUpcomingTasksLegacyData
 * Moves existing local upcoming tasks into Supabase when the user logs in.
 */
export const migrateUpcomingTasksLegacyData = async (userId) => {
  try {
    if (!userId) return false;

    const migrationKey = `upcoming_tasks_migrated_${userId}`;
    if (localStorage.getItem(migrationKey) === 'true') {
      return false; // Already migrated
    }

    const legacyTasks = JSON.parse(localStorage.getItem('upcoming_planner_tasks') || '[]');

    if (legacyTasks.length === 0) {
      localStorage.setItem(migrationKey, 'true');
      return false;
    }

    console.log(`[Migration] Migrating ${legacyTasks.length} upcoming tasks to Supabase for user ${userId}...`);

    // Bulk insert tasks to Supabase
    const rowsToInsert = legacyTasks.map(t => ({
      user_id: userId,
      description: t.description,
      duration: t.duration,
      category: t.category,
      priority: t.priority || '',
      task_date: t.date || null,
      select_value: t.status === 'Completed' ? 'Done' : 'Pending',
      remarks: t.remarks || '',
      created_at: t.timestamp || new Date().toISOString()
    }));

    // Chunk insert to respect limits if payload size is large
    const chunkSize = 200;
    for (let i = 0; i < rowsToInsert.length; i += chunkSize) {
      const chunk = rowsToInsert.slice(i, i + chunkSize);
      const { error } = await supabase
        .from('tasks')
        .insert(chunk);
      if (error) throw error;
    }

    localStorage.setItem(migrationKey, 'true');
    // Clear the legacy localStorage key so new user accounts on the same browser
    // do not inherit these tasks during their first-time migration.
    localStorage.removeItem('upcoming_planner_tasks');
    console.log('[Migration] Upcoming tasks migration completed successfully!');
    return true;
  } catch (error) {
    console.error('[Migration] Failed to migrate upcoming tasks:', error);
    return false;
  }
};
