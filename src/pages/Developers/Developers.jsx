import React from 'react';
import { BrainCircuit, CalendarCheck, Code2, Globe, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { InfoHero, InfoIcon, InfoPage, InfoSectionTitle } from '../../components/InfoPage';

/**
 * Developers — credits page for Botivate's team behind Frog Planner.
 * Keep credits team-based only; do not add individual developer names.
 */
const TEAMS = [
  {
    key: 'product',
    icon: UsersRound,
    title: 'Product planning',
    blurb:
      'Botivate’s team shaped Frog Planner around focused daily planning, projects, recurring routines, and the Tackle-Your-Frog-First workflow.',
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
      'Botivate’s team connected the AI Assistant to Frog Planner context so it can help with priorities, scheduling, task breakdowns, and next actions.',
  },
  {
    key: 'quality',
    icon: ShieldCheck,
    title: 'Reliability and care',
    blurb:
      'The team continues refining layouts, authentication, data sync, notifications, and interface details so Frog Planner feels consistent across screens.',
  },
];

const HIGHLIGHTS = [
  { icon: CalendarCheck, label: 'Daily planner, calendar, projects, and recurring tasks' },
  { icon: BrainCircuit, label: 'AI assistance designed around real planner data' },
  { icon: Globe, label: 'Web and app interfaces powered by Botivate' },
];

const Developers = () => {
  return (
    <InfoPage>
      <InfoHero
        eyebrow="Credits"
        title="Built by Botivate’s team"
        description={<>Frog Planner is designed and developed by Botivate’s team across product thinking, interface design, application engineering, and AI-assisted planning. This page recognises the team behind the work.</>}
      />

      {/* ── Highlights ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {HIGHLIGHTS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="info-card min-h-[94px] p-4 flex items-center gap-3">
              <InfoIcon icon={Icon} />
              <p className="text-[13px] font-semibold text-slate-800 leading-snug">{item.label}</p>
            </div>
          );
        })}
      </section>

      {/* ── Team Cards ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEAMS.map((team) => {
          const Icon = team.icon;
          return (
            <div key={team.key} className="info-card min-h-[174px] p-5 md:p-6 flex flex-col gap-4">
              <InfoSectionTitle icon={Icon}>{team.title}</InfoSectionTitle>
              <p className="text-[13px] text-slate-600 leading-7">{team.blurb}</p>
            </div>
          );
        })}
      </section>

      {/* ── Powered by Botivate ── */}
      <a
        href="https://www.botivate.in"
        target="_blank"
        rel="noopener noreferrer"
        className="info-card group flex min-h-[92px] items-center justify-between gap-4 p-5 md:px-6 hover:border-green-300 hover:bg-green-50/50 transition-colors"
      >
        <InfoSectionTitle icon={Globe} description="Product design and application engineering">Powered by Botivate</InfoSectionTitle>
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-green-700 group-hover:text-green-800">
          www.botivate.in <Globe size={13} />
        </span>
      </a>

    </InfoPage>
  );
};

export default Developers;
