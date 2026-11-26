import React, { useState } from 'react';
import {
  Check,
  AlertCircle,
  ArrowDownToLine,
  ArrowUpToLine,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  ShieldAlert,
  Pencil,
  Trash2,
  ListChecks,
} from 'lucide-react';
import { DayStatus, Subtask } from '../../types/domain';
import { SubtaskList } from './SubtaskList';

export interface TaskCardData {
  id: string; // day_task_id or task_id for backlog
  taskId: string; // Underlying master task ID
  title: string;
  description?: string;
  status: DayStatus | 'BACKLOG';
  isCompleted?: boolean;
  completedAt?: string | null;
  priorityOrder?: number;
  blockerReason?: string | null;
  subtasks?: Subtask[];
}

interface TaskCardProps {
  task: TaskCardData;
  index: number;
  totalCount?: number;
  isReadOnly?: boolean;
  disablePull?: boolean;
  onToggleComplete?: (dayTaskId: string, isCompleted: boolean) => void;
  onDemote?: (dayTaskId: string) => void;
  onPull?: (taskId: string) => void;
  onUnblock?: (dayTaskId: string) => void;
  onBlock?: (dayTaskId: string, title: string) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  onMoveToIndex?: (fromIndex: number, toIndex: number) => void;
  onEdit?: (task: TaskCardData) => void;
  onDelete?: (task: TaskCardData) => void;
  onUpdateSubtasks?: (taskId: string, subtasks: Subtask[]) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  index,
  totalCount = 1,
  isReadOnly = false,
  disablePull = false,
  onToggleComplete,
  onDemote,
  onPull,
  onUnblock,
  onBlock,
  onMoveUp,
  onMoveDown,
  onMoveToIndex,
  onEdit,
  onDelete,
  onUpdateSubtasks,
}) => {
  const [isEditingRank, setIsEditingRank] = useState(false);
  const [rankInput, setRankInput] = useState('');

  const isYesterday = task.status === 'YESTERDAY';
  const isToday = task.status === 'TODAY';
  const isBlocked = task.status === 'BLOCKED';
  const isBacklog = task.status === 'BACKLOG';
  const canMutate = !isReadOnly && !isYesterday;
  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter((s) => s.is_completed).length;
  const allSubtasksDone = subtasks.length > 0 && completedSubtasks === subtasks.length;

  const commitRankJump = () => {
    setIsEditingRank(false);
    if (!onMoveToIndex) return;
    const parsed = parseInt(rankInput, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.max(1, Math.min(totalCount, parsed));
    const targetIndex = clamped - 1;
    if (targetIndex !== index) {
      onMoveToIndex(index, targetIndex);
    }
  };

  const formatTimestamp = (isoString?: string | null) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      data-testid={`task-card-${task.id}`}
      className={`group relative flex flex-col p-3.5 rounded-xl border transition-all duration-200 ${
        task.isCompleted
          ? 'bg-slate-900/40 border-slate-800/60 opacity-70 hover:opacity-100'
          : isBlocked
          ? 'bg-slate-900/80 border-amber-500/30 hover:border-amber-500/50'
          : isToday
          ? 'bg-slate-900/80 border-slate-800 hover:border-sky-500/40'
          : isBacklog
          ? 'bg-slate-900/80 border-slate-800 hover:border-violet-500/40'
          : 'bg-slate-900/60 border-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {/* Up / Down Reorder Arrows */}
          {canMutate && (onMoveUp || onMoveDown) && (
            <div className="flex flex-col -my-0.5 flex-shrink-0">
              <button
                type="button"
                data-testid={`task-move-up-${task.id}`}
                onClick={() => onMoveUp?.(index)}
                disabled={index === 0 || !onMoveUp}
                className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                title="Move task up"
                aria-label="Move task up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                data-testid={`task-move-down-${task.id}`}
                onClick={() => onMoveDown?.(index)}
                disabled={index >= totalCount - 1 || !onMoveDown}
                className="p-0.5 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-25 disabled:pointer-events-none transition-colors"
                title="Move task down"
                aria-label="Move task down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Completion Checkbox */}
          {!isBacklog && (
            <button
              type="button"
              data-testid={`task-checkbox-${task.id}`}
              onClick={() => onToggleComplete && onToggleComplete(task.id, !task.isCompleted)}
              disabled={isYesterday || isReadOnly}
              className={`mt-0.5 h-4 w-4 rounded flex items-center justify-center transition-all flex-shrink-0 ${
                task.isCompleted
                  ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 border-emerald-400'
                  : 'border border-slate-600 hover:border-sky-400 bg-slate-800/60'
              } ${isYesterday || isReadOnly ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}
              title={isReadOnly ? 'Read-only mode' : task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
            >
              {task.isCompleted && <Check className="h-3 w-3 stroke-[3]" />}
            </button>
          )}

          {/* Priority Rank Indicator (clickable to jump to index when mutable & >1 item) */}
          {!isYesterday && typeof task.priorityOrder === 'number' && (
            isEditingRank ? (
              <input
                type="number"
                min={1}
                max={totalCount}
                autoFocus
                data-testid={`task-rank-input-${task.id}`}
                aria-label="Target position"
                value={rankInput}
                onChange={(e) => setRankInput(e.target.value)}
                onBlur={commitRankJump}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitRankJump();
                  } else if (e.key === 'Escape') {
                    setIsEditingRank(false);
                  }
                }}
                className="mt-0.5 w-11 px-1 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-950 text-sky-300 border border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-400 flex-shrink-0"
              />
            ) : canMutate && onMoveToIndex && totalCount > 1 ? (
              <button
                type="button"
                data-testid={`task-rank-${task.id}`}
                onClick={() => {
                  setRankInput(String(index + 1));
                  setIsEditingRank(true);
                }}
                title="Click to move to a specific position"
                aria-label={`Position ${index + 1}, click to move`}
                className="mt-0.5 px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-sky-500/15 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 cursor-pointer transition-colors flex-shrink-0"
              >
                #{task.priorityOrder}
              </button>
            ) : (
              <span className="mt-0.5 px-1.5 py-0.2 text-[10px] font-mono font-bold rounded bg-sky-500/15 text-sky-400 border border-sky-500/30 flex-shrink-0">
                #{task.priorityOrder}
              </span>
            )
          )}

          {/* Title & Description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-1.5">
              <p
                className={`text-xs sm:text-sm font-medium tracking-tight break-words ${
                  task.isCompleted
                    ? 'line-through text-slate-500'
                    : 'text-slate-200'
                }`}
              >
                {task.title}
              </p>
              {subtasks.length > 0 && (
                <span
                  data-testid={`task-subtask-badge-${task.id}`}
                  className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border flex-shrink-0 ${
                    allSubtasksDone
                      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
                      : 'text-slate-300 bg-slate-800 border-slate-700'
                  }`}
                >
                  <ListChecks className="h-3 w-3" />
                  <span>{completedSubtasks}/{subtasks.length}</span>
                </span>
              )}
            </div>
            {task.description && (
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            )}

            {/* Blocker Reason Pill */}
            {isBlocked && task.blockerReason && (
              <div className="mt-2 inline-flex items-center space-x-1.5 text-[11px] font-medium px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/25">
                <AlertCircle className="h-3 w-3 text-amber-400 flex-shrink-0" />
                <span className="truncate">{task.blockerReason}</span>
              </div>
            )}

            {/* Completed At Timestamp */}
            {task.isCompleted && task.completedAt && (
              <p className="text-[10px] text-emerald-400/80 mt-1 font-mono">
                Completed at {formatTimestamp(task.completedAt)}
              </p>
            )}

            {/* Inline Sub-tasks */}
            {(subtasks.length > 0 || (canMutate && onUpdateSubtasks)) && (
              <SubtaskList
                taskId={task.id}
                subtasks={subtasks}
                isReadOnly={!canMutate || !onUpdateSubtasks}
                onUpdateSubtasks={
                  onUpdateSubtasks
                    ? (nextSubtasks) => onUpdateSubtasks(task.taskId, nextSubtasks)
                    : undefined
                }
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {canMutate && (
          <div className="flex items-center space-x-1 opacity-85 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {/* Mark as Blocked button (Today only) */}
            {isToday && onBlock && (
              <button
                type="button"
                data-testid={`task-block-${task.id}`}
                onClick={() => onBlock(task.id, task.title)}
                className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
                title="Mark as blocked"
                aria-label="Mark task as blocked"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Unblock button */}
            {isBlocked && onUnblock && (
              <button
                type="button"
                data-testid={`task-unblock-${task.id}`}
                onClick={() => onUnblock(task.id)}
                className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                title="Unblock task (Move back to Today)"
                aria-label="Unblock task"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Demote to Backlog button */}
            {(isToday || isBlocked) && onDemote && (
              <button
                type="button"
                data-testid={`task-demote-${task.id}`}
                onClick={() => onDemote(task.id)}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Demote back to Global Backlog"
                aria-label="Demote to Backlog"
              >
                <ArrowDownToLine className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Pull into Today button */}
            {isBacklog && onPull && (
              <button
                type="button"
                data-testid={`task-pull-${task.id}`}
                disabled={disablePull}
                aria-disabled={disablePull ? 'true' : undefined}
                onClick={() => {
                  if (!disablePull) onPull(task.taskId);
                }}
                className={
                  disablePull
                    ? 'px-2 py-1 rounded-md text-[11px] font-semibold cursor-not-allowed opacity-60 text-slate-500 bg-slate-800/60 border border-slate-700/60 flex items-center space-x-1 transition-all'
                    : 'px-2 py-1 rounded-md text-[11px] font-semibold text-violet-300 bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/30 flex items-center space-x-1 transition-all'
                }
                title={disablePull ? 'Cannot pull tasks into a past date' : "Pull into Today's execution list"}
              >
                <ArrowUpToLine className="h-3 w-3" />
                <span>Pull</span>
              </button>
            )}

            {/* Edit button */}
            {onEdit && (
              <button
                type="button"
                data-testid={`task-edit-${task.id}`}
                onClick={() => onEdit(task)}
                className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/10 transition-colors"
                title="Edit task"
                aria-label="Edit task"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}

            {/* Delete button */}
            {onDelete && (
              <button
                type="button"
                data-testid={`task-delete-${task.id}`}
                onClick={() => onDelete(task)}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Delete task"
                aria-label="Delete task"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
