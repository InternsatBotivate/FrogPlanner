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
BEGIN
    -- Insert new tasks for ALL users from active recurring templates (is_recurring = true, task_date IS NULL)
    -- checking for duplicate rows to prevent double insertion on the same day.
    INSERT INTO public.tasks (
        user_id,
        description,
        duration,
        category,
        priority,
        task_date,
        select_value,
        remarks,
        is_recurring,
        time_slot
    )
    SELECT 
        t.user_id,
        t.description,
        t.duration,
        t.category,
        t.priority,
        CURRENT_DATE, -- Creates the task for the current date (today)
        'Select',     -- Default UI state in daily planner
        t.remarks,
        false,        -- The generated task instances are not templates
        t.time_slot
    FROM public.tasks t
    WHERE t.is_recurring = true 
      AND t.task_date IS NULL
      AND NOT EXISTS (
          SELECT 1 
          FROM public.tasks e
          WHERE e.user_id = t.user_id
            AND e.description = t.description
            AND e.duration = t.duration
            AND e.category = t.category
            AND e.task_date = CURRENT_DATE
            AND e.is_recurring = false
      );
      
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    RETURN json_build_object(
        'success', true,
        'date', CURRENT_DATE,
        'inserted_count', v_count
    );
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
