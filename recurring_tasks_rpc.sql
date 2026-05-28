-- =====================================================================
-- FrogPlanner — Postgres RPC function for creating recurring tasks
-- Run this script in your Supabase SQL Editor
-- ( https://supabase.com/dashboard/project/<your-project>/sql/new )
-- =====================================================================

-- Clean up the previous single-user function if it was already created
DROP FUNCTION IF EXISTS public.create_recurring_tasks_for_user(UUID);

CREATE OR REPLACE FUNCTION public.create_recurring_tasks_for_all_users()
RETURNS JSON AS $$
DECLARE
    v_count INT := 0;
    v_today DATE := (timezone('Asia/Kolkata', now()))::date;

BEGIN
    -- Insert new tasks for ALL users from active recurring templates (from the recurring_tasks table)
    -- Prevent duplicate insertion for the same IST date

    INSERT INTO public.tasks (
        user_id,
        description,
        duration,
        category,
        priority,
        task_date,
        select_value,
        remarks,
        time_slot
    )
    SELECT 
        t.user_id,
        t.description,
        t.time_slot::text::public.task_duration, -- cast to public.task_duration for tasks.duration
        t.category,
        t.priority,
        v_today,          -- Correct IST date
        'Select',         
        t.remarks,
        t.time_slot::text::public.task_time_slot -- cast to public.task_time_slot for tasks.time_slot

    FROM public.recurring_tasks t

    WHERE t.is_active = true
      AND NOT EXISTS (
          SELECT 1
          FROM public.tasks e
          WHERE e.user_id = t.user_id
            AND e.description = t.description
            AND e.duration::text = t.time_slot::text
            AND e.category = t.category
            AND e.task_date = v_today
      );

    GET DIAGNOSTICS v_count = ROW_COUNT;

    RETURN json_build_object(
        'success', true,
        'date', v_today,
        'inserted_count', v_count
    );

EXCEPTION WHEN OTHERS THEN

    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
