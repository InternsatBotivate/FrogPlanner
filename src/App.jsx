import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import Settings from './pages/Settings';
import RecurringTasks from './pages/RecurringTasks/RecurringTasks';
import Planner from './pages/Planner/Planner';
import AllTasks from './pages/AllTasks/AllTasks';
import Calendar from './pages/Calendar/Calendar';
import AIAssistant from './pages/AIAssistant/AIAssistant';
import Dashboard from './pages/Dashboard/Dashboard';
import MyProject from './pages/MyProjects/MyProject';
import Myprojecttask from './pages/MyProjects/Myprojecttask';
import AboutFrogPlanner from './pages/AboutFrogPlanner/AboutFrogPlanner';
import Developers from './pages/Developers/Developers';
import UpcomingPlanner from './pages/UpcomingPlanner/UpcomingPlanner';
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy';
import DeleteAccount from './pages/DeleteAccount/DeleteAccount';

import ProtectedRoute from './components/ProtectedRoute';
import { initializeStorage } from './utils/storageManager';
import { useAuthStore } from './store/authStore';
import { usePlannerStore } from './store/plannerStore';

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    initializeStorage();
    initializeAuth();
  }, []);

  // Planner realtime: one subscription for the whole app, so every planner
  // page picks up edits made on mobile or in another tab without a refresh.
  useEffect(() => {
    const planner = usePlannerStore.getState();
    if (isAuthenticated && userId) planner.startRealtime(userId);
    else planner.stopRealtime();
    return () => usePlannerStore.getState().stopRealtime();
  }, [isAuthenticated, userId]);

  return (
    <div className="bg-white min-h-screen">
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public — must be reachable without auth for Google OAuth verification */}
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          {/* Public — account & data deletion (required by Google Play) */}
          <Route path="/delete-account" element={<DeleteAccount />} />
          
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="settings" element={<Settings />} />
            <Route path="recurring-tasks" element={<RecurringTasks />} />
            <Route path="planner" element={<Planner />} />
            <Route path="next-day-planner" element={<UpcomingPlanner />} />
            <Route path="all-tasks" element={<AllTasks />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="ai-assistant" element={<AIAssistant />} />
            <Route path="my-projects" element={<MyProject />} />
            <Route path="my-projects/:projectId" element={<Myprojecttask />} />
            <Route path="about-frog-planner" element={<AboutFrogPlanner />} />
            <Route path="developers" element={<Developers />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </div>
  );
}

export default App;