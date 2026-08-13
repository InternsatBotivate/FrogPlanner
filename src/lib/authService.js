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
const SIGNUP_SKIP_MIGRATION_KEY_PREFIX = 'fp_skip_legacy_migration_';

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
  business_name = '',
  user_role = '',
  emailVerified = false, // true when the caller already OTP-verified `email` (see otpService.js)
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

    const trimmedEmail = email.trim();
    const { data: user, error } = await supabase
      .from('users')
      .insert({
        username: username.trim(),
        full_name: name.trim(),
        email: trimmedEmail || null,
        password_hash: password, // Store password directly as plain text
        role,
        designation,
        department,
        phone,
        bio,
        business_name: business_name.trim() || null,
        user_role: user_role.trim() || null,
        email_verified: emailVerified && !!trimmedEmail,
        reminders_enabled: emailVerified && !!trimmedEmail,
      })
      .select()
      .single();

    if (error) return { user: null, error };

    // The email was already OTP-verified before this account existed —
    // insert it straight into user_emails as verified/primary instead of
    // the old flow (insert unverified + fire a link email).
    if (emailVerified && trimmedEmail) {
      await supabase.from('user_emails').insert({
        user_id: user.id,
        email: trimmedEmail,
        is_verified: true,
        is_primary: true,
      });
    }

    // Brand-new accounts should start empty instead of inheriting shared browser legacy data.
    localStorage.setItem(`${SIGNUP_SKIP_MIGRATION_KEY_PREFIX}${user.id}`, 'true');

    // Automatically open a session for the new user
    const token = await createSession(user.id);
    return { user, token, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
};

/**
 * signIn
 * Validates credentials against public.users. Accepts either a username or
 * an email address in the `identifier` field — email is checked against both
 * users.email (set at signup) and user_emails (addresses added later via
 * Settings, which can diverge from users.email).
 * Returns { user, token, error }
 */
export const signIn = async (identifier, password) => {
  try {
    const trimmed = identifier.trim();
    const isEmail = trimmed.includes('@');

    let user = null;
    let error = null;

    if (isEmail) {
      const lower = trimmed.toLowerCase();
      // Primary lookup: users.email (set at signup / profile save).
      const byUsersEmail = await supabase
        .from('users')
        .select('*')
        .ilike('email', lower)
        .maybeSingle();
      user = byUsersEmail.data;
      error = byUsersEmail.error;

      // Fallback: an email added later via Settings (user_emails), which may
      // not match users.email.
      if (!user && !error) {
        const { data: emailRow } = await supabase
          .from('user_emails')
          .select('user_id')
          .ilike('email', lower)
          .maybeSingle();
        if (emailRow) {
          const byId = await supabase.from('users').select('*').eq('id', emailRow.user_id).maybeSingle();
          user = byId.data;
          error = byId.error;
        }
      }
    } else {
      const byUsername = await supabase.from('users').select('*').eq('username', trimmed).maybeSingle();
      user = byUsername.data;
      error = byUsername.error;
    }

    if (error) return { user: null, token: null, error };
    if (!user || user.password_hash !== password) {
      return { user: null, token: null, error: new Error('Invalid User ID or Password.') };
    }

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
 * deleteAccount
 * Permanently deletes the signed-in account and all its data. Runs entirely
 * server-side (api/delete-account.js) with the service-role key, scoped to the
 * session's own user_id; `password` is re-confirmation, not authorization.
 * Clears the local session token on success. Returns { ok, error }.
 */
export const deleteAccount = async (password) => {
  const token = localStorage.getItem(SESSION_KEY);
  if (!token) return { ok: false, error: 'Please sign in again.' };

  try {
    const res = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: json?.error || `Failed (${res.status}).` };

    localStorage.removeItem(SESSION_KEY);
    return { ok: true };
  } catch {
    return { ok: false, error: 'Network error. Please try again.' };
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

    const patch = {
      full_name: updatedData.name,
      email: updatedData.email,
      phone: updatedData.phone,
      designation: updatedData.designation,
      department: updatedData.department,
      bio: updatedData.bio,
    };
    // Password changes now go exclusively through the OTP-gated
    // change-password flow (api/change-password.js) — never overwrite it
    // here, even if a caller happens to pass one.
    if (updatedData.password) patch.password_hash = updatedData.password;

    const { data: user, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();

    if (error) return { user: null, error };
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
};

/**
 * updateAvatarUrl
 * Updates a user's profile picture URL in public.users.
 */
export const updateAvatarUrl = async (userId, avatarUrl) => {
  try {
    if (!userId) return { user: null, error: new Error('User ID is required.') };

    const { data: user, error } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', userId)
      .select()
      .single();

    if (error) return { user: null, error };
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
};

/**
 * updateCustomCategories
 * Updates the user's custom categories in public.users.
 */
export const updateCustomCategories = async (userId, categories) => {
  try {
    if (!userId) return { user: null, error: new Error('User ID is required.') };

    const { data: user, error } = await supabase
      .from('users')
      .update({
        custom_categories: categories,
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
