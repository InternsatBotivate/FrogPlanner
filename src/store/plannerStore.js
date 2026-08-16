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
import {
  subscribeToRecurringTasks,
  subscribeToTaskCompletions,
  subscribeToTasks
} from '../lib/realtimeService';

let plannerFetchPromise = null;
let plannerFetchUserId = null;

/** Active realtime subscriptions, and the user they belong to. */
let realtimeUnsubscribers = [];
let realtimeUserId = null;
/** Coalesces a burst of remote events into one refetch. */
let realtimeRefreshTimer = null;

const usePlannerStore = create((set, get) => ({
  tasks: [],
  completions: {},
  completionDates: {},
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

    const hasLoaded = get().hasLoaded;
    const loadedUserId = get().loadedUserId;
    
    // Only show loading spinner on initial load or if explicitly forced
    const isInitialLoad = !hasLoaded || loadedUserId !== userId || force;

    if (plannerFetchPromise && plannerFetchUserId === userId && !force) {
      return plannerFetchPromise;
    }

    if (isInitialLoad) {
      set({ loading: true, error: null });
    }

    const runFetch = async () => {
      try {
        const skipLegacyMigrationKey = `fp_skip_legacy_migration_${userId}`;
        const shouldSkipLegacyMigration = localStorage.getItem(skipLegacyMigrationKey) === 'true';

        if (shouldSkipLegacyMigration) {
          localStorage.setItem(`pcb_migrated_${userId}`, 'true');
          localStorage.setItem(`upcoming_tasks_migrated_${userId}`, 'true');
          localStorage.removeItem(skipLegacyMigrationKey);
        } else if (isInitialLoad) {
          // Only run legacy migrations on initial load
          await migrateLegacyData(userId);
          await migrateUpcomingTasksLegacyData(userId);
        }

        // 2. Fetch standard datasets from Supabase
        const { tasks, completions, completionDates, error } = await fetchDbPlannerData(userId);

        if (error) {
          set({ error, loading: false });
        } else {
          set({ 
            tasks: tasks || [], 
            completions: completions || {}, 
            completionDates: completionDates || {},
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
              date: taskPayload.date !== undefined ? taskPayload.date : t.date,
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
    const previousCompletionDates = get().completionDates;
    const previousTasks = get().tasks;

    set((state) => {
      const currentComps = { ...state.completions };
      const dateComps = currentComps[dateStr] ? [...currentComps[dateStr]] : [];
      
      const currentDates = { ...state.completionDates };

      if (isCompleted) {
        if (!dateComps.includes(taskId)) {
          dateComps.push(taskId);
        }
        currentDates[taskId] = new Date().toISOString();
      } else {
        const index = dateComps.indexOf(taskId);
        if (index > -1) {
          dateComps.splice(index, 1);
        }
        delete currentDates[taskId];
      }
      currentComps[dateStr] = dateComps;

      // Synchronize the task selectValue in store memory
      const updatedTasks = state.tasks.map(t => {
        if (t.id === taskId) {
          return { ...t, selectValue: isCompleted ? 'Done' : 'Select' };
        }
        return t;
      });

      return { 
        completions: currentComps, 
        completionDates: currentDates, 
        tasks: updatedTasks 
      };
    });

    const success = await toggleDbCompletion(userId, taskId, dateStr, isCompleted);
    if (!success) {
      // Rollback on failure
      set({ 
        completions: previousCompletions, 
        completionDates: previousCompletionDates,
        tasks: previousTasks 
      });
      return false;
    }

    // Persist select_value in tasks table for standard tasks in DB
    const task = get().tasks.find(t => t.id === taskId);
    if (task && !task.isRecurring) {
      await updateDbTaskField(taskId, 'selectValue', isCompleted ? 'Done' : 'Select');
    }

    return true;
  },

  /**
   * startRealtime
   * Subscribes to this user's planner tables so an edit made on mobile (or in
   * another tab) lands here without a manual refresh. Idempotent per user.
   *
   * Unlike the mobile client there is no offline outbox to reconcile against,
   * so a remote change simply forces a refetch. It is debounced because one
   * user action elsewhere can emit several row events (a task plus its
   * completion row, say).
   */
  startRealtime: (userId) => {
    if (!userId || realtimeUserId === userId) return;
    get().stopRealtime();
    realtimeUserId = userId;

    const scheduleRefresh = () => {
      if (realtimeRefreshTimer) clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = setTimeout(() => {
        realtimeRefreshTimer = null;
        if (realtimeUserId) get().fetchPlannerData(realtimeUserId, true);
      }, 400);
    };

    realtimeUnsubscribers = [
      subscribeToTasks(userId, { onChange: scheduleRefresh }),
      subscribeToTaskCompletions(userId, { onChange: scheduleRefresh }),
      subscribeToRecurringTasks(userId, { onChange: scheduleRefresh })
    ];
  },

  /** Tears down the subscriptions. Safe to call when none are active. */
  stopRealtime: () => {
    if (realtimeRefreshTimer) {
      clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = null;
    }
    realtimeUnsubscribers.forEach((off) => off());
    realtimeUnsubscribers = [];
    realtimeUserId = null;
  },

  /**
   * resetStore
   * Resets caching layers back to defaults when logging out.
   */
  resetStore: () => {
    get().stopRealtime();
    set({
      tasks: [],
      completions: {},
      completionDates: {},
      loading: false,
      hasLoaded: false,
      loadedUserId: null,
      error: null
    });
  }
}));

export { usePlannerStore };
