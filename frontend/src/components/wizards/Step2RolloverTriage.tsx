import React from 'react';
import { ArrowRightCircle, Archive, CheckCircle2, RotateCcw } from 'lucide-react';
import { DayTaskWithDetails, RolloverAction } from '../../types/domain';

interface Step2RolloverTriageProps {
  rolloverCandidates: DayTaskWithDetails[];
  decisions: Record<string, RolloverAction>;
  onSetDecision: (taskId: string, dayTaskId: string, action: RolloverAction) => void;
}

export const Step2RolloverTriage: React.FC<Step2RolloverTriageProps> = ({
  rolloverCandidates,
  decisions,
  onSetDecision,
}) => {
  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <RotateCcw className="h-4 w-4 text-sky-400" />
          <span>Incomplete Work Rollover Triage</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Choose what happens to unfinished tasks from your last active workday.
        </p>
      </div>

      {rolloverCandidates.length === 0 ? (
        <div className="p-8 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-300">
            Zero incomplete tasks rolled over!
          </p>
          <p className="text-xs text-slate-500 mt-1">
            You ended your last active day with everything completed or cleared.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
          {rolloverCandidates.map((task) => {
            const currentAction = decisions[task.task_id] || 'ROLLOVER';

            return (
              <div
                key={task.day_task_id || task.task_id}
                className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-semibold text-slate-200 truncate">
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Triage Action Buttons */}
                <div className="inline-flex rounded-lg bg-slate-800/90 p-0.5 border border-slate-700/60 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onSetDecision(task.task_id, task.day_task_id, 'ROLLOVER')}
                    className={`inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${
                      currentAction === 'ROLLOVER'
                        ? 'bg-sky-500 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <ArrowRightCircle className="h-3 w-3" />
                    <span>Roll Over</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSetDecision(task.task_id, task.day_task_id, 'DEMOTE')}
                    className={`inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${
                      currentAction === 'DEMOTE'
                        ? 'bg-violet-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Archive className="h-3 w-3" />
                    <span>Backlog</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onSetDecision(task.task_id, task.day_task_id, 'COMPLETE')}
                    className={`inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${
                      currentAction === 'COMPLETE'
                        ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="h-3 w-3" />
                    <span>Done Late</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
