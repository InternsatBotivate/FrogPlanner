/**
 * plannerService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Centralized service layer for managing Tasks and Completions in Supabase.
 * Enforces user ownership via custom user UUIDs.
 * Handles automatic, seamless legacy localStorage migrations.
 * Delegates recurring task operations to recurringTasksService.js.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabaseClient';
import {
  fetchRecurringTasks,
  addRecurringTasks,
  updateRecurringTask,
  updateRecurringTaskField,
  deleteRecurringTask
} from './recurringTasksService';

/**
 * fetchPlannerData
 * Loads all tasks and completions for the logged-in user.
 * Recompiles completions into a date-indexed map to remain compatible with existing UI states.
 */
export const fetchPlannerData = async (userId) => {
  try {
    if (!userId) return { tasks: [], completions: {} };

    // 1. Fetch tasks
    const { data: dbTasks, error: tasksError } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (tasksError) throw tasksError;

    // 2. Fetch recurring tasks
    const recurringTasks = await fetchRecurringTasks(userId);

    // 3. Fetch completions
    const { data: dbCompletions, error: completionsError } = await supabase
      .from('task_completions')
      .select('task_id, completion_date, created_at')
      .eq('user_id', userId);

    if (completionsError) throw completionsError;

    // 4. Map tasks into frontend standard format
    const tasks = [
      ...dbTasks.map(t => ({
        id: t.id,
        description: t.description,
        duration: t.duration,
        category: t.category,
        priority: t.priority,
        date: t.task_date || null,
        selectValue: t.select_value || 'Select',
        remarks: t.remarks || '',
        isRecurring: t.is_recurring || false,
        timestamp: t.created_at
      })),
      ...recurringTasks
    ];

    // 5. Compile completions into standard YYYY-MM-DD -> [taskId1, taskId2] format
    const completions = {};
    const completionDates = {};
    dbCompletions.forEach(c => {
      const dateStr = c.completion_date;
      if (!completions[dateStr]) {
        completions[dateStr] = [];
      }
      completions[dateStr].push(c.task_id);
      completionDates[c.task_id] = c.created_at;
    });

    return { tasks, completions, completionDates };
  } catch (error) {
    console.error('[Supabase Planner] Fetch Error:', error);
    return { tasks: [], completions: {}, error };
  }
};

/**
 * addPlannerTasks
 * Performs a bulk insert of new tasks into Supabase.
 * Returns mapped frontend-friendly rows.
 */
export const addPlannerTasks = async (userId, newTasksArray) => {
  try {
    if (!userId || newTasksArray.length === 0) return [];

    const recurringTasksToInsert = newTasksArray.filter(t => t.isRecurring);
    const regularTasksToInsert = newTasksArray.filter(t => !t.isRecurring);

    let insertedTasks = [];

    if (recurringTasksToInsert.length > 0) {
      const createdRecTasks = await addRecurringTasks(userId, recurringTasksToInsert);
      insertedTasks = [...insertedTasks, ...createdRecTasks];
    }

    if (regularTasksToInsert.length > 0) {
      const dbRows = regularTasksToInsert.map(t => ({
        user_id: userId,
        description: t.description,
        duration: t.duration,
        category: t.category,
        priority: t.priority || '',
        task_date: t.date || null,
        select_value: t.selectValue || 'Select',
        remarks: t.remarks || '',
        is_recurring: false
      }));

      const { data, error } = await supabase
        .from('tasks')
        .insert(dbRows)
        .select();

      if (error) throw error;

      insertedTasks = [...insertedTasks, ...data.map(t => ({
        id: t.id,
        description: t.description,
        duration: t.duration,
        category: t.category,
        priority: t.priority,
        date: t.task_date || null,
        selectValue: t.select_value || 'Select',
        remarks: t.remarks || '',
        isRecurring: false,
        timestamp: t.created_at
      }))];
    }

    return insertedTasks;
  } catch (error) {
    console.error('[Supabase Planner] Add Tasks Error:', error);
    return [];
  }
};

/**
 * updateTaskField
 * Patches a task record's column in Supabase.
 */
export const updateTaskField = async (taskId, field, value) => {
  try {
    const dbField = field === 'selectValue' ? 'select_value' : field;

    // First try updating in tasks table
    const { data: standardTasks, error: standardError } = await supabase
      .from('tasks')
      .update({ [dbField]: value })
      .eq('id', taskId)
      .select();

    if (standardError) {
      // If column is missing (e.g. select_value in recurring_tasks) or not found, fall back to recurringTasksService
      const success = await updateRecurringTaskField(taskId, field, value);
      if (success) return true;
      throw standardError;
    }

    if (standardTasks && standardTasks.length > 0) {
      return true;
    }

    // Try updating in recurring tasks
    return await updateRecurringTaskField(taskId, field, value);
  } catch (error) {
    console.error('[Supabase Planner] Update Task Field Error:', error);
    return false;
  }
};

/**
 * toggleCompletion
 * Relational toggling of completed items.
 */
export const toggleCompletion = async (userId, taskId, dateStr, isCompleted) => {
  try {
    if (!userId || !taskId || !dateStr) return false;

    if (isCompleted) {
      // Create completion row
      const { error } = await supabase
        .from('task_completions')
        .insert({
          user_id: userId,
          task_id: taskId,
          completion_date: dateStr
        });
      if (error && error.code !== '23505') throw error; // Ignore duplicate key violations
    } else {
      // Remove completion row
      const { error } = await supabase
        .from('task_completions')
        .delete()
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .eq('completion_date', dateStr);
      if (error) throw error;
    }
    return true;
  } catch (error) {
    console.error('[Supabase Planner] Toggle Completion Error:', error);
    return false;
  }
};

