import React from 'react';
import { ArrowRightCircle, Archive, CheckCircle2, RotateCcw, ShieldAlert } from 'lucide-react';
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
  const candidates = rolloverCandidates || [];
  const hasKeepBlocked = candidates.some((task) => {
    const defaultAction: RolloverAction = task.status === 'BLOCKED' ? 'KEEP_BLOCKED' : 'ROLLOVER';
    return (decisions[task.task_id] || defaultAction) === 'KEEP_BLOCKED';
  });

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

      {candidates.length === 0 ? (
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
          {candidates.map((task) => {
            const isBlocked = task.status === 'BLOCKED';
            const defaultAction: RolloverAction = isBlocked ? 'KEEP_BLOCKED' : 'ROLLOVER';
            const currentAction = decisions[task.task_id] || defaultAction;

            return (
              <div
                key={task.day_task_id || task.task_id}
                data-testid={`rollover-card-${task.task_id}`}
                className={`p-3.5 rounded-xl border transition-all flex flex-col gap-3 ${
                  isBlocked
                    ? 'border-amber-500/35 bg-slate-900/80'
                    : 'bg-slate-900/70 border-slate-800 hover:border-slate-700/80 sm:flex-row sm:items-center sm:justify-between'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-xs font-semibold text-slate-200 truncate">
                      {task.title}
                    </h4>
                    {isBlocked && (
                      <span
                        data-testid={`rollover-blocked-badge-${task.task_id}`}
                        className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex-shrink-0"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        <span>Blocked</span>
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                      {task.description}
                    </p>
                  )}
                  {isBlocked && task.blocker_reason && (
                    <div
                      data-testid={`rollover-blocker-reason-${task.task_id}`}
                      className="mt-2 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-200/90"
                    >
                      {task.blocker_reason}
                    </div>
                  )}
                </div>

                {/* Triage Action Buttons */}
                <div
                  role="radiogroup"
                  aria-label={`Rollover action for ${task.title}`}
                  className="inline-flex flex-wrap rounded-lg bg-slate-800/90 p-0.5 border border-slate-700/60 flex-shrink-0 self-start sm:self-auto"
                >
                  {isBlocked && (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={currentAction === 'KEEP_BLOCKED'}
                      onClick={() => onSetDecision(task.task_id, task.day_task_id, 'KEEP_BLOCKED')}
                      className={`inline-flex items-center space-x-1 text-[11px] font-medium px-2.5 py-1 rounded-md transition-all ${
                        currentAction === 'KEEP_BLOCKED'
                          ? 'bg-amber-600 text-white shadow-sm font-semibold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <ShieldAlert className="h-3 w-3" />
                      <span>Keep Blocked</span>
                    </button>
                  )}

                  <button
                    type="button"
                    role="radio"
                    aria-checked={currentAction === 'ROLLOVER'}
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
                    role="radio"
                    aria-checked={currentAction === 'DEMOTE'}
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
                    role="radio"
                    aria-checked={currentAction === 'COMPLETE'}
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

      {hasKeepBlocked && (
        <p
          data-testid="keep-blocked-helper-note"
          className="text-[11px] text-slate-400 bg-slate-900/50 border border-slate-800/80 rounded-lg px-3 py-2"
        >
          Tasks set to Keep Blocked will carry directly into today&apos;s Blocked row and skip Step 4 prioritization.
        </p>
      )}
    </div>
  );
};
