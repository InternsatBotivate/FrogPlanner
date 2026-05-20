import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuthStore();

  // Wait for the async session check (Supabase) to complete
  // before making a redirect decision — avoids flashing /login on refresh.
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-3">
          <span className="text-5xl animate-bounce select-none">🐸</span>
          <p className="text-sm font-semibold text-gray-400 tracking-wide">Loading Frog Planner…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;