import React from 'react';
import { Clock, CheckCircle2 } from 'lucide-react';

export default function Daily({ events, onToggleStatus }) {
  return (
    <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm overflow-y-auto p-2 md:p-4 hide-scrollbar">
       <div className="max-w-4xl mx-auto w-full">

         <div className="space-y-2.5 md:space-y-3 pb-2 mt-2">
           {events.length > 0 ? (
             events.map((evt, idx) => {
               const isFrog = evt.priority === 'Frog';
               const colors = evt.isCompleted
                 ? 'bg-gray-50 border-gray-250 text-gray-400 opacity-70 line-through'
                 : isFrog
                   ? 'bg-emerald-50/80 border-emerald-100 text-emerald-900 hover:bg-emerald-50 hover:border-emerald-250'
                   : 'bg-indigo-50/80 border-indigo-100 text-indigo-900 hover:bg-indigo-50 hover:border-indigo-250';
               
               const badgeColors = evt.isCompleted 
                 ? 'bg-gray-200 text-gray-500' 
                 : isFrog 
                   ? 'bg-emerald-100 text-emerald-700' 
                   : 'bg-indigo-100 text-indigo-700';
               
               const icon = isFrog ? '🐸' : '📋';
               
               return (
                 <div key={evt.id || idx} className="relative group">
                   {/* Event Card */}
                   <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 border rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer ${colors}`}>
                     <div className="flex-1 text-left">
                       <div className="flex items-center gap-3 mb-2">
                         <span className="text-xs font-semibold opacity-75 flex items-center gap-1.5">
                           <Clock size={14} strokeWidth={2} />
                           {evt.time}
                         </span>
                         <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeColors}`}>
                           {evt.type}
                         </span>
                         <span className="text-sm select-none" title={isFrog ? 'Frog Task' : 'Normal Task'}>{icon}</span>
                       </div>
                       <h3 className={`text-base md:text-lg font-bold leading-tight ${evt.isCompleted ? 'text-gray-400 font-semibold' : 'text-gray-900'}`}>{evt.title}</h3>
                     </div>
                     
                     <div className="mt-4 sm:mt-0 flex justify-end">
                       <button 
                         onClick={() => onToggleStatus && onToggleStatus(evt.id, evt.dateStr)}
                         className={`flex items-center justify-center p-2.5 rounded-xl transition-all shadow-sm border active:scale-95 ${
                           evt.isCompleted
                             ? 'bg-amber-50 border-amber-200 text-amber-600 hover:bg-amber-100'
                             : isFrog
                               ? 'bg-white border-emerald-200 hover:bg-emerald-600 hover:text-white text-emerald-650'
                               : 'bg-white border-indigo-200 hover:bg-indigo-600 hover:text-white text-indigo-650'
                         }`}
                       >
                         <CheckCircle2 size={22} strokeWidth={2.5} />
                       </button>
                     </div>
                   </div>
                 </div>
               );
             })
           ) : (
             <div className="text-center py-16 text-gray-400 font-bold space-y-3">
               <span className="text-4xl block select-none">📋</span>
               <p className="text-sm">No pending tasks scheduled for this day.</p>
             </div>
           )}
         </div>
       </div>
    </div>
  );
}
