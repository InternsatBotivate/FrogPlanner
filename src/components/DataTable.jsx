import React from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import DragScrollTable from './DragScrollTable';

/**
 * DataTable Component
 * Standardized table with Desktop Table View and Mobile Card View.
 * Includes integrated pagination footer.
 */
const DataTable = ({ 
  headers, 
  data, 
  renderRow, 
  renderCard,
  minWidth = "1000px",
  // Pagination Props
  currentPage,
  totalPages,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  totalResults,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'New items will appear here when they are added.',
  emptyAction = null,
}) => {
  const emptyState = (
    <div className="flex min-h-[210px] flex-col items-center justify-center px-5 py-8 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm">
        <Inbox size={20} strokeWidth={1.8} />
      </span>
      <p className="text-sm font-semibold text-slate-800">{emptyTitle}</p>
      <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-slate-500">{emptyDescription}</p>
      {emptyAction && <div className="mt-4">{emptyAction}</div>}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Mobile Card View (Hidden on Desktop) */}
      <div className="md:hidden flex flex-col gap-2 p-3 overflow-y-auto flex-1 bg-slate-50/70 scrollbar-hide">
        {data.length > 0 ? (
          data.map((item, index) => renderCard(item, index))
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50/40">{emptyState}</div>
        )}
      </div>

      {/* Desktop Table View (Hidden on Mobile) */}
      <div className="hidden md:flex flex-col flex-1 min-h-0 overflow-hidden">
        <DragScrollTable className="w-full flex-1 min-h-0">
          <table className="w-full relative border-collapse" style={{ minWidth }}>
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
              <tr>
                {headers.map((header, index) => (
                  <th 
                    key={index} 
                    className="px-4 py-3 text-center text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 whitespace-nowrap"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {data.length > 0 ? (
                data.map((item, index) => renderRow(item, index))
              ) : (
                <tr>
                  <td colSpan={headers.length} className="bg-slate-50/35">
                    {emptyState}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </DragScrollTable>
      </div>

      {/* Footer - Unified for both views */}
      {data.length > 0 && <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4">
        {/* Left Side: Row Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={itemsPerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:border-green-500 bg-white font-medium text-xs md:text-sm shadow-sm"
          >
            {[10, 20, 50, 100].map(val => (
              <option key={val} value={val}>{val}</option>
            ))}
          </select>
          <span className="text-[11px] md:text-sm text-gray-500 whitespace-nowrap font-semibold ml-1 sm:ml-2 inline-block">
            {totalResults > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0}-{Math.min(currentPage * itemsPerPage, totalResults)} of {totalResults}
          </span>
        </div>

        {/* Right Side: Pagination Controls */}
        <div className="flex items-center gap-2 md:gap-4 text-gray-700">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-50 transition shadow-sm flex items-center justify-center text-green-600"
          >
            <ChevronLeft size={16} strokeWidth={2.5} />
          </button>
          <div className="flex items-center text-xs md:text-sm font-semibold text-gray-600">
            {currentPage} / {totalPages || 1}
          </div>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages || totalPages === 0}
            className="p-1.5 md:px-2 md:py-1 border border-gray-300 rounded-md bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-50 transition shadow-sm flex items-center justify-center text-green-600"
          >
            <ChevronRight size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>}
    </div>
  );
};

export default DataTable;
