-- =====================================================================
-- FrogPlanner — SQL Migration
-- Add Business Fields to public.users Table
-- Location: signup_migration.sql
-- =====================================================================

-- Run this command in your Supabase project's SQL Editor:
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS user_role text;
