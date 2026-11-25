import React, { useState, useEffect } from 'react';
import { StickyNote, X } from 'lucide-react';
import { MarkdownNotesEditor } from '../common/MarkdownNotesEditor';

interface DailyNotesModalProps {
  isOpen: boolean;
  dateLabel: string;
  initialNotes: string;
  isReadOnly?: boolean;
  isSaving?: boolean;
  onSave: (notes: string) => void;
  onClose: () => void;
}

export const DailyNotesModal: React.FC<DailyNotesModalProps> = ({
  isOpen,
  dateLabel,
  initialNotes,
  isReadOnly = false,
  isSaving = false,
  onSave,
  onClose,
}) => {
  const [notes, setNotes] = useState(initialNotes);

  useEffect(() => {
    if (isOpen) {
      setNotes(initialNotes);
    }
  }, [isOpen, initialNotes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || isSaving) return;
    onSave(notes.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-notes-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-3xl w-full p-6 shadow-2xl shadow-black/80 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div
              className={`h-10 w-10 rounded-xl border flex items-center justify-center ${
                notes.trim()
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <StickyNote className="h-5 w-5" />
            </div>
            <div>
              <h2 id="daily-notes-modal-title" className="text-base font-bold text-white tracking-tight">
                Daily Notes
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {dateLabel} {isReadOnly ? '(Read-Only)' : ''}
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <MarkdownNotesEditor
            textareaId="daily-notes-textarea"
            value={notes}
            onChange={setNotes}
            rows={14}
            previewClassName="min-h-[280px] max-h-[55vh]"
            defaultTab="preview"
            readOnly={isReadOnly}
            placeholder="Capture check-in intentions, reflections, or markdown notes..."
          />

          <div className="flex items-center justify-end space-x-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg border border-slate-700/80 transition-colors"
            >
              {isReadOnly ? 'Close' : 'Cancel'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={isSaving}
                data-testid="save-daily-notes-btn"
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-lg shadow-emerald-600/20 transition-all"
              >
                {isSaving ? 'Saving...' : 'Save Notes'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
