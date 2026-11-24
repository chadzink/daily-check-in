import React, { useState, useEffect } from 'react';
import { format, subDays, startOfMonth } from 'date-fns';
import { BarChart3, CheckCircle2, Download, Loader2, X, AlertTriangle } from 'lucide-react';
import { useCompletedTasksReport } from '../../hooks/useBoard';
import { buildCompletedTasksCsv, downloadCsv } from '../../utils/csvExport';

interface ReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReportsModal: React.FC<ReportsModalProps> = ({ isOpen, onClose }) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const defaultStartStr = format(subDays(new Date(), 6), 'yyyy-MM-dd');

  const [startDate, setStartDate] = useState(defaultStartStr);
  const [endDate, setEndDate] = useState(todayStr);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const isValidRange = !!startDate && !!endDate && startDate <= endDate;
  const { data, isLoading, error } = useCompletedTasksReport(
    startDate,
    endDate,
    isOpen && isValidRange
  );

  if (!isOpen) return null;

  const tasks = data?.tasks ?? [];

  const handleExportCsv = () => {
    const csv = buildCompletedTasksCsv(tasks);
    downloadCsv(`completed-tasks-${startDate}-to-${endDate}.csv`, csv);
  };

  const applyPreset = (daysBack: number | 'month') => {
    const now = new Date();
    setEndDate(format(now, 'yyyy-MM-dd'));
    if (daysBack === 'month') {
      setStartDate(format(startOfMonth(now), 'yyyy-MM-dd'));
    } else {
      setStartDate(format(subDays(now, daysBack), 'yyyy-MM-dd'));
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reports-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl shadow-black/80 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="reports-modal-title" className="text-base font-bold text-white tracking-tight">
                Completed Tasks Report
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Filter completed tasks by date range and export to CSV
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Date Filter & Export Controls */}
        <div className="px-6 py-4 bg-slate-950/40 border-b border-slate-800/80 flex flex-col gap-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label htmlFor="report-start-date" className="block text-[11px] font-semibold text-slate-400 mb-1">
                  Start Date
                </label>
                <input
                  id="report-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-900 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label htmlFor="report-end-date" className="block text-[11px] font-semibold text-slate-400 mb-1">
                  End Date
                </label>
                <input
                  id="report-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-900 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <button
              type="button"
              data-testid="export-csv-btn"
              onClick={handleExportCsv}
              disabled={!isValidRange || isLoading || tasks.length === 0}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none rounded-lg shadow-lg shadow-emerald-600/20 transition-all"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV ({tasks.length})</span>
            </button>
          </div>

          {/* Quick Range Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-slate-500 font-medium">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset(6)}
              className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => applyPreset(29)}
              className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => applyPreset('month')}
              className="px-2 py-0.5 text-[11px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition-colors"
            >
              This Month
            </button>
          </div>

          {!isValidRange && (
            <p className="text-xs text-rose-400">Start date must be on or before end date.</p>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-2.5">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-400 mr-2" />
              <span className="text-xs">Loading completed tasks...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/70 text-rose-200 flex items-center gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{error instanceof Error ? error.message : 'Failed to load report'}</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500">
                No completed tasks found between {startDate} and {endDate}.
              </p>
            </div>
          ) : (
            tasks.map((item) => (
              <div
                key={`${item.date}-${item.day_task_id}`}
                data-testid={`report-task-${item.day_task_id}`}
                className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-slate-200 break-words">
                      {item.title}
                    </p>
                    {item.description && (
                      <p className="text-[11px] text-slate-400 mt-1 break-words">
                        {item.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] font-mono text-slate-400">
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {item.date}
                      </span>
                      <span>Status: {item.status}</span>
                      {item.completed_at && (
                        <span>
                          Completed: {new Date(item.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
