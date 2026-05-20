-- =====================================================================
-- FrogPlanner — Phase 1 SQL Schema
-- Run this entire script in your Supabase SQL Editor
-- ( https://supabase.com/dashboard/project/<your-project>/sql/new )
-- =====================================================================

-- ── STEP 1: Custom user role enum ─────────────────────────────────────────
-- (Skip with DO $$ if it already exists)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'USER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ── STEP 2: Departments (master reference, used as FK in users) ───────────
CREATE TABLE IF NOT EXISTS public.departments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Seed the default departments that match the existing DEFAULT_SETTINGS
INSERT INTO public.departments (name) VALUES
    ('General Division'),
    ('Engineering Division'),
    ('Finance Division'),
    ('Operations Division'),
    ('Marketing Division'),
    ('HR Division'),
    ('IT Division')
ON CONFLICT (name) DO NOTHING;


-- ── STEP 3: Custom users table ────────────────────────────────────────────
-- This is the single source of truth for all user accounts.
-- It is completely independent of Supabase's auth.users system.
CREATE TABLE IF NOT EXISTS public.users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(100)  NOT NULL UNIQUE,           -- app-level User ID (e.g. "admin")
    full_name     VARCHAR(255)  NOT NULL,
    email         VARCHAR(255)  UNIQUE,
    password_hash VARCHAR(255)  NOT NULL,                  -- SHA-256 hashed password
    role          user_role     DEFAULT 'USER' NOT NULL,
    designation   VARCHAR(150)  DEFAULT 'Team Member',
    department    VARCHAR(150)  DEFAULT 'General Division',
    phone         VARCHAR(50),
    bio           TEXT,
    avatar_url    TEXT,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Auto-update the `updated_at` column on any row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── STEP 4: Seed the three built-in demo users ────────────────────────────
-- Passwords are stored in plain text.
--
--   admin  / admin123
--   user   / user123
--   user2  / user123

INSERT INTO public.users (username, full_name, email, password_hash, role, designation, department, phone, bio) VALUES
(
    'admin',
    'Admin User',
    'admin@company.com',
    'admin123',
    'ADMIN',
    'Specialist / Chief Architect',
    'General Division',
    '+91 98765 43210',
    'Oversees day-to-day operations, task management, and system configuration.'
),
(
    'user',
    'Employee 1',
    'employee1@company.com',
    'user123',
    'USER',
    'Frontend Engineer',
    'Engineering Division',
    '+91 98765 43211',
    'Responsible for building robust user interfaces and maintaining standard web systems.'
),
(
    'user2',
    'Employee 2',
    'employee2@company.com',
    'user123',
    'USER',
    'Operations Lead',
    'General Division',
    '+91 98765 43212',
    'Manages daily tasks, logistics execution, and operations scheduling.'
)
ON CONFLICT (username) DO NOTHING;


-- ── STEP 5: User sessions table ───────────────────────────────────────────
-- Stores active session tokens per user.
-- The app stores the token in localStorage; Supabase validates it here.
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token      VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()) NOT NULL
);

-- Index for fast token look-ups on every page load
CREATE INDEX IF NOT EXISTS idx_user_sessions_token
    ON public.user_sessions (token);

-- Index for cleaning up expired sessions by user
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
    ON public.user_sessions (user_id);


-- ── STEP 6: Row-Level Security ────────────────────────────────────────────
-- Because we are NOT using Supabase auth.users, we cannot use auth.uid().
-- Two safe options are provided — choose ONE based on your deployment:

-- ── OPTION A (Recommended for internal/intranet apps):
--    Disable RLS on Phase 1 tables. Security is enforced inside the app by
--    validating the session token in authService.js before any query.
ALTER TABLE public.users         DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments   DISABLE ROW LEVEL SECURITY;

-- ── OPTION B (More secure — server-side enforcement via RPC):
--    Uncomment the lines below to enable RLS and create a helper function
--    that downstream RPC functions can use to resolve user identity.
--
-- ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.departments   ENABLE ROW LEVEL SECURITY;
--
-- CREATE OR REPLACE FUNCTION public.resolve_session(p_token TEXT)
-- RETURNS UUID AS $$
--     SELECT user_id FROM public.user_sessions
--     WHERE token = p_token AND expires_at > now()
--     LIMIT 1;
-- $$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ── STEP 7: Verify the setup ──────────────────────────────────────────────
-- Run these SELECTs after the script to confirm everything looks correct.

-- Should return 3 rows (admin, user, user2):
SELECT username, full_name, role FROM public.users;

-- Should return 7 rows (departments):
SELECT name FROM public.departments;
