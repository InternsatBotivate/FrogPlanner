import React from 'react';
import FrogLogo from '../../components/FrogLogo';
import { InfoHero, InfoIcon, InfoPage, InfoSectionTitle } from '../../components/InfoPage';
import {
  Milestone, HelpCircle, Award, Play, ArrowRight, Target, Ban,
  CheckCircle2, Lightbulb, BriefcaseBusiness, Laptop, Users, Rocket,
  GraduationCap, Dumbbell, Sparkles, Zap, Timer, XCircle, ListChecks
} from 'lucide-react';

const AboutFrogPlanner = () => {
  const rules = [
    { num: 1, title: 'Tackle Your Frog First', text: 'Complete your most important task before distractions begin.', Icon: Target },
    { num: 2, title: 'Top 3 Priorities Only', text: "Don't overload your day. More tasks rarely means more impact.", Icon: ListChecks },
    { num: 3, title: 'Avoid Busy Work', text: 'Staying busy and being productive are not the same thing.', Icon: Ban },
    { num: 4, title: 'One Task at a Time', text: 'Multitasking reduces quality. Finish before moving on.', Icon: CheckCircle2 },
    { num: 5, title: 'Think About Impact', text: 'Before starting, ask: "Will this task create real results?"', Icon: Lightbulb },
  ];

  const steps = [
    { step: 1, title: 'Pick your frog', desc: 'Identify the single most important task for today. If everything feels urgent, ask: what has the biggest consequence if left undone?' },
    { step: 2, title: 'Add your top priorities', desc: 'List 2–3 supporting tasks that still matter. Keep the list short by design.' },
    { step: 3, title: 'Block your day', desc: 'Assign time for your frog before anything else — meetings, messages, or admin.' },
    { step: 4, title: 'Work through tasks one by one', desc: 'Complete each task fully before moving to the next. Resist the urge to context-switch.' },
    { step: 5, title: 'Review at end of day', desc: "Did you tackle your frog? Note what got done, what didn't, and what tomorrow's frog should be." },
  ];

  return (
    <InfoPage>
      <InfoHero
        eyebrow="Productivity guide"
        title="Welcome to Frog Planner"
        description={<>Built around <strong>Tackle Your Frog First</strong> — a focused approach to completing high-impact work before routine tasks take over the day.</>}
      />

      {/* ── Who Is This For? ── */}
      <section className="info-card p-5 md:p-6 space-y-5">
        <InfoSectionTitle icon={Target}>Who is Frog Planner designed for?</InfoSectionTitle>
        <p className="text-[13px] text-slate-600 leading-relaxed">
          Frog Planner is designed to help <span className="font-bold text-green-700">individuals and teams</span> focus on what truly matters — transforming daily work into meaningful progress.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {[
            { Icon: BriefcaseBusiness, label: 'Business Owner' },
            { Icon: Laptop, label: 'Professional' },
            { Icon: Users, label: 'Team Leader' },
            { Icon: Rocket, label: 'Founder / Entrepreneur' },
            { Icon: GraduationCap, label: 'Student' },
            { Icon: Dumbbell, label: 'Personal Goals' },
          ].map(({ Icon, label }) => (
            <div key={label} className="min-h-[108px] flex flex-col items-center justify-center gap-2.5 bg-slate-50/70 border border-slate-200 rounded-xl p-3 hover:border-green-300 hover:bg-green-50/50 transition-colors text-center">
              <InfoIcon icon={Icon} />
              <span className="text-[10px] font-semibold text-slate-700 leading-tight">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Why We Built This + What is Frog Task ── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Why */}
        <div className="info-card min-h-[310px] p-5 md:p-6 flex flex-col gap-4">
          <InfoSectionTitle icon={Milestone}>Why we built this system</InfoSectionTitle>
          <p className="text-[13px] text-slate-600 leading-7">
            Most people stay busy throughout the day but still feel that important work remains unfinished. Small tasks, calls, messages, and distractions consume time while the work that actually creates growth keeps getting pushed.
          </p>
          <div className="bg-green-50/70 border border-green-100 rounded-xl p-4 text-xs font-semibold text-green-800 leading-relaxed text-center italic mt-auto">
            "Focus on what matters most, complete important work first, and create meaningful results — not just stay busy."
          </div>
        </div>

        {/* What is Frog Task */}
        <div className="info-card min-h-[310px] p-5 md:p-6 flex flex-col gap-4 bg-green-50/35">
          <InfoSectionTitle icon={HelpCircle}>What is a frog task?</InfoSectionTitle>
          <p className="text-[13px] text-slate-600 leading-relaxed">
            A Frog Task is the core driver of your day — it represents the:
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-2 text-xs font-semibold text-slate-700">
            {[
              [Sparkles, 'Most important task'],
              [Zap, 'Most difficult task'],
              [Rocket, 'Highest impact task'],
              [Timer, 'Task most likely to be delayed'],
            ].map(([Icon, text]) => (
              <li key={text} className="flex min-h-10 items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-200">
                <Icon size={14} className="text-green-700" /> {text}
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-slate-500 italic pt-3 mt-auto border-t border-green-100">
            Complete your Frog first and the rest of the day becomes easier.
          </p>
        </div>
      </section>

      {/* ── Examples Comparison ── */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-stretch">
        <div className="info-card bg-rose-50/45 border-rose-100 p-5 space-y-4">
          <span className="inline-block text-[11px] font-extrabold text-rose-700 bg-white px-3 py-1 rounded-full border border-rose-200 shadow-sm">
            <span className="inline-flex items-center gap-1.5"><XCircle size={13} /> Avoid first (distractions)</span>
          </span>
          <ul className="space-y-2">
            {['Replying to random messages immediately', 'Checking emails continuously without a goal', 'Filling hours with small low-value tasks'].map(item => (
              <li key={item} className="flex items-start gap-2 text-xs font-semibold text-rose-800">
                <XCircle size={13} className="mt-0.5 text-rose-400 flex-shrink-0" />{item}
              </li>
            ))}
          </ul>
        </div>
        <div className="info-card bg-green-50/45 border-green-100 p-5 space-y-4">
          <span className="inline-block text-[11px] font-extrabold text-green-700 bg-white px-3 py-1 rounded-full border border-green-200 shadow-sm">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} /> Tackle first (frog tasks)</span>
          </span>
          <ul className="space-y-2">
            {['Finalizing client proposal & agreements', 'Closing important sales follow-up calls', 'Completing key milestones & critical work'].map(item => (
              <li key={item} className="flex items-start gap-2 text-xs font-semibold text-green-800">
                <CheckCircle2 size={13} className="mt-0.5 text-green-500 flex-shrink-0" />{item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── 80/20 Rule ── */}
      <section className="bg-gradient-to-r from-emerald-800 to-green-950 text-white p-5 md:p-6 rounded-2xl shadow-md grid grid-cols-1 sm:grid-cols-4 gap-5 items-center">
        <div className="sm:col-span-1 text-center">
          <span className="text-[3rem] font-black tracking-tight leading-none text-yellow-300 block">80/20</span>
          <span className="text-[9px] uppercase tracking-widest font-extrabold text-green-300">Pareto Principle</span>
        </div>
        <div className="sm:col-span-3 space-y-1.5">
          <h3 className="text-sm font-extrabold text-yellow-300">The 80/20 Rule: Focus on Results</h3>
          <p className="text-xs text-green-100/90 leading-relaxed font-medium">
            Around <span className="text-white font-bold">20% of your tasks create 80% of your results</span>. You may complete 15 tasks today, but only 2–3 tasks actually improve revenue, growth, or customer satisfaction. This system helps you find and protect those tasks.
          </p>
        </div>
      </section>

      {/* ── 5 Rules ── */}
      <section className="space-y-3">
        <InfoSectionTitle icon={Award}>Five rules of frog productivity</InfoSectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {rules.map((rule) => (
            <div key={rule.num} className="info-card min-h-[158px] p-4 flex flex-col gap-3 hover:border-green-300 transition-colors">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                  {rule.num}
                </span>
                <rule.Icon size={16} className="text-green-700" />
              </div>
              <h4 className="text-[11.5px] font-extrabold text-gray-800 leading-tight">{rule.title}</h4>
              <p className="text-[10.5px] text-gray-400 font-semibold leading-relaxed">{rule.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Daily Flow Steps ── */}
      <section className="space-y-3">
        <InfoSectionTitle icon={Play}>Your daily frog flow</InfoSectionTitle>
        <div className="space-y-2">
          {steps.map((st, i) => (
            <div key={st.step} className="info-card flex gap-4 items-start p-4 hover:border-green-300 transition-colors">
              <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center text-sm font-black flex-shrink-0 shadow">
                {st.step}
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-extrabold text-gray-800 mb-0.5">{st.title}</h4>
                <p className="text-[11px] text-gray-500 font-medium leading-relaxed">{st.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight size={14} className="text-green-300 flex-shrink-0 mt-1 hidden sm:block" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Goal CTA ── */}
      <section className="info-card bg-gradient-to-r from-yellow-50 to-green-50 border-yellow-200 p-6 text-center space-y-2">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300 bg-white text-amber-600"><Rocket size={21} /></div>
        <h3 className="text-base font-extrabold text-gray-800">Ready to plan your day?</h3>
        <p className="text-xs text-gray-500 max-w-lg mx-auto leading-relaxed font-medium">
          Don't just complete tasks — <span className="text-green-700 font-bold">complete the right ones first.</span> Every day you tackle your frog, you move one step closer to your goals.
        </p>
        <p className="text-[11px] text-amber-600 font-extrabold pt-1 flex items-center gap-1"><FrogLogo className="w-3.5 h-3.5" />Tackle Your Frog First. Every. Single. Day.</p>
      </section>

    </InfoPage>
  );
};

export default AboutFrogPlanner;
