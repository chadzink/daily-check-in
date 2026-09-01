import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, X } from 'lucide-react';

interface BlockerReasonModalProps {
  isOpen: boolean;
  taskTitle: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export const BlockerReasonModal: React.FC<BlockerReasonModalProps> = ({
  isOpen,
  taskTitle,
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/80 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 id="modal-title" className="text-base font-bold text-white tracking-tight">
                Mark Task as Blocked
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-xs mt-0.5" title={taskTitle}>
                {taskTitle}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="blocker-reason" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Blocker Reason / Impediment <span className="text-rose-400">*</span>
            </label>
            <textarea
              id="blocker-reason"
              ref={textareaRef}
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Waiting on staging database access, PR review, or external API fix..."
              className="w-full bg-slate-950/80 text-slate-200 text-xs sm:text-sm rounded-xl p-3 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/80 transition-all placeholder:text-slate-600 resize-none shadow-inner"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/80 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!reason.trim()}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-lg shadow-amber-600/20 transition-all"
            >
              Confirm Blocker
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
