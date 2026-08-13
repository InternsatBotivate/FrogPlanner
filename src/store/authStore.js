/**
 * authStore.js  (Zustand)
 * ──────────────────────────────────────────────────────────────────────────
 * Global authentication state.
 * Delegates all Supabase / credential logic to src/lib/authService.js.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { create } from 'zustand';
import { signIn, signUp, signOut, deleteAccount, getSessionUser, updateUserProfile, updateCustomCategories, updateAvatarUrl } from '../lib/authService';

const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  /**
   * login
   * Validates credentials via Supabase → public.users.
   * Returns { error } so callers can surface messages.
   */
  login: async (username, password) => {
    const { user, error } = await signIn(username, password);
    if (user) {
      set({ user, isAuthenticated: true });
    }
    return { error };
  },

  /**
   * register
   * Creates a new user and immediately sets an authenticated session.
   * Returns { error } so callers can surface messages.
   */
  register: async (userData) => {
    const { user, error } = await signUp(userData);
    if (user) {
      set({ user, isAuthenticated: true });
    }
    return { error };
  },

  /**
   * logout
   * Signs out from Supabase session registry and clears state.
   */
  logout: async () => {
    await signOut();
    // Clear Google Calendar session tokens so the next login always starts
    // fresh. The Supabase connection record (google_email) is preserved so
    // the useGoogleCalendar hook can silently re-auth on next sign-in.
    sessionStorage.removeItem('gc_token');
    sessionStorage.removeItem('gc_events');
    set({ user: null, isAuthenticated: false });
  },

  /**
   * removeAccount
   * Permanently deletes the account and all its data, then clears local state
   * exactly like logout. `password` re-confirms the destructive action.
   * Returns { ok, error } so the caller can surface messages.
   */
  removeAccount: async (password) => {
    const res = await deleteAccount(password);
    if (!res.ok) return res;

    sessionStorage.removeItem('gc_token');
    sessionStorage.removeItem('gc_events');
    set({ user: null, isAuthenticated: false });
    return { ok: true };
  },

  /**
   * initializeAuth
   * Called once on app mount (App.jsx useEffect).
   * Reads the saved session token → resolves the user row from Supabase.
   */
  initializeAuth: async () => {
    set({ loading: true });
    const user = await getSessionUser();
    set({
      user: user ?? null,
      isAuthenticated: !!user,
      loading: false,
    });
  },

  /**
   * updateProfile
   * Updates the authenticated user's profile in Supabase and the local store state.
   */
  updateProfile: async (updatedData) => {
    const state = useAuthStore.getState();
    if (!state.user?.id) return { error: new Error('Not authenticated') };
    
    const { user, error } = await updateUserProfile(state.user.id, updatedData);
    if (user) {
      set({ user });
    }
    return { error };
  },

  /**
   * updateAvatar
   * Updates the authenticated user's profile picture URL in Supabase and local store.
   */
  updateAvatar: async (avatarUrl) => {
    const state = useAuthStore.getState();
    if (!state.user?.id) return { error: new Error('Not authenticated') };

    const { user, error } = await updateAvatarUrl(state.user.id, avatarUrl);
    if (user) {
      set({ user });
    }
    return { error };
  },

  /**
   * updateCustomCategories
   * Updates the authenticated user's custom categories list in Supabase and local store.
   */
  updateCustomCategories: async (categories) => {
    const state = useAuthStore.getState();
    if (!state.user?.id) return { error: new Error('Not authenticated') };

    const { user, error } = await updateCustomCategories(state.user.id, categories);
    if (user) {
      set({ user });
    }
    return { error };
  },
}));

export { useAuthStore };
