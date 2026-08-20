import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuthStore } from '../store/authStore';

const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const handleToggleCollapse = (collapsed) => {
    setIsCollapsed(collapsed);
    localStorage.setItem('sidebar_collapsed', collapsed ? 'true' : 'false');
    // Dispatch resize event immediately to start transition adjustments
    window.dispatchEvent(new Event('resize'));
    // Dispatch resize event again after transition ends to finalize layout size
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 320);
  };

  const { user } = useAuthStore();

  return (
    <div className="app-shell">

      {/* Sidebar - Fixed on desktop, sliding on mobile */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapse}
      />

      {/* Main Content Area */}
      <div className={`app-main-column ${
        isCollapsed ? 'lg:ml-[72px]' : 'lg:ml-60'
      }`}>

        {/* Header - Sticky */}
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          user={user}
        />

        <main className="app-content">
          <div className="app-content__inner">
            <Outlet />
          </div>
        </main>

      </div>
    </div>
  );
};

export default Layout;
