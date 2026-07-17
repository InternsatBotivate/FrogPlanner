import React from 'react';
import { Sparkles, Globe } from 'lucide-react';
import FrogLogo from '../../components/FrogLogo';

/**
 * Developers — credits page for the team behind FrogPlanner.
 * Mirrors the mobile app's Developers screen: Botivate's Team AI, no
 * individual names. Edit TEAMS to update credits.
 */
const TEAMS = [
  {
    key: 'ai',
    icon: Sparkles,
    name: 'Team AI · Botivate',
    blurb:
      'Developers from Botivate’s Team AI built this application — the planner, projects, calendar, and the AI Assistant that powers planner-aware chat.',
  },
];

const Developers = () => {
  return (
    <div className="p-4 md:p-6 space-y-5 bg-white max-w-4xl mx-auto overflow-y-auto scrollbar-hide">

      {/* ── Hero Banner ── */}
      <div className="relative bg-gradient-to-br from-green-600 to-green-800 rounded-2xl p-6 overflow-hidden shadow-lg">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/10 pointer-events-none">
          <FrogLogo className="w-32 h-32 opacity-10 select-none" />
        </div>
        <div className="relative z-10 space-y-2.5">
          <span className="inline-block bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full">
            Credits
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
            The team behind Frog Planner
          </h1>
          <p className="text-sm text-green-100/90 max-w-xl font-medium leading-relaxed">
            Crafted by developers from <span className="font-bold text-yellow-300">Botivate’s Team AI</span>.
          </p>
        </div>
      </div>

      {/* ── Team Cards ── */}
      {TEAMS.map((team) => {
        const Icon = team.icon;
        return (
          <div key={team.key} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center">
                <Icon size={20} className="text-green-600" />
              </div>
              <h2 className="text-base font-extrabold text-gray-800">{team.name}</h2>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">{team.blurb}</p>
          </div>
        );
      })}

      {/* ── Powered by Botivate ── */}
      <a
        href="https://www.botivate.in"
        target="_blank"
        rel="noopener noreferrer"
        className="block bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-1.5 hover:bg-green-100 transition-colors"
      >
        <p className="text-sm font-extrabold text-gray-800">Powered by Botivate</p>
        <p className="text-xs font-bold text-green-700 flex items-center justify-center gap-1.5">
          <Globe size={13} />
          www.botivate.in
        </p>
      </a>

    </div>
  );
};

export default Developers;
