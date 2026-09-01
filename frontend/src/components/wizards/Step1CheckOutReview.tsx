import React from 'react';
import { CheckCircle2, Archive, Check, Clock } from 'lucide-react';
import { DayTaskWithDetails } from '../../types/domain';

export type CheckOutDisposition = 'LEAVE' | 'DEMOTE' | 'COMPLETE';

interface Step1CheckOutReviewProps {
  completedTasks: DayTaskWithDetails[];
  incompleteTasks: DayTaskWithDetails[];
  dispositions: Record<string, CheckOutDisposition>;
  onSetDisposition: (taskId: string, disposition: CheckOutDisposition) => void;
}

export const Step1CheckOutReview: React.FC<Step1CheckOutReviewProps> = ({
  completedTasks,
  incompleteTasks,
  dispositions,
  onSetDisposition,
}) => {
  return (
    <div className="space-y-5">
      {/* Completed Accomplishments Section */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center space-x-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Accomplished Today ({completedTasks.length})</span>
        </h4>

        {completedTasks.length === 0 ? (
          <p className="text-xs text-slate-500 italic p-3 rounded-lg bg-slate-900/40 border border-slate-800">
            No tasks were checked off today. That&apos;s okay, some days are for exploration or unblocking!
          </p>
        ) : (
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {completedTasks.map((t) => (
              <div
                key={t.day_task_id || t.task_id}
                className="flex items-center space-x-2.5 p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                <span className="truncate">{t.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Incomplete Tasks Triage Section */}
      <div className="space-y-2 pt-3 border-t border-slate-800">
        <div>
          <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center space-x-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Unfinished Work Triage ({incompleteTasks.length})</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Choose what to do with unfinished tasks before closing the workday.
          </p>
        </div>

        {incompleteTasks.length === 0 ? (
          <div className="p-4 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400">
            <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1.5" />
            <p className="text-xs font-medium text-slate-300">
              Clean board! All commitments were completed.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {incompleteTasks.map((t) => {
              const currentDisp = dispositions[t.task_id] || 'LEAVE';

              return (
                <div
                  key={t.day_task_id || t.task_id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800"
                >
                  <span className="text-xs font-medium text-slate-200 truncate flex-1">
                    {t.title}
                  </span>

                  <div className="inline-flex rounded-lg bg-slate-800/90 p-0.5 border border-slate-700/60 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onSetDisposition(t.task_id, 'LEAVE')}
                      className={`text-[10px] font-medium px-2 py-1 rounded transition-all ${
                        currentDisp === 'LEAVE'
                          ? 'bg-sky-500 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Leave for Tomorrow
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetDisposition(t.task_id, 'DEMOTE')}
                      className={`inline-flex items-center space-x-1 text-[10px] font-medium px-2 py-1 rounded transition-all ${
                        currentDisp === 'DEMOTE'
                          ? 'bg-violet-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Archive className="h-2.5 w-2.5" />
                      <span>Backlog</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSetDisposition(t.task_id, 'COMPLETE')}
                      className={`text-[10px] font-medium px-2 py-1 rounded transition-all ${
                        currentDisp === 'COMPLETE'
                          ? 'bg-emerald-600 text-white font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Done Late
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
