import React, { useState, useEffect, useMemo } from 'react';
import { X, FileText, Eye, CheckSquare, AlertOctagon, ListTodo, History } from 'lucide-react';
import { DaySessionWithTasks, StandupExportOptions } from '../../types/domain';
import { generateStandupMarkdown, defaultStandupOptions } from '../../utils/standupGenerator';
import { CopyButton } from './CopyButton';

interface StandupExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionWithTasks?: DaySessionWithTasks | null;
  dateStr: string;
}

export const StandupExportModal: React.FC<StandupExportModalProps> = ({
  isOpen,
  onClose,
  sessionWithTasks,
  dateStr,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const [options, setOptions] = useState<StandupExportOptions>(defaultStandupOptions);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const markdownContent = useMemo(() => {
    return generateStandupMarkdown(sessionWithTasks, options);
  }, [sessionWithTasks, options]);

  if (!isOpen) return null;

  const yesterdayTasks = sessionWithTasks?.tasks?.yesterday || [];
  const todayTasks = sessionWithTasks?.tasks?.today || [];
  const blockedTasks = sessionWithTasks?.tasks?.blocked || [];

  const filteredToday = options.includeCompleted
    ? todayTasks
    : todayTasks.filter((t) => !t.is_completed);

  return (
    <div
      data-testid="standup-export-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
    >
      <div
        data-testid="standup-export-modal-panel"
        className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Daily Standup Export
              </h2>
              <p className="text-xs text-slate-400">
                1-Click Markdown summary formatted for Slack, Teams, or email ({dateStr})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-standup-modal-btn"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab & Format Controls Bar */}
        <div className="px-6 py-3 border-b border-slate-800/80 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          {/* Tab Selector */}
          <div className="flex items-center space-x-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              data-testid="standup-tab-preview"
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'preview'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              <span>Rich Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('source')}
              data-testid="standup-tab-source"
              className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'source'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Markdown Code</span>
            </button>
          </div>

          {/* Formatting Checkboxes */}
          <div className="flex items-center space-x-4 text-xs text-slate-300">
            <label className="inline-flex items-center space-x-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.includeCompleted}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, includeCompleted: e.target.checked }))
                }
                data-testid="toggle-include-completed"
                className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span>Completed tasks</span>
            </label>
            <label className="inline-flex items-center space-x-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={options.includeBlockerReasons}
                onChange={(e) =>
                  setOptions((prev) => ({ ...prev, includeBlockerReasons: e.target.checked }))
                }
                data-testid="toggle-include-blockers"
                className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <span>Blocker reasons</span>
            </label>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-950/20">
          {activeTab === 'source' ? (
            <div className="relative">
              <textarea
                readOnly
                value={markdownContent}
                data-testid="standup-markdown-textarea"
                rows={12}
                className="w-full font-mono text-xs p-4 rounded-xl bg-slate-950 border border-slate-800 text-indigo-200 selection:bg-indigo-500 selection:text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none leading-relaxed"
              />
            </div>
          ) : (
            <div
              data-testid="standup-rich-preview"
              className="space-y-4 text-xs text-slate-200"
            >
              {/* Yesterday Card */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-indigo-400 font-semibold uppercase tracking-wider text-[11px]">
                  <History className="h-3.5 w-3.5" />
                  <span>Yesterday</span>
                </div>
                {yesterdayTasks.length === 0 ? (
                  <p className="text-slate-500 italic">No tasks completed yesterday</p>
                ) : (
                  <ul className="space-y-1.5 pl-2">
                    {yesterdayTasks.map((t) => (
                      <li key={t.day_task_id} className="flex items-center space-x-2 text-slate-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                        <span>{t.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Today Card */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-sky-400 font-semibold uppercase tracking-wider text-[11px]">
                  <ListTodo className="h-3.5 w-3.5" />
                  <span>Today</span>
                </div>
                {filteredToday.length === 0 ? (
                  <p className="text-slate-500 italic">No tasks planned for today</p>
                ) : (
                  <ul className="space-y-1.5 pl-2">
                    {filteredToday.map((t) => (
                      <li key={t.day_task_id} className="flex items-center space-x-2">
                        {t.is_completed ? (
                          <CheckSquare className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                        ) : (
                          <span className="h-3.5 w-3.5 rounded border border-slate-600 flex-shrink-0" />
                        )}
                        <span className={t.is_completed ? 'line-through text-slate-400' : 'text-slate-200'}>
                          {t.title}
                        </span>
                        {t.priority_order ? (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                            P{t.priority_order}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Blocked Card */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-rose-400 font-semibold uppercase tracking-wider text-[11px]">
                  <AlertOctagon className="h-3.5 w-3.5" />
                  <span>Blocked</span>
                </div>
                {blockedTasks.length === 0 ? (
                  <p className="text-slate-500 italic">No blockers reported</p>
                ) : (
                  <ul className="space-y-1.5 pl-2">
                    {blockedTasks.map((t) => (
                      <li key={t.day_task_id} className="text-rose-200/90 flex flex-col gap-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                          <span className="font-medium">{t.title}</span>
                        </div>
                        {options.includeBlockerReasons && t.blocker_reason && (
                          <span className="text-[11px] text-rose-300/80 pl-3.5">
                            Reason: {t.blocker_reason}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/60">
          <span className="text-xs text-slate-400">
            Click copy to place markdown directly into your clipboard
          </span>
          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Close
            </button>
            <CopyButton textToCopy={markdownContent} />
          </div>
        </div>
      </div>
    </div>
  );
};
