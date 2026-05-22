/**
 * authStore.js  (Zustand)
 * ──────────────────────────────────────────────────────────────────────────
 * Global authentication state.
 * Delegates all Supabase / credential logic to src/lib/authService.js.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { create } from 'zustand';
import { signIn, signUp, signOut, getSessionUser, updateUserProfile } from '../lib/authService';

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
    set({ user: null, isAuthenticated: false });
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
}));

export { useAuthStore };
