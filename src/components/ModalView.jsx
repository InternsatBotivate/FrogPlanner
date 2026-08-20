import React from 'react';
import { X } from 'lucide-react';

const ModalView = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-2xl',
  zIndex = 'z-[100]'
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-slate-950/45 backdrop-blur-[3px] flex items-center justify-center ${zIndex} p-3 animate-in fade-in duration-200 overflow-hidden`} onMouseDown={onClose}>
      <div
        className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} min-h-[300px] max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-view-title"
      >
        {/* Compact Header */}
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
          <h2 id="modal-view-title" className="text-sm font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="app-icon-button !w-8 !h-8" aria-label="Close dialog"><X size={16} /></button>
        </div>

        {/* Scrollable Body - Hidden scrollbar */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
          <style dangerouslySetInnerHTML={{__html: `
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}} />
          {children}
        </div>

        {/* Footer Action */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-white transition font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalView;
