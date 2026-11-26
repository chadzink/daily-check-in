import React, { useState, useRef } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Subtask } from '../../types/domain';

interface SubtaskListProps {
  taskId: string;
  subtasks: Subtask[];
  isReadOnly?: boolean;
  onUpdateSubtasks?: (nextSubtasks: Subtask[]) => void;
}

function createSubtaskId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const SubtaskList: React.FC<SubtaskListProps> = ({
  taskId,
  subtasks,
  isReadOnly = false,
  onUpdateSubtasks,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const addInputRef = useRef<HTMLInputElement>(null);

  const items = subtasks || [];
  const canEdit = !isReadOnly && !!onUpdateSubtasks;

  if (items.length === 0 && !canEdit) {
    return null;
  }

  const handleToggle = (subId: string) => {
    if (!canEdit || !onUpdateSubtasks) return;
    const next = items.map((s) =>
      s.id === subId ? { ...s, is_completed: !s.is_completed } : s
    );
    onUpdateSubtasks(next);
  };

  const startEditing = (sub: Subtask) => {
    if (!canEdit) return;
    setEditingId(sub.id);
    setEditingTitle(sub.title);
  };

  const commitEdit = (sub: Subtask) => {
    if (!canEdit || !onUpdateSubtasks) {
      setEditingId(null);
      return;
    }
    const trimmed = editingTitle.trim();
    setEditingId(null);
    if (!trimmed || trimmed === sub.title) return;
    const next = items.map((s) => (s.id === sub.id ? { ...s, title: trimmed } : s));
    onUpdateSubtasks(next);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingTitle('');
  };

  const handleDelete = (subId: string) => {
    if (!canEdit || !onUpdateSubtasks) return;
    const next = items
      .filter((s) => s.id !== subId)
      .map((s, idx) => ({ ...s, order: idx + 1 }));
    onUpdateSubtasks(next);
  };

  const handleAddSubmit = () => {
    if (!canEdit || !onUpdateSubtasks) return;
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    const next: Subtask[] = [
      ...items,
      {
        id: createSubtaskId(),
        title: trimmed,
        is_completed: false,
        order: items.length + 1,
      },
    ];
    onUpdateSubtasks(next);
    setNewTitle('');
    setTimeout(() => addInputRef.current?.focus(), 0);
  };

  return (
    <div
      data-testid={`subtask-list-${taskId}`}
      className="border-t border-slate-800/70 pt-2 mt-2 space-y-1.5"
    >
      {items.map((sub) => (
        <div
          key={sub.id}
          className="group/subtask flex items-center gap-2 text-xs"
        >
          <button
            type="button"
            data-testid={`subtask-checkbox-${sub.id}`}
            disabled={!canEdit}
            onClick={() => handleToggle(sub.id)}
            aria-label={sub.is_completed ? `Mark sub-task ${sub.title} incomplete` : `Mark sub-task ${sub.title} complete`}
            className={`h-3.5 w-3.5 rounded flex items-center justify-center transition-all flex-shrink-0 ${
              sub.is_completed
                ? 'bg-emerald-500 text-white border border-emerald-400'
                : 'border border-slate-600 hover:border-sky-400 bg-slate-800/60'
            } ${!canEdit ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
          >
            {sub.is_completed && <Check className="h-2.5 w-2.5 stroke-[3]" />}
          </button>

          {editingId === sub.id && canEdit ? (
            <input
              type="text"
              autoFocus
              data-testid={`subtask-edit-input-${sub.id}`}
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => commitEdit(sub)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitEdit(sub);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEdit();
                }
              }}
              className="flex-1 min-w-0 bg-slate-950/90 text-slate-200 text-xs rounded px-1.5 py-0.5 border border-sky-500/60 focus:outline-none focus:ring-1 focus:ring-sky-400"
            />
          ) : canEdit ? (
            <button
              type="button"
              data-testid={`subtask-title-${sub.id}`}
              onClick={() => startEditing(sub)}
              className={`flex-1 min-w-0 text-left truncate transition-colors ${
                sub.is_completed
                  ? 'line-through text-slate-500 hover:text-slate-400'
                  : 'text-slate-300 hover:text-white'
              }`}
              title="Click to edit sub-task"
            >
              {sub.title}
            </button>
          ) : (
            <span
              data-testid={`subtask-title-${sub.id}`}
              className={`flex-1 min-w-0 truncate ${
                sub.is_completed ? 'line-through text-slate-500' : 'text-slate-300'
              }`}
            >
              {sub.title}
            </span>
          )}

          {canEdit && (
            <button
              type="button"
              data-testid={`subtask-delete-${sub.id}`}
              onClick={() => handleDelete(sub.id)}
              aria-label={`Delete sub-task ${sub.title}`}
              title="Delete sub-task"
              className="p-0.5 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 opacity-0 group-hover/subtask:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        isAdding ? (
          <div className="flex items-center gap-1.5 pt-0.5">
            <input
              ref={addInputRef}
              type="text"
              autoFocus
              data-testid={`task-add-subtask-input-${taskId}`}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddSubmit();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setNewTitle('');
                  setIsAdding(false);
                }
              }}
              onBlur={() => {
                if (!newTitle.trim()) {
                  setIsAdding(false);
                }
              }}
              placeholder="Add sub-task... (Enter)"
              className="flex-1 min-w-0 bg-slate-950/80 text-slate-200 text-xs rounded-md px-2 py-1 border border-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500/60 focus:border-sky-500/60 placeholder:text-slate-600"
            />
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleAddSubmit}
              disabled={!newTitle.trim()}
              className="px-2 py-1 rounded-md text-[11px] font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white transition-colors"
            >
              Add
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setNewTitle('');
                setIsAdding(false);
              }}
              aria-label="Cancel adding sub-task"
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            data-testid={`task-add-subtask-trigger-${taskId}`}
            onClick={() => setIsAdding(true)}
            className="inline-flex items-center space-x-1 text-[11px] font-medium text-slate-500 hover:text-sky-400 transition-colors pt-0.5"
          >
            <Plus className="h-3 w-3" />
            <span>Add sub-task</span>
          </button>
        )
      )}
    </div>
  );
};
