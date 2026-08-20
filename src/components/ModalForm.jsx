import React from 'react';
import { X } from 'lucide-react';
import { FormActionButtons } from './StandardButtons';

/**
 * Compact, accessible form dialog shared across the planner.
 */
const ModalForm = ({
  isOpen,
  onClose,
  title,
  children,
  onSubmit,
  submitText = 'Submit',
  cancelText = 'Cancel',
  maxWidth = 'max-w-2xl',
  zIndex = 'z-[100]',
  extraFooterAction = null,
  loading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 bg-slate-950/45 backdrop-blur-[3px] flex items-center justify-center ${zIndex} p-3 md:p-4 animate-in fade-in duration-200`} role="presentation" onMouseDown={onClose}>
      <div
        className={`bg-white rounded-xl shadow-2xl w-full ${maxWidth} flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200`}
        style={{ maxHeight: '78vh' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-white flex-shrink-0 z-20">
          <h2 id="modal-form-title" className="text-sm font-bold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="app-icon-button !w-8 !h-8" aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        {/* Minimal Scrollable Body */}
        <div
          className="flex-1 overflow-y-auto bg-white min-h-0 z-10"
          style={{
            msOverflowStyle: 'none',
            scrollbarWidth: 'none'
          }}
        >
          {/* Webkit scrollbar hiding */}
          <style dangerouslySetInnerHTML={{
            __html: `
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
          `}} />

          <div className="px-4 py-3 md:px-5 md:py-4 no-scrollbar">
            <form id="ultra-compact-form" onSubmit={onSubmit} className="space-y-2.5 text-left">
              {children}
            </form>
          </div>
        </div>

        {/* Standardized Footer Buttons */}
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex-shrink-0 z-20">
          <FormActionButtons
            onCancel={onClose}
            cancelText={cancelText}
            submitText={submitText}
            loading={loading}
            className="w-full"
            formId="ultra-compact-form"
          />
        </div>
      </div>
    </div>
  );
};

export default ModalForm;
