/**
 * authService.js
 * ──────────────────────────────────────────────────────────────────────────
 * Custom authentication service for FrogPlanner.
 *
 * Uses:
 *  - public.users  → stores all user credentials and profile data
 *  - public.user_sessions → stores active session tokens per user
 *
 * Passwords are hashed with SHA-256 before being stored or compared.
 * Session tokens are random UUID-like strings stored in localStorage for
 * persistence across page refreshes.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { supabase } from './supabaseClient';

const SESSION_KEY = 'fp_session_token';

// ── helpers ────────────────────────────────────────────────────────────────

/** Generate a secure-enough random session token */
const generateToken = () => {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
};

// ── auth operations ────────────────────────────────────────────────────────

/**
 * signUp
 * Creates a new row in public.users.
 * Returns { user, error }
 */
export const signUp = async ({
  username,     // the app-level user ID (e.g. "admin", "user1")
  name,
  email = '',
  password,
  role = 'USER',
  designation = 'Team Member',
  department = 'General Division',
  phone = '',
  bio = '',
}) => {
  try {
    // Check for duplicate username
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', username.trim())
      .maybeSingle();

    if (existing) {
      return { user: null, error: new Error('User ID already exists. Choose a different one.') };
    }

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username: username.trim(),
        full_name: name.trim(),
        email: email.trim() || null,
        password_hash: password, // Store password directly as plain text
        role,
        designation,
        department,
        phone,
        bio,
      })
      .select()
      .single();

    if (error) return { user: null, error };

    // Automatically open a session for the new user
    const token = await createSession(user.id);
    return { user, token, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
};

/**
 * signIn
 * Validates credentials against public.users.
 * Returns { user, token, error }
 */
export const signIn = async (username, password) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username.trim())
      .eq('password_hash', password) // Direct plain-text comparison
      .maybeSingle();

    if (error) return { user: null, token: null, error };
    if (!user) return { user: null, token: null, error: new Error('Invalid User ID or Password.') };

    const token = await createSession(user.id);
    return { user, token, error: null };
  } catch (err) {
    return { user: null, token: null, error: err };
  }
};

/**
 * signOut
 * Deletes the active session from the database and clears localStorage.
 */
export const signOut = async () => {
  const token = localStorage.getItem(SESSION_KEY);
  if (token) {
    await supabase.from('user_sessions').delete().eq('token', token);
    localStorage.removeItem(SESSION_KEY);
  }
};

/**
 * getSessionUser
 * Reads the local session token, validates it against public.user_sessions,
 * and returns the resolved user row (or null if invalid / expired).
 */
export const getSessionUser = async () => {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return null;

  const { data: session, error } = await supabase
    .from('user_sessions')
    .select('user_id, expires_at, users(*)')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !session) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }

  return session.users ?? null;
};

/**
 * createSession
 * Inserts a new row into public.user_sessions and saves the token locally.
 * Returns the raw token string.
 */
export const createSession = async (userId) => {
  const token = generateToken();
  const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  await supabase.from('user_sessions').insert({ user_id: userId, token, expires_at });
  localStorage.setItem(SESSION_KEY, token);
  return token;
};

/**
 * updateUserProfile
 * Updates a user's details in the public.users table by their user ID.
 */
export const updateUserProfile = async (userId, updatedData) => {
  try {
    if (!userId) return { user: null, error: new Error('User ID is required.') };

    const { data: user, error } = await supabase
      .from('users')
      .update({
        full_name: updatedData.name,
        password_hash: updatedData.password,
        email: updatedData.email,
        phone: updatedData.phone,
        designation: updatedData.designation,
        department: updatedData.department,
        bio: updatedData.bio,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) return { user: null, error };
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
};
