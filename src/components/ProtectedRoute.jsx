import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, needsOnboarding } from '../store/authStore';
import { usePlannerStore } from '../store/plannerStore';
import FrogLogo from './FrogLogo';

const ProtectedRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuthStore();
  const fetchPlannerData = usePlannerStore((state) => state.fetchPlannerData);

  useEffect(() => {
    if (user?.id) {
      fetchPlannerData(user.id);
    }
  }, [user?.id, fetchPlannerData]);

  // Wait for the async session check (Supabase) to complete
  // before making a redirect decision — avoids flashing /login on refresh.
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <FrogLogo className="w-16 h-16 animate-bounce select-none" />
          <p className="text-sm font-semibold text-gray-400 tracking-wide">Loading Frog Planner…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // A Google signup lands here with a real session but an unfinished profile.
  // Send them to the wizard rather than into a half-configured app.
  if (needsOnboarding(user)) {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;