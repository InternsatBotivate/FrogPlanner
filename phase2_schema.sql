-- =====================================================================
-- FrogPlanner — Phase 2 SQL Schema
-- Run this entire script in your Supabase SQL Editor
-- ( https://supabase.com/dashboard/project/<your-project>/sql/new )
-- =====================================================================

-- ── STEP 1: Custom Enums ──────────────────────────────────────────────────
-- (Skip with DO $$ if it already exists)
DO $$ BEGIN
    CREATE TYPE task_duration AS ENUM ('Morning', 'Afternoon', 'Evening', 'Night');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('Frog', 'Normal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── STEP 2: Tasks Table ───────────────────────────────────────────────────
-- Storing 'category' as a VARCHAR allows users to dynamically create custom
-- categories inside the React app (saved to their profile list).
CREATE TABLE IF NOT EXISTS public.tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    description   TEXT NOT NULL,
    duration      task_duration NOT NULL,
    category      VARCHAR(100) NOT NULL,
    priority      VARCHAR(50) DEFAULT '',                   -- 'Frog' or empty
    task_date     DATE,                                     -- Specific date, or NULL if recurring template task
    select_value  VARCHAR(50) DEFAULT 'Select',             -- UI dropdown: 'Select', 'Pending', 'Done'
    remarks       TEXT DEFAULT '',
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Compound index for fetching daily lists rapidly for a specific user
CREATE INDEX IF NOT EXISTS idx_tasks_user_date
    ON public.tasks (user_id, task_date);


-- ── STEP 3: Task Completions Table ────────────────────────────────────────
-- Stores chronological completions of specific tasks.
-- Links back to public.tasks and public.users.
CREATE TABLE IF NOT EXISTS public.task_completions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id         UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    completion_date DATE NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    CONSTRAINT unique_daily_task_completion UNIQUE (user_id, task_id, completion_date)
);

-- Compound index for fast streaks, historical progress, and dashboard aggregates
CREATE INDEX IF NOT EXISTS idx_task_completions_user_date
    ON public.task_completions (user_id, completion_date);


-- ── STEP 4: Seed Initial Default Recurring Tasks for Testing ───────────────
-- Only runs if the users have been created from phase1_schema.sql.
-- Inserts standard daily tasks for the 'admin' account if they don't exist yet.

DO $$
DECLARE
    v_admin_id UUID;
BEGIN
    SELECT id INTO v_admin_id FROM public.users WHERE username = 'admin' LIMIT 1;
    
    IF v_admin_id IS NOT NULL THEN
        -- If user tables exist, insert default tasks for the seeded admin user
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tasks') THEN
            INSERT INTO public.tasks (user_id, description, duration, category, priority, select_value)
            VALUES
                (v_admin_id, 'Review Agenda & Schedule', 'Morning', 'Work', 'Normal', 'Select'),
                (v_admin_id, 'Gym Workout Routine', 'Morning', 'Health', 'Normal', 'Select'),
                (v_admin_id, 'Standup Sync Meeting', 'Morning', 'Meeting', 'Normal', 'Select'),
                (v_admin_id, 'Calibration of Micrometer Set', 'Morning', 'Work', 'Frog', 'Select'), -- Frog task!
                (v_admin_id, 'Lunch Break', 'Afternoon', 'Personal', 'Normal', 'Select'),
                (v_admin_id, 'Client Onboarding Presentation', 'Afternoon', 'Meeting', 'Normal', 'Select'),
                (v_admin_id, 'Code Review of Frontend PRs', 'Afternoon', 'Review', 'Normal', 'Select'),
                (v_admin_id, 'Post daily updates on Slack', 'Evening', 'Work', 'Normal', 'Select'),
                (v_admin_id, 'Dinner', 'Evening', 'Personal', 'Normal', 'Select'),
                (v_admin_id, 'Read Technical Book or Blog', 'Night', 'Personal', 'Normal', 'Select'),
                (v_admin_id, 'Plan Tomorrow''s Targets', 'Night', 'Work', 'Normal', 'Select')
            ON CONFLICT DO NOTHING;
        END IF;
    END IF;
END $$;
