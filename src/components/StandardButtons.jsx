import React from 'react';
import { X, Save } from 'lucide-react';

/**
 * TabSwitcher Component - Standardized Tabs for Pending/History
 */
export const TabSwitcher = ({ activeTab, onTabChange, tabs }) => {
  return (
    <div className="inline-flex gap-1 w-full lg:w-auto flex-shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex-1 py-1.5 px-3 transition text-[11px] rounded-md whitespace-nowrap capitalize flex items-center justify-center gap-2 ${
            activeTab === tab.id 
              ? 'bg-white text-emerald-800 font-semibold shadow-sm' 
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          {tab.icon && <tab.icon size={14} className={activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'} />}
          {tab.label} ({tab.count || 0})
        </button>
      ))}
    </div>
  );
};

/**
 * FormActionButtons Component - Standardized Save/Cancel Buttons
 */
export const FormActionButtons = ({ 
  onCancel, 
  onSubmit, 
  cancelText = 'Cancel', 
  submitText = 'Save Changes',
  loading = false,
  className = "",
  formId = null,
  extraButton = null
}) => {
  return (
    <div className={`flex gap-3 items-center ${className}`}>
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 min-h-9 px-3 py-2 border border-slate-200 rounded-lg text-slate-600 font-semibold hover:bg-slate-50 transition-colors text-xs flex items-center justify-center gap-2"
      >
        <X size={16} className="md:hidden" />
        <span>{cancelText}</span>
      </button>

      {extraButton && (
        <div className="flex-1 flex w-full justify-center">
          {extraButton}
        </div>
      )}

      <button
        type={onSubmit ? "button" : "submit"}
        form={formId}
        onClick={onSubmit}
        disabled={loading}
        className="flex-[1.5] min-h-9 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-3 py-2 rounded-lg transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="hidden md:block">Processing...</span>
          </>
        ) : (
          <>
            <Save size={15} />
            <span>{submitText}</span>
          </>
        )}
      </button>
    </div>
  );
};
