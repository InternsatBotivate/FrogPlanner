/**
 * TaskTimeFields — optional clock time + length for a task, with a derived
 * "Ends At". Mirrors FrogPlanner_App/src/components/ui/TimeField.tsx.
 * ──────────────────────────────────────────────────────────────────────────
 * Both values are optional: the coarse time slot (Morning/Afternoon/…) stays
 * required and this is finer detail within it. Clearing the time clears the
 * duration too, since a length with no start has nothing to anchor to.
 *
 * "Ends At" is computed and read-only — never an editable third field, which
 * could then disagree with the two values it derives from.
 * ──────────────────────────────────────────────────────────────────────────
 */
import React from 'react';
import { Clock, X } from 'lucide-react';

import {
  DURATION_PRESETS,
  formatDuration,
  formatTime12h,
  computeEndTime,
  normalizeDurationMinutes,
} from '../utils/taskTime';

/**
 * `startTime` is 'HH:MM' or 'HH:MM:SS' (Postgres `time` includes seconds).
 * <input type="time"> only accepts 'HH:MM', so trim before binding.
 */
const toInputValue = (value) => (value ? String(value).slice(0, 5) : '');

export default function TaskTimeFields({
  startTime,
  durationMinutes,
  onChange,
  compact = false,
  idPrefix = 'task',
}) {
  const endTime = computeEndTime(startTime, durationMinutes);

  const setTime = (value) => {
    // Clearing the time clears the duration with it — see the header note.
    if (!value) {
      onChange({ startTime: null, durationMinutes: null });
      return;
    }
    onChange({ startTime: value, durationMinutes: durationMinutes ?? null });
  };

  const setDuration = (value) => {
    onChange({
      startTime: startTime ?? null,
      durationMinutes: normalizeDurationMinutes(value),
    });
  };

  return (
    <div className={compact ? 'space-y-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-start-time`}
          className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide"
        >
          Time
        </label>
        <div className="relative">
          <Clock
            className={`absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none ${
              startTime ? 'text-green-700' : 'text-gray-400'
            }`}
          />
          <input
            id={`${idPrefix}-start-time`}
            type="time"
            value={toInputValue(startTime)}
            onChange={(e) => setTime(e.target.value)}
            className="w-full border border-gray-300 rounded pl-6 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] md:text-[12px] h-[32px] bg-white font-medium"
          />
          {startTime ? (
            <button
              type="button"
              onClick={() => setTime('')}
              aria-label="Clear task time"
              title="Clear time"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              <X className="w-3 h-3" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <label
          htmlFor={`${idPrefix}-duration`}
          className="block text-[9px] font-bold text-gray-550 uppercase tracking-wide"
        >
          Duration
        </label>
        <select
          id={`${idPrefix}-duration`}
          value={durationMinutes ?? ''}
          onChange={(e) => setDuration(e.target.value)}
          className="w-full border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-[10px] md:text-[12px] h-[32px] bg-white font-medium"
        >
          <option value="">No duration</option>
          {DURATION_PRESETS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {formatDuration(minutes)}
            </option>
          ))}
        </select>
      </div>

      {/* Read-only, and only once there's something to derive it from. */}
      {endTime ? (
        <div className="sm:col-span-2">
          <div className="inline-flex items-center gap-1.5 rounded bg-green-50 border border-green-200 px-2 py-1">
            <span className="text-[9px] font-bold uppercase tracking-wide text-green-700">Ends at</span>
            <span className="text-[11px] font-bold text-green-800">{formatTime12h(endTime)}</span>
            <span className="text-[10px] text-green-700">
              ({formatTime12h(startTime)} – {formatTime12h(endTime)})
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
