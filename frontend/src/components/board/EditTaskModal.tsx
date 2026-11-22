import React, { useState, useEffect, useRef } from 'react';
import { Pencil, PlusCircle, X } from 'lucide-react';

interface EditTaskModalProps {
  isOpen: boolean;
  mode?: 'edit' | 'create';
  targetLabel?: string;
  initialTitle: string;
  initialDescription?: string;
  onConfirm: (title: string, description: string) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  isOpen,
  mode = 'edit',
  targetLabel,
  initialTitle,
  initialDescription = '',
  onConfirm,
  onCancel,
  isSaving = false,
}) => {
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle);
      setDescription(initialDescription || '');
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, initialTitle, initialDescription]);

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

  const trimmedTitle = title.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trimmedTitle || isSaving) return;
    onConfirm(trimmedTitle, description.trim());
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-task-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 shadow-2xl shadow-black/80 flex flex-col gap-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              {mode === 'create' ? <PlusCircle className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            </div>
            <div>
              <h2 id="edit-task-modal-title" className="text-base font-bold text-white tracking-tight">
                {mode === 'create'
                  ? targetLabel
                    ? `Add Task to ${targetLabel}`
                    : 'Add New Task'
                  : 'Edit Task'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {mode === 'create'
                  ? 'Enter a task title and optional description'
                  : 'Update the task title or description'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
            title="Cancel (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="edit-task-title" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Title <span className="text-rose-400">*</span>
            </label>
            <input
              id="edit-task-title"
              ref={titleInputRef}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title..."
              className="w-full bg-slate-950/80 text-slate-200 text-xs sm:text-sm rounded-xl px-3 py-2.5 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/80 transition-all placeholder:text-slate-600 shadow-inner"
            />
          </div>

          <div>
            <label htmlFor="edit-task-description" className="block text-xs font-semibold text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              id="edit-task-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes or context..."
              className="w-full bg-slate-950/80 text-slate-200 text-xs sm:text-sm rounded-xl p-3 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/80 transition-all placeholder:text-slate-600 resize-none shadow-inner"
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
              disabled={!trimmedTitle || isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 disabled:pointer-events-none rounded-lg shadow-lg shadow-sky-600/20 transition-all"
            >
              {isSaving
                ? mode === 'create'
                  ? 'Adding...'
                  : 'Saving...'
                : mode === 'create'
                ? 'Add Task'
                : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
