import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Settings,
  LogOut as LogOutIcon,
  X,
  Code2,
  LayoutGrid,
  Calendar,
  CalendarDays,
  CalendarRange,
  BarChart2,
  ListTodo,
  FolderClosed,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePlannerStore } from '../store/plannerStore';
import FrogLogo from './FrogLogo';

const Sidebar = ({ isOpen, onClose, isCollapsed, setIsCollapsed }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    usePlannerStore.getState().resetStore();
    logout();
    navigate('/login', { replace: true });
  };

  const menuItems = [
    { path: '/dashboard', icon: BarChart2, label: 'Dashboard', group: 'Plan' },
    { path: '/planner', icon: Calendar, label: 'Today', group: 'Plan' },
    { path: '/next-day-planner', icon: CalendarRange, label: 'Next day', group: 'Plan' },
    { path: '/all-tasks', icon: ListTodo, label: 'All tasks', group: 'Workspace' },
    { path: '/my-projects', icon: FolderClosed, label: 'Projects', group: 'Workspace' },
    { path: '/calendar', icon: CalendarDays, label: 'Calendar', group: 'Workspace' },
    { path: '/recurring-tasks', icon: LayoutGrid, label: 'Recurring tasks', group: 'Workspace' },
    { path: '/ai-assistant', icon: 'frog-logo', label: 'AI assistant', group: 'Tools' },
    { path: '/about-frog-planner', icon: CircleHelp, label: 'About', group: 'Tools' },
    { path: '/developers', icon: Code2, label: 'Developers', group: 'Tools' },
    { path: '/settings', icon: Settings, label: 'Settings', group: 'Account' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-950/35 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`app-sidebar ${isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-64 sm:w-72 lg:w-[72px]' : 'w-64 sm:w-72 lg:w-60'
        }`}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className={`app-sidebar__brand ${isCollapsed ? 'lg:flex-col lg:items-center' : 'items-center justify-between'} gap-3`}>
            <div className="flex items-center gap-3">
              <div className="app-brand-mark">
                <FrogLogo className="w-full h-full object-cover" />
              </div>
              {!isCollapsed && (
                <span className="text-[17px] font-bold text-slate-900 tracking-[-0.02em] animate-in fade-in duration-200 whitespace-nowrap">
                  Frog Planner
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Desktop Collapse Button */}
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="app-icon-button hidden lg:flex"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>

              {/* Mobile close button */}
              <button onClick={onClose} className="app-icon-button lg:hidden" aria-label="Close navigation">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto py-4 ${isCollapsed ? 'lg:px-2' : 'px-3'} scrollbar-hide`}>
            {menuItems.map((item, idx) => (
              <React.Fragment key={item.path}>
              {(idx === 0 || menuItems[idx - 1].group !== item.group) && !isCollapsed && (
                <p className="app-nav-group">{item.group}</p>
              )}
              <NavLink
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  app-nav-item ${isCollapsed ? 'lg:justify-center lg:px-0' : ''}
                  ${isActive
                    ? 'app-nav-item--active'
                    : ''}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  {item.icon === 'frog-logo' ? (
                    <FrogLogo className="w-[18px] h-[18px] object-contain flex-shrink-0 select-none" />
                  ) : typeof item.icon === 'string' ? (
                    <span className="text-[17px] w-5 h-5 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0 animate-in fade-in duration-200 select-none">
                      {item.icon}
                    </span>
                  ) : (
                    <item.icon size={18} strokeWidth={1.9} className="flex-shrink-0" />
                  )}
                  {!isCollapsed && (
                    <span className="text-[13px] font-semibold leading-tight whitespace-nowrap animate-in fade-in duration-250">
                      {item.label}
                    </span>
                  )}
                </div>
              </NavLink>
              </React.Fragment>
            ))}
          </nav>

          {/* User Profile Section */}
          <div className={`app-sidebar__footer flex flex-col ${isCollapsed ? 'lg:items-center' : ''}`}>
            <button
              onClick={handleLogout}
              className={`app-signout ${isCollapsed ? 'lg:w-9 lg:h-9 lg:p-0' : 'w-full px-3 py-2'
                }`}
              title={isCollapsed ? "Sign Out" : undefined}
            >
              <LogOutIcon size={18} />
              {!isCollapsed && <span className="animate-in fade-in duration-200">Sign Out</span>}
            </button>

            {!isCollapsed && (
              <div className="text-center w-full animate-in fade-in duration-200">
                <p className="text-[10px] font-semibold text-slate-400">
                  Powered by <a
                    href="https://www.botivate.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-slate-600 hover:text-emerald-800 font-bold transition-colors"
                  >
                    Botivate
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
