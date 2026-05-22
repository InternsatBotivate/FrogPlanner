// =====================================================================
// FrogPlanner — Vercel Serverless Node.js Function
// Location: api/create-recurring-tasks.js
// =====================================================================

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // CORS configuration for flexibility (in case of cross-origin cron trigger)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Optional: basic authentication checking if CRON_SECRET is configured
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized invocation' });
  }

  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return res.status(500).json({
        error: 'Missing configurations: VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY'
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Call the database function via RPC for all users globally
    const { data, error } = await supabase.rpc('create_recurring_tasks_for_all_users');

    if (error) {
      throw error;
    }

    return res.status(200).json({
      message: 'Global recurring tasks creation routine executed successfully.',
      result: data
    });
  } catch (error) {
    console.error('[API Create-Recurring-Tasks] Execution Error:', error);
    return res.status(500).json({ error: error.message });
  }
}
