/**
 * realtimeService.js — cross-device live updates via Supabase Realtime.
 * ──────────────────────────────────────────────────────────────────────────
 * Without this, a change made on mobile (or in another browser tab) is
 * invisible here until the page is refreshed. Each subscribe* function opens a
 * filtered Postgres-changes channel and returns an unsubscribe function.
 *
 * Mirrors FrogPlanner_App/src/lib/realtimeService.ts so both clients behave
 * the same way. Requires db_scripts/enable_realtime.sql to have been run.
 *
 * SECURITY: these tables have no RLS (this app uses custom auth, so
 * auth.uid() is always null — see the note in that migration). Realtime
 * respects RLS, so the server-side `filter` below is the only thing scoping a
 * broadcast to this user. Every handler ALSO re-checks ownership.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabaseClient';

/** Wraps removeChannel so calling unsubscribe twice is harmless. */
const makeUnsubscribe = (channel) => {
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    supabase.removeChannel(channel);
  };
};

/**
 * `payload.new` is empty on DELETE and `payload.old` is empty on INSERT, so
 * normalise to "the row this event is about". DELETE relies on REPLICA
 * IDENTITY FULL being set (see the migration) — without it, `old` carries only
 * the primary key and the guard below cannot check ownership.
 */
const rowOf = (payload) => {
  if (payload.new && Object.keys(payload.new).length > 0) return payload.new;
  if (payload.old && Object.keys(payload.old).length > 0) return payload.old;
  return null;
};

const subscribeToTable = (channelName, table, filter, { onChange }, guard) => {
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      (payload) => {
        const row = rowOf(payload);
        if (!row) return;
        // Defence in depth: the server-side filter should already guarantee
        // this, but with no RLS we verify rather than trust.
        if (!guard(row)) return;
        onChange({ event: payload.eventType, row });
      }
    )
    .subscribe();

  return makeUnsubscribe(channel);
};

// ── Planner ────────────────────────────────────────────────────────────────

export const subscribeToTasks = (userId, options) =>
  subscribeToTable(
    `tasks:${userId}`,
    'tasks',
    `user_id=eq.${userId}`,
    options,
    (row) => row.user_id === userId
  );

export const subscribeToTaskCompletions = (userId, options) =>
  subscribeToTable(
    `task_completions:${userId}`,
    'task_completions',
    `user_id=eq.${userId}`,
    options,
    (row) => row.user_id === userId
  );

export const subscribeToRecurringTasks = (userId, options) =>
  subscribeToTable(
    `recurring_tasks:${userId}`,
    'recurring_tasks',
    `user_id=eq.${userId}`,
    options,
    (row) => row.user_id === userId
  );

// ── Projects ───────────────────────────────────────────────────────────────

export const subscribeToProjectTasks = (projectId, options) =>
  subscribeToTable(
    `project_tasks:${projectId}`,
    'project_tasks',
    `project_id=eq.${projectId}`,
    options,
    (row) => Number(row.project_id) === Number(projectId)
  );

export const subscribeToProjectNotes = (projectId, options) =>
  subscribeToTable(
    `project_notes:${projectId}`,
    'project_notes',
    `project_id=eq.${projectId}`,
    options,
    (row) => Number(row.project_id) === Number(projectId)
  );
