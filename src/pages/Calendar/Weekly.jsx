import React from 'react';
import DragScrollTable from '../../components/DragScrollTable';
import { Clock, CheckSquare, Square } from 'lucide-react';

export default function Weekly({ events, currentDate, onToggleStatus }) {
  const startOfWeek = new Date(currentDate);
  const day = startOfWeek.getDay();
  const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
  startOfWeek.setDate(diff);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    weekDays.push(d);
  }
  
  return (
    <div className="flex-1 flex flex-col min-h-0 relative w-full">
      
      {/* A. DESKTOP VIEW LAYOUT */}
      <div className="hidden md:flex flex-col flex-1 min-h-0">
        <DragScrollTable className="flex-1 bg-gray-200 border border-gray-200 rounded-lg shadow-sm">
          <div className="min-w-[700px] flex flex-col h-full">
            <div className="grid grid-cols-7 bg-white border-b border-gray-200 sticky top-0 z-10">
              {weekDays.map((d, i) => {
                const isToday = d.getDate() === new Date().getDate() && d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
                return (
                  <div key={i} className="py-2 text-center border-r border-gray-100 last:border-r-0">
                    <div className={`text-xs font-semibold ${isToday ? 'text-indigo-600' : 'text-gray-500'}`}>
                      {d.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div className={`text-sm md:text-lg font-black mt-0.5 ${isToday ? 'text-indigo-600' : 'text-gray-900'}`}>
                      {d.getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 flex-1 bg-gray-100 gap-[1px]">
              {weekDays.map((d, i) => {
                const dayEvents = events.filter(e => e.date === d.getDate());
                
                return (
                  <div key={i} className="bg-white min-h-[300px] p-1.5 md:p-2 flex flex-col gap-2 border-r border-gray-100 last:border-r-0 hover:bg-gray-50/50 transition-colors">
                    {dayEvents.map((evt, idx) => {
                      const colors = evt.isCompleted
                        ? 'bg-gray-50 border-gray-205 text-gray-400 line-through opacity-70 hover:bg-gray-100'
                        : evt.priority === 'Frog'
                          ? 'bg-emerald-50 border-emerald-100 text-emerald-800 hover:bg-emerald-100'
                          : 'bg-indigo-50 border-indigo-100 text-indigo-805 hover:bg-indigo-100';
                      const icon = evt.priority === 'Frog' ? '🐸' : '📋';
                      
                      return (
                        <div 
                          key={idx} 
                          onClick={() => onToggleStatus && onToggleStatus(evt.id, evt.dateStr)}
                          className={`border text-[9px] md:text-[10px] px-2 py-1.5 rounded-lg font-bold cursor-pointer transition-colors shadow-sm ${colors}`}
                          title="Click to toggle status"
                        >
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span className="text-[8px] md:text-[9px] opacity-70">{evt.time}</span>
                            <span className="text-[10px]">{icon}</span>
                          </div>
                          <div className="leading-tight break-words">{evt.title}</div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </DragScrollTable>
      </div>

      {/* B. MOBILE VIEW LAYOUT */}
      <div className="flex md:hidden flex-col flex-1 overflow-y-auto space-y-3.5 pr-1">
        {weekDays.map((d, i) => {
          const isToday = d.getDate() === new Date().getDate() && d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear();
          const dayEvents = events.filter(e => e.date === d.getDate());

          return (
            <div 
              key={i} 
              className={`bg-white border rounded-xl p-3.5 shadow-sm transition-all ${
                isToday ? 'border-indigo-400 ring-1 ring-indigo-400' : 'border-gray-200'
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2.5">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    isToday ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                  </span>
                  <span className="text-xs font-bold text-gray-800">
                    {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {isToday && (
                  <span className="text-[9px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-150">
                    Today
                  </span>
                )}
              </div>

              {/* Day Events */}
              <div className="space-y-2">
                {dayEvents.length > 0 ? (
                  dayEvents.map((evt, idx) => {
                    const colors = evt.isCompleted
                      ? 'bg-gray-50 border-gray-205 text-gray-400 line-through opacity-70'
                      : evt.priority === 'Frog'
                        ? 'bg-emerald-50 border-emerald-100 text-emerald-805'
                        : 'bg-indigo-50 border-indigo-100 text-indigo-805';
                    const icon = evt.priority === 'Frog' ? '🐸' : '📋';

                    return (
                      <div 
                        key={idx} 
                        onClick={() => onToggleStatus && onToggleStatus(evt.id, evt.dateStr)}
                        className={`p-2.5 border rounded-xl flex items-center justify-between gap-3 shadow-sm cursor-pointer transition-all active:scale-[0.99] ${colors}`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-sm select-none">{icon}</span>
                          <span className="text-xs font-bold truncate flex-1 text-left">{evt.title}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[9px] opacity-85 font-semibold">{evt.time}</span>
                          {evt.isCompleted ? (
                            <CheckSquare size={16} className="text-emerald-600 flex-shrink-0" />
                          ) : (
                            <Square size={16} className="text-gray-400 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-[11px] text-gray-400 font-bold italic py-1 text-left pl-2">
                    No Frog tasks scheduled
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
