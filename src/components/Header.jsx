import React from 'react';
import { Bell, Settings, Menu } from 'lucide-react';

const Header = ({ onMenuClick, user }) => {
  return (
    <header className="sticky top-0 z-30 bg-white border-b border-green-100 shadow-[0_1px_4px_rgba(22,163,74,0.07)]">
      <div className="flex justify-between items-center h-14 px-4 sm:px-6 lg:px-8">

        {/* Left Section: Mobile Menu */}
        <div className="flex items-center gap-4 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-green-700 hover:bg-green-50 rounded-lg transition-colors"
          >
            <Menu size={22} />
          </button>
        </div>

        {/* Right Section: Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">

          <button className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all">
            <Settings size={18} />
          </button>

          <div className="h-7 w-px bg-green-100 mx-1 hidden sm:block" />

          {/* User Profile */}
          <div className="flex items-center gap-2.5 pl-1 group cursor-pointer">
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-gray-800 group-hover:text-green-700 transition-colors leading-tight">
                {user?.name || 'User'}
              </p>
              <p className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">
                {user?.role === 'ADMIN' ? 'Administrator' : 'Employee'}
              </p>
            </div>
            {/* Frog avatar with yellow ring for accent */}
            <div className="w-9 h-9 rounded-full bg-yellow-50 border-2 border-yellow-300 flex items-center justify-center group-hover:border-green-400 transition-all overflow-hidden shadow-sm text-lg select-none">
              🐸
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;