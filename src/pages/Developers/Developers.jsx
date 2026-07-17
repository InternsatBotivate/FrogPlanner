import React from 'react';
import { BrainCircuit, CalendarCheck, Code2, Globe, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import FrogLogo from '../../components/FrogLogo';

/**
 * Developers — credits page for Botivate's team behind FrogPlanner.
 * Keep credits team-based only; do not add individual developer names.
 */
const TEAMS = [
  {
    key: 'product',
    icon: UsersRound,
    title: 'Product planning',
    blurb:
      'Botivate’s team shaped FrogPlanner around focused daily planning, projects, recurring routines, and the Eat the Frog workflow.',
  },
  {
    key: 'engineering',
    icon: Code2,
    title: 'Web and app engineering',
    blurb:
      'The team built the web application and mobile experience together, keeping navigation, task flows, calendar views, and project tools aligned.',
  },
  {
    key: 'assistant',
    icon: Sparkles,
    title: 'Planner-aware AI',
    blurb:
      'Botivate’s team connected the AI Assistant to FrogPlanner context so it can help with priorities, scheduling, task breakdowns, and next actions.',
  },
  {
    key: 'quality',
    icon: ShieldCheck,
    title: 'Reliability and care',
    blurb:
      'The team continues refining layouts, authentication, data sync, notifications, and interface details so FrogPlanner feels consistent across screens.',
  },
];

const HIGHLIGHTS = [
  { icon: CalendarCheck, label: 'Daily planner, calendar, projects, and recurring tasks' },
  { icon: BrainCircuit, label: 'AI assistance designed around real planner data' },
  { icon: Globe, label: 'Web and app interfaces powered by Botivate' },
];

const Developers = () => {
  return (
    <div className="p-4 md:p-6 space-y-5 bg-white max-w-5xl mx-auto overflow-y-auto scrollbar-hide">

      {/* ── Hero Banner ── */}
      <div className="relative bg-gradient-to-br from-green-600 via-emerald-700 to-green-900 rounded-2xl p-6 md:p-8 overflow-hidden shadow-lg">
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-white/10 pointer-events-none">
          <FrogLogo className="w-36 h-36 md:w-44 md:h-44 opacity-10 select-none" />
        </div>
        <div className="relative z-10 space-y-3">
          <span className="inline-block bg-yellow-400/20 border border-yellow-400/40 text-yellow-300 text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full">
            Credits
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
            Built by Botivate’s team
          </h1>
          <p className="text-sm md:text-base text-green-100/90 max-w-2xl font-medium leading-relaxed">
            FrogPlanner is designed and developed by Botivate’s team across product thinking, interface design, application engineering, and AI-assisted planning. This page credits the team behind the work without listing individual names.
          </p>
        </div>
      </div>

      {/* ── Highlights ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white border border-green-200 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-green-700" />
              </div>
              <p className="text-sm font-bold text-gray-800 leading-snug">{item.label}</p>
            </div>
          );
        })}
      </div>

      {/* ── Team Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEAMS.map((team) => {
          const Icon = team.icon;
          return (
            <div key={team.key} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center shrink-0">
                  <Icon size={20} className="text-green-600" />
                </div>
                <h2 className="text-base font-extrabold text-gray-800">{team.title}</h2>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">{team.blurb}</p>
            </div>
          );
        })}
      </div>

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
