import React, { useState, useEffect } from 'react';
import FrogLogo from '../../components/FrogLogo';
import DragScrollTable from '../../components/DragScrollTable';
import { CheckSquare, Square, Clock } from 'lucide-react';

export default function Monthly({ events, currentDate, onToggleStatus }) {
  const [selectedDateDetails, setSelectedDateDetails] = useState(null);
  const [activeDay, setActiveDay] = useState(new Date().getDate());

  // Reset active day if the month changes
  useEffect(() => {
    setActiveDay(1);
    setSelectedDateDetails(null);
  }, [currentDate.getMonth(), currentDate.getFullYear()]);

  const getDaysInMonth = (year, month) => {
    return new Date(year, month + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (year, month) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // 1. DESKTOP GRID GENERATION
  const desktopDays = [];
  for (let i = 0; i < firstDay; i++) {
    desktopDays.push(
      <div key={`desktop-empty-${i}`} className="bg-gray-50 border-r border-b border-gray-100 min-h-[120px]"></div>
    );
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEvents = events.filter(e => e.date === d);
    const isToday = new Date().getDate() === d && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
    
    desktopDays.push(
      <div 
        key={`desktop-day-${d}`} 
        onClick={() => setSelectedDateDetails({ day: d, events: dayEvents })}
        className={`bg-white border-r border-b border-gray-100 min-h-[120px] p-2 hover:bg-emerald-50/20 transition-colors group relative cursor-pointer ${isToday ? 'bg-indigo-50/20' : ''}`}
      >
        <div className="flex justify-between items-start">
          <span className={`text-xs md:text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700'}`}>
            {d}
          </span>
        </div>
        {dayEvents.length > 0 && (() => {
          const frogCount = dayEvents.filter(e => e.priority === 'Frog').length;
          const nonFrogCount = dayEvents.filter(e => e.priority !== 'Frog').length;
          return (
            <div className="mt-2 flex flex-col gap-1 items-center">
              {frogCount > 0 && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-805 border border-emerald-150 rounded-lg text-[9px] font-extrabold flex items-center gap-1 shadow-sm w-full justify-center">
                  <FrogLogo className="w-3 h-3 select-none" /> {frogCount} Frog
                </span>
              )}
              {nonFrogCount > 0 && (
                <span className="px-2 py-0.5 bg-indigo-50 text-indigo-705 border border-indigo-150 rounded-lg text-[9px] font-extrabold flex items-center gap-1 shadow-sm w-full justify-center">
                  📋 {nonFrogCount} Task
                </span>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // 2. MOBILE GRID GENERATION
  const mobileDays = [];
  for (let i = 0; i < firstDay; i++) {
    mobileDays.push(
      <div key={`mobile-empty-${i}`} className="bg-gray-50 border-b border-gray-100 aspect-square flex items-center justify-center text-transparent select-none">-</div>
    );
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dayEvents = events.filter(e => e.date === d);
    const isToday = new Date().getDate() === d && new Date().getMonth() === currentDate.getMonth() && new Date().getFullYear() === currentDate.getFullYear();
    const isActive = activeDay === d;
    
    mobileDays.push(
      <button 
        type="button"
        key={`mobile-day-${d}`} 
        onClick={() => {
          setActiveDay(d);
          setSelectedDateDetails({ day: d, events: dayEvents });
        }}
        className={`border-b border-gray-100 bg-white aspect-square flex flex-col items-center justify-between p-1 focus:outline-none transition-all ${
          isActive ? 'ring-2 ring-indigo-500 bg-indigo-50/20 z-10' : ''
        }`}
      >
        <span className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${
          isToday ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-700'
        }`}>
          {d}
        </span>
        {/* Visual Dots for events */}
        <div className="flex gap-0.5 justify-center w-full min-h-[4px] mb-1">
          {dayEvents.slice(0, 3).map((evt, idx) => {
            const dotColor = evt.isCompleted ? 'bg-gray-400' : 'bg-emerald-500';
            return (
              <span key={idx} className={`w-1 h-1 rounded-full ${dotColor}`}></span>
            );
          })}
        </div>
      </button>
    );
  }

  const activeDayEvents = events.filter(e => e.date === activeDay);

  // Helper inside modal to sync event status
  const handleModalToggle = (evtId, dateStr) => {
    if (onToggleStatus) {
      onToggleStatus(evtId, dateStr);
      
      // Update local state in modal instantly
      if (selectedDateDetails) {
        const updatedEvents = selectedDateDetails.events.map(ev => {
          if (ev.id === evtId) {
            return { ...ev, isCompleted: !ev.isCompleted };
          }
          return ev;
        });
        setSelectedDateDetails({ ...selectedDateDetails, events: updatedEvents });
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 relative w-full">
      
      {/* A. DESKTOP VIEW LAYOUT */}
      <div className="hidden md:flex flex-col flex-1 min-h-0">
        <DragScrollTable className="flex-1 bg-gray-200 border border-gray-200 rounded-lg shadow-sm">
          <div className="min-w-[700px] flex flex-col h-full">
            <div className="grid grid-cols-7 bg-white border-b border-gray-200 sticky top-0 z-10">
              {weekDays.map(day => (
                <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 border-r border-gray-100 last:border-r-0">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 bg-gray-100 gap-[1px]">
              {desktopDays}
            </div>
          </div>
        </DragScrollTable>
      </div>

      {/* B. MOBILE VIEW LAYOUT */}
      <div className="flex md:hidden flex-col flex-1 min-h-0 space-y-4">
        {/* Compact Calendar Grid Card */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden flex-shrink-0">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {weekDays.map(day => (
              <div key={day} className="py-1.5 text-center text-[10px] font-bold text-gray-400">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 bg-gray-200 gap-[1px]">
            {mobileDays}
          </div>
        </div>

        {/* Mobile Agenda List below */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 flex-1 flex flex-col min-h-0 overflow-y-auto">
          <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-2 flex items-center justify-between">
            <span>Agenda for Day {activeDay}</span>
            <span className="text-[10px] text-gray-400 font-semibold lowercase">
              {activeDayEvents.length} frog task(s)
            </span>
          </h3>

          <div className="space-y-2 mt-3 flex-1 overflow-y-auto">
            {activeDayEvents.length > 0 ? (
              activeDayEvents.map((evt, idx) => {
                const colors = evt.isCompleted
                  ? 'bg-gray-50 border-gray-200 text-gray-405 line-through opacity-70'
                  : 'bg-emerald-50 border-emerald-100 text-emerald-800';

                return (
                  <div 
                    key={idx} 
                    onClick={() => handleModalToggle(evt.id, evt.dateStr)}
                    className={`p-2.5 border rounded-xl flex items-center justify-between gap-3 shadow-sm cursor-pointer transition-all active:scale-[0.99] ${colors}`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <FrogLogo className="w-4 h-4 select-none flex-shrink-0" />
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
              <div className="text-center py-8 text-gray-400 text-xs font-semibold">
                No Frog tasks scheduled for Day {activeDay}.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* POPUP MODAL FOR DAY DETAILS (STILL SUPPORTED FOR CLICKS ON DESKTOP AND POPUPS) */}
      {selectedDateDetails && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center z-[150] p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <h3 className="text-sm font-bold text-gray-800">
                Frog Tasks on {currentDate.toLocaleString('default', { month: 'long' })} {selectedDateDetails.day}, {currentDate.getFullYear()}
              </h3>
              <button 
                onClick={() => setSelectedDateDetails(null)} 
                className="text-gray-500 hover:text-gray-700 font-bold text-sm h-6 w-6 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
              >
                ×
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3 flex-1">
              {selectedDateDetails.events.length > 0 ? (
                selectedDateDetails.events.map((evt, idx) => {
                  const colors = evt.isCompleted
                    ? 'bg-gray-50 border-gray-200 text-gray-400 line-through opacity-70'
                    : 'bg-emerald-50 border-emerald-100 text-emerald-800';

                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleModalToggle(evt.id, evt.dateStr)}
                      className={`p-3 border rounded-xl flex items-center justify-between gap-3 shadow-sm cursor-pointer transition-all active:scale-[0.99] ${colors}`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FrogLogo className="w-4 h-4 select-none flex-shrink-0" />
                        <span className="text-xs font-bold truncate flex-1 text-left">{evt.title}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] opacity-85 font-semibold">{evt.time}</span>
                        {evt.isCompleted ? (
                          <CheckSquare size={18} className="text-emerald-600 flex-shrink-0" />
                        ) : (
                          <Square size={18} className="text-gray-400 flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-400 text-sm font-medium">
                  No Frog tasks scheduled for this day.
                </div>
              )}
            </div>
            
            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-200 bg-gray-50 flex justify-end">
              <button 
                onClick={() => setSelectedDateDetails(null)}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors active:scale-95 shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
