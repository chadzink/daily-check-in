import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowLeft, 
  ArrowRight, 
  Moon, 
  Check, 
  Loader2, 
  Sparkles,
  HeartHandshake
} from 'lucide-react';
import { DaySessionWithTasks } from '../../types/domain';
import { useExecuteCheckOut } from '../../hooks/useRituals';
import { Step1CheckOutReview, CheckOutDisposition } from './Step1CheckOutReview';
import { Step2DailyReflection } from './Step2DailyReflection';

interface CheckOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  sessionWithTasks?: DaySessionWithTasks | null;
}

export const CheckOutModal: React.FC<CheckOutModalProps> = ({
  isOpen,
  onClose,
  date,
  sessionWithTasks,
}) => {
  const executeCheckOutMutation = useExecuteCheckOut();

  const [step, setStep] = useState<1 | 2>(1);
  const [dispositions, setDispositions] = useState<Record<string, CheckOutDisposition>>({});
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize dispositions and prefill notes
  useEffect(() => {
    if (sessionWithTasks?.session?.notes) {
      setNotes(sessionWithTasks.session.notes);
    }
  }, [sessionWithTasks]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !executeCheckOutMutation.isPending) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, executeCheckOutMutation.isPending]);

  if (!isOpen) return null;

  const todayTasks = sessionWithTasks?.tasks?.today || [];
  const completedTasks = todayTasks.filter((t) => t.is_completed);
  const incompleteTasks = todayTasks.filter((t) => !t.is_completed);

  const handleSetDisposition = (taskId: string, disp: CheckOutDisposition) => {
    setDispositions((prev) => ({
      ...prev,
      [taskId]: disp,
    }));
  };

  const handleSubmit = async () => {
    const demoteTaskIds: string[] = [];
    const completeTaskIds: string[] = [];

    Object.entries(dispositions).forEach(([taskId, disp]) => {
      if (disp === 'DEMOTE') demoteTaskIds.push(taskId);
      if (disp === 'COMPLETE') completeTaskIds.push(taskId);
    });

    try {
      await executeCheckOutMutation.mutateAsync({
        date,
        payload: {
          demote_task_ids: demoteTaskIds,
          complete_task_ids: completeTaskIds,
          notes: notes.trim(),
        },
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 900);
    } catch {
      // Handled by react-query mutation
    }
  };

  return (
    <div
      data-testid="checkout-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Moon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                End-of-Day Check-Out Ritual
              </h2>
              <p className="text-xs text-slate-400">
                Step {step} of 2: {step === 1 ? 'Workday Review' : 'Reflection & Sign-off'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={executeCheckOutMutation.isPending}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close check-out modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Header */}
        <div className="grid grid-cols-2 px-6 pt-3 pb-1 gap-2 bg-slate-950/40 border-b border-slate-800/60">
          <div
            className="flex items-center space-x-1.5 pb-2 border-b-2 transition-all"
            style={{ borderColor: step === 1 ? '#6366f1' : '#10b981' }}
          >
            <div
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {step > 1 ? <Check className="h-3 w-3" /> : '1'}
            </div>
            <span
              className={`text-[11px] font-medium ${
                step === 1 ? 'text-indigo-300 font-semibold' : 'text-slate-400'
              }`}
            >
              Review & Triage
            </span>
          </div>

          <div
            className="flex items-center space-x-1.5 pb-2 border-b-2 transition-all"
            style={{ borderColor: step === 2 ? '#6366f1' : '#334155' }}
          >
            <div
              className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              2
            </div>
            <span
              className={`text-[11px] font-medium ${
                step === 2 ? 'text-indigo-300 font-semibold' : 'text-slate-400'
              }`}
            >
              Daily Reflection
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto min-h-[260px]">
          {isSuccess ? (
            <div className="flex flex-col items-center justify-center py-12 text-indigo-300 animate-in zoom-in-95 duration-300">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400 mb-4 shadow-xl shadow-indigo-500/10">
                <Sparkles className="h-8 w-8 animate-bounce" />
              </div>
              <h3 className="text-lg font-bold text-white">Workday Checked Out!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Rest well. Your state is cleanly preserved for tomorrow.
              </p>
            </div>
          ) : (
            <>
              {step === 1 && (
                <Step1CheckOutReview
                  completedTasks={completedTasks}
                  incompleteTasks={incompleteTasks}
                  dispositions={dispositions}
                  onSetDisposition={handleSetDisposition}
                />
              )}
              {step === 2 && (
                <Step2DailyReflection
                  notes={notes}
                  onNotesChange={setNotes}
                  completedCount={completedTasks.length}
                />
              )}
            </>
          )}

          {executeCheckOutMutation.isError && (
            <div className="mt-4 p-3 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {executeCheckOutMutation.error instanceof Error
                ? executeCheckOutMutation.error.message
                : 'Failed to complete check-out. Please try again.'}
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        {!isSuccess && (
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
            <button
              type="button"
              disabled={step === 1 || executeCheckOutMutation.isPending}
              onClick={() => setStep(1)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back</span>
            </button>

            <div className="flex items-center space-x-2">
              {step === 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all active:scale-[0.98]"
                >
                  <span>Continue to Reflection</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={executeCheckOutMutation.isPending}
                  onClick={handleSubmit}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {executeCheckOutMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <HeartHandshake className="h-3.5 w-3.5" />
                  )}
                  <span>Sign-Off & Close Workday</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
