/**
 * googleCalendarService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Supabase service layer for persisting a user's Google Calendar connection.
 *
 * Table: public.user_google_connections
 *   - user_id      (uuid, FK → users.id)
 *   - google_email (text)   — used as login_hint for silent re-auth
 *   - is_connected (bool)   — false after explicit disconnect
 *   - connected_at (timestamptz)
 *   - updated_at   (timestamptz)
 * ──────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabaseClient';

/**
 * getGoogleConnection
 * Returns the stored Google connection record for a user, or null.
 * Called on app load to decide whether to attempt silent re-auth.
 */
export const getGoogleConnection = async (userId) => {
  if (!userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_google_connections')
      .select('google_email, is_connected, connected_at')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data; // { google_email, is_connected, connected_at } or null
  } catch (err) {
    console.error('[GoogleCalendarService] getGoogleConnection failed:', err);
    return null;
  }
};

/**
 * saveGoogleConnection
 * Upserts the Google connection for a user.
 * Called after a successful OAuth token is received.
 */
export const saveGoogleConnection = async (userId, googleEmail) => {
  if (!userId || !googleEmail) return false;
  try {
    const { error } = await supabase
      .from('user_google_connections')
      .upsert(
        {
          user_id: userId,
          google_email: googleEmail,
          is_connected: true,
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[GoogleCalendarService] saveGoogleConnection failed:', err);
    return false;
  }
};

/**
 * removeGoogleConnection
 * Marks the user's Google connection as disconnected (does NOT delete the row
 * so the google_email hint is preserved for a future explicit reconnect).
 */
export const removeGoogleConnection = async (userId) => {
  if (!userId) return false;
  try {
    const { error } = await supabase
      .from('user_google_connections')
      .update({ is_connected: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('[GoogleCalendarService] removeGoogleConnection failed:', err);
    return false;
  }
};
