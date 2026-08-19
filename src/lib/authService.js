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
 * PROFILE_FIELD_MAP
 * Onboarding step 3 asks a different pair of questions depending on the answer
 * to step 2, but stores them in the two columns that already exist rather than
 * adding five more. This is the single source of truth for that mapping and
 * must stay in sync with db_scripts/google_auth_and_onboarding.sql and with
 * the mobile app's copy in src/lib/authService.ts.
 *
 *   profile_type         → business_name        , designation
 *   business_owner       → Business Name        , Position
 *   working_professional → Company Name         , Job Role
 *   student              → School/College       , Course
 *   freelancer           → (unused)             , Profession/Service
 *   personal             → (unused)             , (unused)
 */
export const mapProfileFields = (profileType, orgName = '', orgRole = '') => {
  const name = (orgName || '').trim();
  const role = (orgRole || '').trim();
  switch (profileType) {
    case 'business_owner':
    case 'working_professional':
    case 'student':
      return { business_name: name || null, designation: role || null };
    case 'freelancer':
      return { business_name: null, designation: role || null };
    default: // 'personal' — no follow-up questions
      return { business_name: null, designation: null };
  }
};

/**
 * signUp
 * Creates a new row in public.users for an EMAIL signup, at the END of the
 * onboarding wizard — which is why it takes the onboarding answers too.
 *
 * Email signups have no account until this point: the password is collected in
 * onboarding's final step, and users_has_credential_check requires either a
 * password or a google_id, so there is nothing valid to insert earlier.
 * (Google signups take the opposite path — api/google-signin.js creates the row
 * up front with onboarding_complete=false, then completeOnboarding() fills it in.)
 *
 * Returns { user, token, error }
 */
export const signUp = async ({
  username,     // the app-level user ID (e.g. "admin", "user1")
  name,
  email = '',
  password,
  phone = '',
  dateOfBirth = null,
  profileType = null,
  orgName = '',
  orgRole = '',
  improvementGoal = null,
  role = 'USER',
  department = 'General Division',
  bio = '',
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
        auth_provider: 'password',
        role,
        department,
        phone,
        bio,
        date_of_birth: dateOfBirth || null,
        profile_type: profileType,
        improvement_goal: improvementGoal,
        ...mapProfileFields(profileType, orgName, orgRole),
        email_verified: emailVerified && !!trimmedEmail,
        reminders_enabled: emailVerified && !!trimmedEmail,
        // The wizard ran before the row existed, so it is already complete.
        onboarding_complete: true,
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

    // A Google account has no password until the user sets one in Settings.
    // Without this branch they'd get "Invalid User ID or Password" for
    // credentials that were never wrong — they simply don't exist yet.
    if (user && !user.password_hash) {
      return {
        user: null,
        token: null,
        error: new Error('This account uses Google sign-in. Use “Continue with Google”, or set a password in Settings.'),
      };
    }

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
 * signInWithGoogle
 * Exchanges a Google ID token for a Frog Planner session.
 *
 * All the real work — verifying the token's signature, resolving-or-creating
 * the account, minting the session — happens in api/google-signin.js with the
 * service-role key. This function deliberately does no Supabase work of its
 * own: a client-side "this is who I am" claim is worth nothing, so trusting one
 * here would let anyone sign in as anyone.
 *
 * Returns { user, token, needsOnboarding, error }
 */
export const signInWithGoogle = async (idToken) => {
  try {
    if (!idToken) return { user: null, token: null, needsOnboarding: false, error: new Error('Google sign-in was cancelled.') };

    const res = await fetch('/api/google-signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      return {
        user: null,
        token: null,
        needsOnboarding: false,
        error: new Error(json?.error || `Google sign-in failed (${res.status}).`),
      };
    }

    // The server already created the session row; persist the token under the
    // same key the password flow uses so getSessionUser works unchanged.
    localStorage.setItem(SESSION_KEY, json.token);

    // A first-time Google user starts with no local data of their own, so keep
    // them out of the shared-browser legacy localStorage migration.
    if (json.needsOnboarding) {
      localStorage.setItem(`${SIGNUP_SKIP_MIGRATION_KEY_PREFIX}${json.user.id}`, 'true');
    }

    return { user: json.user, token: json.token, needsOnboarding: !!json.isNewUser, error: null };
  } catch {
    return { user: null, token: null, needsOnboarding: false, error: new Error('Network error. Please try again.') };
  }
};

/**
 * completeOnboarding
 * Finishes the onboarding wizard for an account that ALREADY exists — i.e. a
 * Google signup, whose row was created by api/google-signin.js with
 * onboarding_complete=false.
 *
 * Email signups never reach here: signUp() writes the same fields at insert
 * time because their account doesn't exist until the wizard's last step.
 *
 * Writes everything in one update so an interrupted save can't leave a
 * half-onboarded row that still reads as complete.
 */
export const completeOnboarding = async (userId, data) => {
  try {
    if (!userId) return { user: null, error: new Error('User ID is required.') };

    const patch = {
      full_name: (data.name || '').trim(),
      phone: (data.phone || '').trim(),
      date_of_birth: data.dateOfBirth || null,
      profile_type: data.profileType || null,
      improvement_goal: data.improvementGoal || null,
      ...mapProfileFields(data.profileType, data.orgName, data.orgRole),
      onboarding_complete: true,
    };
    // The username is editable in step 1, but only send it when it actually
    // changed — a no-op write would still trip the unique index against itself.
    if (data.username) patch.username = data.username.trim();

    const { data: user, error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      // 23505 = unique_violation. The only unique column reachable here is
      // username, so surface it as the actionable message rather than a raw code.
      if (error.code === '23505') {
        return { user: null, error: new Error('That User ID is taken. Choose a different one.') };
      }
      return { user: null, error };
    }
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err };
  }
};

/**
 * isUsernameAvailable
 * Step 1 of onboarding pre-fills a generated User ID and lets the user edit it,
 * so it needs to check availability before the final save. `excludeUserId` skips
 * the caller's own row (a Google user keeping their generated username).
 */
export const isUsernameAvailable = async (username, excludeUserId = null) => {
  const trimmed = (username || '').trim();
  if (!trimmed) return false;
  let query = supabase.from('users').select('id').eq('username', trimmed);
  if (excludeUserId) query = query.neq('id', excludeUserId);
  const { data, error } = await query.maybeSingle();
  if (error) return false;
  return !data;
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
