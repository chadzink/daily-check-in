import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Sparkles, 
  Loader2, 
  Sun,
  Award,
  RotateCcw,
  Layers,
  ListOrdered
} from 'lucide-react';
import { useCheckInContext, useExecuteCheckIn } from '../../hooks/useRituals';
import { RolloverAction, RolloverDecision } from '../../types/domain';
import { Step1YesterdayReview } from './Step1YesterdayReview';
import { Step2RolloverTriage } from './Step2RolloverTriage';
import { Step3BacklogPull } from './Step3BacklogPull';
import { Step4PrioritizeCommit, PrioritizedItem } from './Step4PrioritizeCommit';

interface MorningCheckInModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
}

export const MorningCheckInModal: React.FC<MorningCheckInModalProps> = ({
  isOpen,
  onClose,
  date,
}) => {
  const { data: contextData, isLoading: isContextLoading } = useCheckInContext(date);
  const executeCheckInMutation = useExecuteCheckIn();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [decisions, setDecisions] = useState<Record<string, { dayTaskId: string; action: RolloverAction }>>({});
  const [selectedBacklogIds, setSelectedBacklogIds] = useState<string[]>([]);
  const [prioritizedItems, setPrioritizedItems] = useState<PrioritizedItem[]>([]);
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize decisions when contextData arrives
  useEffect(() => {
    if (contextData?.rollover_candidates) {
      const initial: Record<string, { dayTaskId: string; action: RolloverAction }> = {};
      contextData.rollover_candidates.forEach((task) => {
        initial[task.task_id] = {
          dayTaskId: task.day_task_id,
          action: 'ROLLOVER',
        };
      });
      setDecisions(initial);
    }
  }, [contextData]);

  // Compute prioritized items for Step 4
  useEffect(() => {
    if (step === 4 && contextData) {
      const items: PrioritizedItem[] = [];

      // 1. Add rollover candidates marked ROLLOVER
      contextData.rollover_candidates.forEach((task) => {
        const action = decisions[task.task_id]?.action || 'ROLLOVER';
        if (action === 'ROLLOVER') {
          items.push({
            id: task.task_id,
            title: task.title,
            source: 'rollover',
          });
        }
      });

      // 2. Add selected backlog tasks
      selectedBacklogIds.forEach((id) => {
        const backlogTask = contextData.backlog_tasks.find((t) => t.id === id);
        if (backlogTask && !items.some((item) => item.id === id)) {
          items.push({
            id: backlogTask.id,
            title: backlogTask.title,
            source: 'backlog',
          });
        }
      });

      setPrioritizedItems(items);
    }
  }, [step, contextData, decisions, selectedBacklogIds]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !executeCheckInMutation.isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, executeCheckInMutation.isPending]);

  if (!isOpen) return null;

  const handleSetDecision = (taskId: string, dayTaskId: string, action: RolloverAction) => {
    setDecisions((prev) => ({
      ...prev,
      [taskId]: { dayTaskId, action },
    }));
  };

  const handleToggleBacklog = (taskId: string) => {
    setSelectedBacklogIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setPrioritizedItems((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === prioritizedItems.length - 1) return;
    setPrioritizedItems((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleSubmit = async () => {
    const rolloverDecisionsArray: RolloverDecision[] = Object.entries(decisions).map(
      ([taskId, info]) => ({
        day_task_id: info.dayTaskId,
        task_id: taskId,
        action: info.action,
      })
    );

    const todayTaskIds = prioritizedItems.map((item) => item.id);

    try {
      await executeCheckInMutation.mutateAsync({
        date,
        payload: {
          rollover_decisions: rolloverDecisionsArray,
          pull_task_ids: selectedBacklogIds,
          today_task_ids: todayTaskIds,
          notes: notes.trim(),
        },
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 900);
    } catch {
      // Error handled by react-query mutation
    }
  };

  const stepMeta = [
    { num: 1, label: 'Yesterday', icon: Award },
    { num: 2, label: 'Rollover', icon: RotateCcw },
    { num: 3, label: 'Backlog', icon: Layers },
    { num: 4, label: 'Priorities', icon: ListOrdered },
  ];

  return (
    <div
      data-testid="morning-checkin-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sun className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Morning Check-In Ritual
              </h2>
              <p className="text-xs text-slate-400">
                Step {step} of 4: {stepMeta[step - 1].label}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={executeCheckInMutation.isPending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close check-in modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="grid grid-cols-4 px-6 pt-3 pb-1 gap-2 bg-slate-950/40 border-b border-slate-800/60">
          {stepMeta.map((s) => {
            const Icon = s.icon;
            const isActive = step === s.num;
            const isCompleted = step > s.num;

            return (
              <div
                key={s.num}
                className="flex items-center space-x-1.5 pb-2 border-b-2 transition-all cursor-default"
                style={{
                  borderColor: isActive ? '#6366f1' : isCompleted ? '#10b981' : '#334155',
                }}
              >
                <div
                  className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : <Icon className="h-2.5 w-2.5" />}
                </div>
                <span
                  className={`text-[11px] font-medium hidden sm:inline truncate ${
                    isActive ? 'text-indigo-300 font-semibold' : 'text-slate-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto min-h-[300px]">
          {isContextLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400 mb-3" />
              <p className="text-xs font-medium">Gathering workday history and backlog...</p>
            </div>
          ) : isSuccess ? (
            <div className="flex flex-col items-center justify-center py-16 text-emerald-400 animate-in zoom-in-95 duration-300">
              <div className="h-16 w-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-xl shadow-emerald-500/10">
                <Sparkles className="h-8 w-8 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold text-white">Morning Check-In Complete!</h3>
              <p className="text-xs text-slate-400 mt-1">Have a productive and focused day.</p>
            </div>
          ) : (
            <>
              {step === 1 && (
                <Step1YesterdayReview
                  previousDate={contextData?.previous_date}
                  yesterdayTasks={contextData?.yesterday_tasks || []}
                />
              )}
              {step === 2 && (
                <Step2RolloverTriage
                  rolloverCandidates={contextData?.rollover_candidates || []}
                  decisions={Object.fromEntries(
                    Object.entries(decisions).map(([k, v]) => [k, v.action])
                  )}
                  onSetDecision={handleSetDecision}
                />
              )}
              {step === 3 && (
                <Step3BacklogPull
                  backlogTasks={contextData?.backlog_tasks || []}
                  selectedTaskIds={selectedBacklogIds}
                  onToggleSelect={handleToggleBacklog}
                />
              )}
              {step === 4 && (
                <Step4PrioritizeCommit
                  items={prioritizedItems}
                  onMoveUp={handleMoveUp}
                  onMoveDown={handleMoveDown}
                  notes={notes}
                  onNotesChange={setNotes}
                />
              )}
            </>
          )}

          {executeCheckInMutation.isError && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {executeCheckInMutation.error instanceof Error
                ? executeCheckInMutation.error.message
                : 'Failed to complete check-in. Please try again.'}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!isSuccess && !isContextLoading && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 1 || executeCheckInMutation.isPending}
              onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : 1))}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center space-x-2">
              {step < 4 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s < 4 ? ((s + 1) as 2 | 3 | 4) : 4))}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-[0.98]"
                >
                  <span>Next Step</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={executeCheckInMutation.isPending}
                  onClick={handleSubmit}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-semibold shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {executeCheckInMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>Commit Today&apos;s Ritual</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