/**
 * migrateLegacyData
 * Checks for existing localStorage planner data and seamlessly uploads it to Supabase.
 */
export const migrateLegacyData = async (userId) => {
  try {
    if (!userId) return false;

    const migrationKey = `pcb_migrated_${userId}`;
    if (localStorage.getItem(migrationKey) === 'true') {
      return false; // Already migrated for this user
    }

    const legacyTasks = JSON.parse(localStorage.getItem('pcb_tasks_v3') || '[]');
    const legacyCompletions = JSON.parse(localStorage.getItem('pcb_planner_completions_v1') || '{}');

    if (legacyTasks.length === 0) {
      // Mark as completed since there is nothing to migrate
      localStorage.setItem(migrationKey, 'true');
      return false;
    }

    console.log(`[Migration] Starting legacy tasks migration for user ${userId}. Total tasks: ${legacyTasks.length}`);

    const legacyRecurring = legacyTasks.filter(t => t.isRecurring);
    const legacyRegular = legacyTasks.filter(t => !t.isRecurring);

    const dbTasks = [];

    // 1. Bulk insert regular tasks
    if (legacyRegular.length > 0) {
      const tasksToInsert = legacyRegular.map(t => ({
        user_id: userId,
        description: t.description,
        duration: t.duration,
        category: t.category,
        priority: t.priority || '',
        task_date: t.date || null,
        select_value: t.selectValue || 'Select',
        remarks: t.remarks || '',
        is_recurring: false
      }));

      const { data, error: tasksError } = await supabase
        .from('tasks')
        .insert(tasksToInsert)
        .select();

      if (tasksError) throw tasksError;
      if (data) dbTasks.push(...data);
    }

    // 2. Bulk insert recurring tasks
    if (legacyRecurring.length > 0) {
      const createdRecs = await addRecurringTasks(userId, legacyRecurring);
      createdRecs.forEach(r => {
        dbTasks.push({
          id: r.id,
          description: r.description,
          duration: r.duration,
          category: r.category,
          priority: r.priority,
          task_date: null,
          select_value: 'Select',
          remarks: r.remarks,
          is_recurring: true
        });
      });
    }

    // 3. Map legacy mock string IDs (e.g. "TSK-1") to newly created Supabase UUIDs
    const idMap = {};
    legacyTasks.forEach(oldTask => {
      const match = dbTasks.find(n => n.description === oldTask.description && (n.duration === oldTask.duration || n.duration === oldTask.time_slot));
      if (match) {
        idMap[oldTask.id] = match.id;
      }
    });

    // 4. Compile completions insertion records
    const completionsToInsert = [];
    Object.entries(legacyCompletions).forEach(([dateStr, oldIds]) => {
      if (Array.isArray(oldIds)) {
        oldIds.forEach(oldId => {
          const uuid = idMap[oldId];
          if (uuid) {
            completionsToInsert.push({
              user_id: userId,
              task_id: uuid,
              completion_date: dateStr
            });
          }
        });
      }
    });

    // 5. Bulk insert completions (chunked to prevent Postgres payload size limits)
    if (completionsToInsert.length > 0) {
      console.log(`[Migration] Inserting ${completionsToInsert.length} completed records...`);
      const chunkSize = 200;
      for (let i = 0; i < completionsToInsert.length; i += chunkSize) {
        const chunk = completionsToInsert.slice(i, i + chunkSize);
        const { error: compError } = await supabase
          .from('task_completions')
          .insert(chunk);
        if (compError) throw compError;
      }
    }

    // 6. Success - Set migration flag and clear legacy localStorage data
    localStorage.setItem(migrationKey, 'true');
    localStorage.removeItem('pcb_tasks_v3');
    localStorage.removeItem('pcb_planner_completions_v1');
    console.log('[Migration] Planner migration successfully completed!');
    return true;
  } catch (error) {
    console.error('[Migration] Failed to migrate legacy local planner data:', error);
    return false;
  }
};

/**
 * deleteTask
 * Deletes a single task record by ID.
 */
export const deleteTask = async (taskId) => {
  try {
    // Try to delete from recurring tasks first
    const isDeletedRec = await deleteRecurringTask(taskId);
    if (isDeletedRec) return true;

    // Delete from standard tasks
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Supabase Planner] Delete Task Error:', error);
    return false;
  }
};

/**
 * updateTask
 * Updates multiple fields of a task (description, duration, category, priority) and returns mapped result.
 */
export const updateTask = async (taskId, taskPayload) => {
  try {
    if (taskPayload.isRecurring) {
      return await updateRecurringTask(taskId, taskPayload);
    }

    const { data, error } = await supabase
      .from('tasks')
      .update({
        description: taskPayload.description,
        duration: taskPayload.duration,
        category: taskPayload.category,
        priority: taskPayload.priority || '',
        is_recurring: false
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
      date: data.task_date || null,
      selectValue: data.select_value || 'Select',
      remarks: data.remarks || '',
      isRecurring: false,
      timestamp: data.created_at
    };
  } catch (error) {
    console.error('[Supabase Planner] Update Task Error:', error);
    return null;
  }
};
