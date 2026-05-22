-- =====================================================================
-- FrogPlanner — Google Calendar Connections Table
-- Run this once in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/<your-project>/sql/new
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_google_connections (
  id           uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  is_connected boolean NOT NULL DEFAULT true,
  connected_at timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  updated_at   timestamp with time zone NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT user_google_connections_pkey PRIMARY KEY (id),
  CONSTRAINT user_google_connections_user_id_key UNIQUE (user_id)
);

-- Index for fast per-user lookups
CREATE INDEX IF NOT EXISTS idx_user_google_connections_user_id
  ON public.user_google_connections (user_id);
