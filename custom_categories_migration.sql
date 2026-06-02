-- Migration to add custom_categories to the users table
-- Adds a text array column to store user-defined task categories, pre-populated with defaults.

ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS custom_categories text[] NOT NULL DEFAULT '{Work, Meeting, Call, Personal, Review, Break, Health}'::text[];
