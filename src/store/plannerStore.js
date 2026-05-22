import { create } from 'zustand';
import { 
  fetchPlannerData as fetchDbPlannerData, 
  addPlannerTasks as addDbPlannerTasks, 
  updateTaskField as updateDbTaskField, 
  toggleCompletion as toggleDbCompletion, 
  deleteTask as deleteDbTask, 
  updateTask as updateDbTask,
  migrateLegacyData
} from '../lib/plannerService';
import { 
  migrateUpcomingTasksLegacyData 
} from '../lib/upcomingPlannerService';

let plannerFetchPromise = null;
let plannerFetchUserId = null;

const usePlannerStore = create((set, get) => ({
  tasks: [],
  completions: {},
  loading: false,
  hasLoaded: false,
  loadedUserId: null,
  error: null,

  /**
   * fetchPlannerData
   * Performs migrations (once) and retrieves all user tasks and completions.
   * If they are already in memory, bypasses network traffic for ultra-fast render.
   */
  fetchPlannerData: async (userId, force = false) => {
    if (!userId) return;
    
    if (get().hasLoaded && get().loadedUserId === userId && !force) {
      return;
    }

    if (plannerFetchPromise && plannerFetchUserId === userId && !force) {
      return plannerFetchPromise;
    }

    set({ loading: true, error: null });

    const runFetch = async () => {
      try {
        const skipLegacyMigrationKey = `fp_skip_legacy_migration_${userId}`;
        const shouldSkipLegacyMigration = localStorage.getItem(skipLegacyMigrationKey) === 'true';

        if (shouldSkipLegacyMigration) {
          localStorage.setItem(`pcb_migrated_${userId}`, 'true');
          localStorage.setItem(`upcoming_tasks_migrated_${userId}`, 'true');
          localStorage.removeItem(skipLegacyMigrationKey);
        } else {
          // 1. Run legacy migrations in sequence
          await migrateLegacyData(userId);
          await migrateUpcomingTasksLegacyData(userId);
        }

        // 2. Fetch standard datasets from Supabase
        const { tasks, completions, error } = await fetchDbPlannerData(userId);

        if (error) {
          set({ error, loading: false });
        } else {
          set({ 
            tasks: tasks || [], 
            completions: completions || {}, 
            loading: false, 
            hasLoaded: true,
            loadedUserId: userId
          });
        }
      } catch (err) {
        console.error('[PlannerStore] fetchPlannerData failed:', err);
        set({ error: err, loading: false });
      } finally {
        plannerFetchPromise = null;
        plannerFetchUserId = null;
      }
    };

    plannerFetchUserId = userId;
    plannerFetchPromise = runFetch();
    return plannerFetchPromise;
  },

  /**
   * addPlannerTasks
   * Standard batch insert. Syncs both to the db and state array.
   */
  addPlannerTasks: async (userId, newTasksArray) => {
    if (!userId || newTasksArray.length === 0) return [];
    
    set({ loading: true });
    const createdTasks = await addDbPlannerTasks(userId, newTasksArray);
    set({ loading: false });
    
    if (createdTasks && createdTasks.length > 0) {
      set((state) => ({
        tasks: [...state.tasks, ...createdTasks]
      }));
    }
    return createdTasks;
  },

  /**
   * updateTaskField
   * Optimistically patches a single column locally, handles background API sync,
   * and rolls back state on network failures.
   */
  updateTaskField: async (taskId, field, value) => {
    if (!taskId) return false;
    
    const previousTasks = get().tasks;
    
    // Map selectValue properly to state key
    const stateField = field === 'selectValue' ? 'selectValue' : field;

    // Apply local optimistic change
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, [stateField]: value } : t
      )
    }));

    const success = await updateDbTaskField(taskId, field, value);
    if (!success) {
      // Rollback to previous valid state
      set({ tasks: previousTasks });
      return false;
    }
    return true;
  },

  /**
   * updateTask
   * Optimistically updates principal fields of a task, synchronizes with Supabase,
   * and rolls back on failure.
   */
  updateTask: async (taskId, taskPayload) => {
    if (!taskId) return null;

    const previousTasks = get().tasks;

    // Apply local optimistic change
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              description: taskPayload.description,
              duration: taskPayload.duration,
              category: taskPayload.category,
              priority: taskPayload.priority || '',
              isRecurring: taskPayload.isRecurring !== undefined ? taskPayload.isRecurring : (taskPayload.date === null)
            }
          : t
      )
    }));

    const updated = await updateDbTask(taskId, taskPayload);
    if (!updated) {
      // Rollback on failure
      set({ tasks: previousTasks });
      return null;
    }

    // Replace optimistic task with complete verified payload from Postgres response
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === taskId ? updated : t))
    }));
    return updated;
  },

  /**
   * deleteTask
   * Optimistically deletes a task and updates state, then performs database removal.
   */
  deleteTask: async (taskId) => {
    if (!taskId) return false;

    const previousTasks = get().tasks;

    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId)
    }));

    const success = await deleteDbTask(taskId);
    if (!success) {
      // Rollback on failure
      set({ tasks: previousTasks });
      return false;
    }
    return true;
  },

  /**
   * toggleCompletion
   * Optimistically checks/unchecks completion for a specific day,
   * and handles database commit and rollback.
   */
  toggleCompletion: async (userId, taskId, dateStr, isCompleted) => {
    if (!userId || !taskId || !dateStr) return false;

    const previousCompletions = get().completions;

    set((state) => {
      const currentComps = { ...state.completions };
      const dateComps = currentComps[dateStr] ? [...currentComps[dateStr]] : [];
      
      if (isCompleted) {
        if (!dateComps.includes(taskId)) {
          dateComps.push(taskId);
        }
      } else {
        const index = dateComps.indexOf(taskId);
        if (index > -1) {
          dateComps.splice(index, 1);
        }
      }
      currentComps[dateStr] = dateComps;
      return { completions: currentComps };
    });

    const success = await toggleDbCompletion(userId, taskId, dateStr, isCompleted);
    if (!success) {
      // Rollback on failure
      set({ completions: previousCompletions });
      return false;
    }
    return true;
  },

  /**
   * resetStore
   * Resets caching layers back to defaults when logging out.
   */
  resetStore: () => {
    set({
      tasks: [],
      completions: {},
      loading: false,
      hasLoaded: false,
      loadedUserId: null,
      error: null
    });
  }
}));

export { usePlannerStore };
