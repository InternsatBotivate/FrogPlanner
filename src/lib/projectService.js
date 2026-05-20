/**
 * projectService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Centralized service layer for managing Projects and Checklist Tasks in Supabase.
 * Enforces user ownership via the user UUID from public.users.
 * Uses autoincrementing serial integer IDs for projects and project_tasks.
 * Handles automatic, seamless legacy localStorage migrations.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabaseClient';

/**
 * fetchProjects
 * Loads all projects for the logged-in user, with task stats (total/completed).
 * Returns frontend-friendly objects with pre-calculated task counts.
 */
export const fetchProjects = async (userId) => {
  try {
    if (!userId) return [];

    // 1. Fetch all projects owned by the user
    const { data: dbProjects, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (projError) throw projError;
    if (dbProjects.length === 0) return [];

    // 2. Fetch task completion counts for all projects in one query
    const projectIds = dbProjects.map((p) => p.id);

    const { data: dbTasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('id, project_id, is_completed')
      .in('project_id', projectIds);

    if (tasksError) throw tasksError;

    // 3. Map into frontend card format with stats
    return dbProjects.map((p) => {
      const pTasks = dbTasks.filter((t) => t.project_id === p.id);
      return {
        id: p.id,                         // Serial integer
        name: p.name,
        createdAt: p.created_at,
        stats: {
          total: pTasks.length,
          completed: pTasks.filter((t) => t.is_completed).length,
        },
      };
    });
  } catch (error) {
    console.error('[Supabase Projects] Fetch Projects Error:', error);
    return [];
  }
};

/**
 * fetchProjectWithTasks
 * Loads a single project record by ID + its full checklist.
 * Also validates ownership via user_id to prevent unauthorized access.
 */
export const fetchProjectWithTasks = async (userId, projectId) => {
  try {
    if (!userId || !projectId) return null;

    // Route param is a string — convert to the integer the DB expects
    const numericProjectId = parseInt(projectId, 10);
    if (isNaN(numericProjectId)) return null;

    // 1. Validate ownership / existence
    const { data: project, error: projError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', numericProjectId)
      .eq('user_id', userId)
      .single();

    if (projError || !project) throw projError || new Error('Project not found');

    // 2. Fetch checklist tasks sorted oldest-first
    const { data: tasks, error: tasksError } = await supabase
      .from('project_tasks')
      .select('*')
      .eq('project_id', numericProjectId)
      .order('created_at', { ascending: true });

    if (tasksError) throw tasksError;

    return {
      project: {
        id: project.id,
        name: project.name,
        createdAt: project.created_at,
      },
      tasks: tasks.map((t) => ({
        id: t.id,                         // Serial integer
        projectId: t.project_id,
        description: t.description,
        isCompleted: t.is_completed,
        createdAt: t.created_at,
      })),
    };
  } catch (error) {
    console.error('[Supabase Projects] Fetch Project Details Error:', error);
    return null;
  }
};

/**
 * createProject
 * Inserts a new project row and returns the new frontend-friendly object.
 */
export const createProject = async (userId, name) => {
  try {
    if (!userId || !name) return null;

    const { data, error } = await supabase
      .from('projects')
      .insert({ user_id: userId, name })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,                        // Serial integer returned from DB
      name: data.name,
      createdAt: data.created_at,
      stats: { total: 0, completed: 0 },
    };
  } catch (error) {
    console.error('[Supabase Projects] Create Project Error:', error);
    return null;
  }
};

/**
 * deleteProject
 * Deletes a project by serial ID + user_id guard.
 * Cascade defined in DB automatically deletes all associated project_tasks rows.
 */
export const deleteProject = async (userId, projectId) => {
  try {
    if (!userId || !projectId) return false;

    const numericProjectId = parseInt(projectId, 10);
    if (isNaN(numericProjectId)) return false;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', numericProjectId)
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Supabase Projects] Delete Project Error:', error);
    return false;
  }
};

/**
 * createProjectTask
 * Inserts a single checklist task and returns the new frontend-friendly object.
 */
export const createProjectTask = async (projectId, description) => {
  try {
    if (!projectId || !description) return null;

    const numericProjectId = parseInt(projectId, 10);
    if (isNaN(numericProjectId)) return null;

    const { data, error } = await supabase
      .from('project_tasks')
      .insert({ project_id: numericProjectId, description, is_completed: false })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,                        // Serial integer
      projectId: data.project_id,
      description: data.description,
      isCompleted: data.is_completed,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('[Supabase Projects] Create Task Error:', error);
    return null;
  }
};

/**
 * updateProjectTaskField
 * Patches a single field on a task row (description or isCompleted).
 */
export const updateProjectTaskField = async (taskId, field, value) => {
  try {
    if (taskId === undefined || taskId === null) return false;

    const numericTaskId = parseInt(taskId, 10);
    if (isNaN(numericTaskId)) return false;

    // Map frontend camelCase keys to DB snake_case column names
    const dbField = field === 'isCompleted' ? 'is_completed' : field;

    const { error } = await supabase
      .from('project_tasks')
      .update({ [dbField]: value })
      .eq('id', numericTaskId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Supabase Projects] Update Task Error:', error);
    return false;
  }
};

/**
 * deleteProjectTask
 * Deletes a single checklist item by serial ID.
 */
export const deleteProjectTask = async (taskId) => {
  try {
    if (taskId === undefined || taskId === null) return false;

    const numericTaskId = parseInt(taskId, 10);
    if (isNaN(numericTaskId)) return false;

    const { error } = await supabase
      .from('project_tasks')
      .delete()
      .eq('id', numericTaskId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[Supabase Projects] Delete Task Error:', error);
    return false;
  }
};

/**
 * migrateProjectsLegacyData
 * Checks for existing localStorage project data and seamlessly uploads it to Supabase.
 * Maps legacy mock string IDs (e.g. "PROJ-1234567890") to newly created serial integer PKs.
 * Runs once per user — guarded by a localStorage migration flag.
 */
export const migrateProjectsLegacyData = async (userId) => {
  try {
    if (!userId) return false;

    const migrationKey = `projects_migrated_${userId}`;
    if (localStorage.getItem(migrationKey) === 'true') {
      return false; // Already migrated for this user
    }

    const legacyProjects = JSON.parse(localStorage.getItem('my_projects') || '[]');
    const legacyTasks    = JSON.parse(localStorage.getItem('my_project_tasks') || '[]');

    if (legacyProjects.length === 0) {
      // Nothing to migrate — mark as done
      localStorage.setItem(migrationKey, 'true');
      return false;
    }

    console.log(`[Migration] Starting projects migration for user ${userId}. Projects: ${legacyProjects.length}, Tasks: ${legacyTasks.length}`);

    // 1. Bulk insert legacy projects
    const projectsToInsert = legacyProjects.map((p) => ({
      user_id:    userId,
      name:       p.name,
      created_at: p.createdAt || new Date().toISOString(),
    }));

    const { data: dbProjects, error: projError } = await supabase
      .from('projects')
      .insert(projectsToInsert)
      .select();

    if (projError) throw projError;

    // 2. Build a map: old local string ID → new DB serial integer
    const projectMap = {};
    legacyProjects.forEach((oldProj) => {
      const match = dbProjects.find((n) => n.name === oldProj.name);
      if (match) {
        projectMap[oldProj.id] = match.id;
      }
    });

    // 3. Compile task records using the new serial integer project IDs
    const tasksToInsert = [];
    legacyTasks.forEach((t) => {
      const newProjectId = projectMap[t.projectId];
      if (newProjectId) {
        tasksToInsert.push({
          project_id:   newProjectId,
          description:  t.description,
          is_completed: !!t.isCompleted,
          created_at:   t.createdAt || new Date().toISOString(),
        });
      }
    });

    // 4. Bulk insert tasks in chunks (prevents Postgres payload size limits)
    if (tasksToInsert.length > 0) {
      console.log(`[Migration] Inserting ${tasksToInsert.length} project tasks...`);
      const chunkSize = 200;
      for (let i = 0; i < tasksToInsert.length; i += chunkSize) {
        const chunk = tasksToInsert.slice(i, i + chunkSize);
        const { error: taskError } = await supabase
          .from('project_tasks')
          .insert(chunk);
        if (taskError) throw taskError;
      }
    }

    // 5. Mark migration as complete
    localStorage.setItem(migrationKey, 'true');
    console.log('[Migration] Projects migration successfully completed!');
    return true;
  } catch (error) {
    console.error('[Migration] Failed to migrate legacy projects data:', error);
    return false;
  }
};
