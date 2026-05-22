import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Settings,
  LogOut as LogOutIcon,
  X,
  Users,
  LayoutGrid,
  Calendar,
  CalendarDays,
  CalendarRange,
  Sparkles,
  BarChart2,
  ListTodo,
  FolderClosed,
  ChevronLeft,
  ChevronRight,
  HelpCircle
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { usePlannerStore } from '../store/plannerStore';

const Sidebar = ({ isOpen, onClose, isCollapsed, setIsCollapsed }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    usePlannerStore.getState().resetStore();
    logout();
    navigate('/login', { replace: true });
  };

  const menuItems = [
    { path: '/dashboard', icon: BarChart2, label: 'Dashboard' },
    { path: '/planner', icon: Calendar, label: 'Today' },
    { path: '/next-day-planner', icon: CalendarRange, label: 'Next Day Planner' },
    { path: '/all-tasks', icon: ListTodo, label: 'All Tasks' },
    { path: '/my-projects', icon: FolderClosed, label: 'My Projects' },
    { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
    { path: '/index', icon: LayoutGrid, label: 'Recurring Tasks' },
    { path: '/ai-assistant', icon: Sparkles, label: 'AI Assistant' },
    { path: '/about-frog-planner', icon: '🐸', label: 'About Frog Planner' },
    { path: '/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full bg-white border-r border-green-100 z-50 transform transition-all duration-300 ease-in-out lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-64 sm:w-72 lg:w-16' : 'w-64 sm:w-72 lg:w-56 2xl:w-60'
        }`}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className={`p-4 border-b border-green-100 flex ${isCollapsed ? 'lg:flex-col lg:items-center' : 'items-center justify-between'} gap-3`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-50 border border-green-200 rounded-lg flex items-center justify-center flex-shrink-0 text-lg">
                🐸
              </div>
              {!isCollapsed && (
                <span className="text-xl font-bold text-green-700 tracking-tight animate-in fade-in duration-200">
                  Frog Planner
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Desktop Collapse Button */}
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="hidden lg:flex p-1.5 hover:bg-green-50 text-green-700 rounded-lg transition active:scale-95 border border-green-200 bg-white"
                title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              >
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
              </button>

              {/* Mobile close button */}
              <button onClick={onClose} className="lg:hidden p-2 hover:bg-green-100/50 rounded-lg">
                <X size={20} className="text-green-700" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className={`flex-1 overflow-y-auto py-4 ${isCollapsed ? 'lg:px-1.5' : 'px-3'} space-y-1 scrollbar-hide`}>
            {menuItems.map((item, idx) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center ${isCollapsed ? 'lg:justify-center' : 'justify-between'} px-4 py-3 rounded-lg transition-all duration-200 group
                  ${isActive
                    ? 'bg-green-50 text-emerald-700 border-l-4 border-emerald-600'
                    : 'text-gray-700 hover:bg-green-50/60 hover:text-emerald-700 border-l-4 border-transparent'}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <div className="flex items-center gap-3">
                  {typeof item.icon === 'string' ? (
                    <span className="text-[17px] w-5 h-5 flex items-center justify-center group-hover:scale-110 transition-transform flex-shrink-0 animate-in fade-in duration-200 select-none">
                      {item.icon}
                    </span>
                  ) : (
                    <item.icon size={20} className="group-hover:scale-110 transition-transform flex-shrink-0 animate-in fade-in duration-200" />
                  )}
                  {!isCollapsed && (
                    <span className="text-sm font-semibold leading-tight whitespace-nowrap animate-in fade-in duration-250">
                      {item.label}
                    </span>
                  )}
                </div>
              </NavLink>
            ))}
          </nav>

          {/* User Profile Section */}
          <div className={`p-4 border-t border-green-100 bg-green-50/30 space-y-3.5 flex flex-col ${isCollapsed ? 'lg:items-center' : ''}`}>
            <button
              onClick={handleLogout}
              className={`flex items-center justify-center gap-2 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-500 hover:text-white transition-all font-semibold shadow-sm ${isCollapsed ? 'lg:w-10 lg:h-10 lg:p-0' : 'w-full px-4 py-2.5'
                }`}
              title={isCollapsed ? "Sign Out" : undefined}
            >
              <LogOutIcon size={18} />
              {!isCollapsed && <span className="animate-in fade-in duration-200">Sign Out</span>}
            </button>

            {!isCollapsed && (
              <div className="text-center w-full animate-in fade-in duration-200">
                <p className="text-[10px] md:text-[11px] font-bold text-green-700">
                  Powered By <a
                    href="https://www.botivate.in"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-700 hover:text-green-900 font-extrabold hover:underline transition-all"
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