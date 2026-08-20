import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, Menu } from 'lucide-react';
import FrogLogo from './FrogLogo';

const Header = ({ onMenuClick, user }) => {
  const { pathname } = useLocation();
  const routeTitles = {
    '/dashboard': ['Dashboard', 'Your planning overview'],
    '/planner': ['Today', 'Plan and complete today’s work'],
    '/all-tasks': ['All tasks', 'Review work across every date'],
    '/next-day-planner': ['Next day', 'Prepare tomorrow with intention'],
    '/my-projects': ['Projects', 'Organise related work'],
    '/calendar': ['Calendar', 'See your schedule over time'],
    '/recurring-tasks': ['Recurring tasks', 'Manage repeat routines'],
    '/ai-assistant': ['AI assistant', 'Turn ideas into practical plans'],
    '/about-frog-planner': ['About Frog Planner', 'A focused way to plan'],
    '/developers': ['Developers', 'Integration reference'],
    '/settings': ['Settings', 'Account and planner preferences'],
  };
  const projectRoute = pathname.startsWith('/my-projects/') ? ['Project', 'Tasks and progress'] : null;
  const [title, subtitle] = projectRoute || routeTitles[pathname] || ['Frog Planner', 'Focused daily planning'];

  return (
    <header className="app-topbar">
      <div className="app-topbar__inner">

        {/* Left Section: Mobile Menu */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenuClick}
            className="app-icon-button lg:hidden"
            aria-label="Open navigation"
          >
            <Menu size={19} />
          </button>
          <div className="min-w-0">
            <h1 className="app-topbar__title">{title}</h1>
            <p className="app-topbar__subtitle">{subtitle}</p>
          </div>
        </div>

        {/* Right Section: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">

          <Link to="/settings" className="app-icon-button" aria-label="Open settings">
            <Settings size={17} />
          </Link>

          <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

          {/* User Profile */}
          <Link to="/settings" className="app-profile group">
            <div className="hidden md:block text-right">
              <p className="text-xs font-semibold text-slate-800 group-hover:text-emerald-800 transition-colors leading-tight">
                {user?.full_name || user?.username || 'User'}
              </p>
            </div>
            {/* User avatar, falling back to the frog mark when none is set */}
            <div className="app-profile__avatar">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <FrogLogo className="w-full h-full object-cover" />
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
};

export default Header;
