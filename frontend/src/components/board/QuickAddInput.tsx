import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

interface QuickAddInputProps {
  placeholder?: string;
  shortcutKey?: string;
  onAdd: (title: string) => void;
  isLoading?: boolean;
  autoFocus?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export const QuickAddInput: React.FC<QuickAddInputProps> = ({
  placeholder = 'Add a task...',
  shortcutKey,
  onAdd,
  isLoading = false,
  autoFocus = false,
  inputRef: externalRef,
}) => {
  const [title, setTitle] = useState('');
  const internalRef = useRef<HTMLInputElement>(null);
  const inputRef = externalRef || internalRef;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus, inputRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || isLoading) return;
    onAdd(trimmed);
    setTitle('');
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex items-center w-full">
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="w-full bg-slate-900/70 text-slate-200 text-xs sm:text-sm rounded-lg pl-3 pr-16 py-2 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/50 focus:border-sky-500/80 transition-all placeholder:text-slate-500 shadow-inner"
        />
        {shortcutKey && (
          <div className="absolute right-9 top-1/2 -translate-y-1/2 hidden sm:flex items-center pointer-events-none">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/60 rounded">
              {shortcutKey}
            </kbd>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={!title.trim() || isLoading}
        className="ml-2 h-8 w-8 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 border border-sky-500/30 flex items-center justify-center transition-all disabled:opacity-40 disabled:pointer-events-none flex-shrink-0 shadow-sm"
        title="Add task (Enter)"
      >
        <Plus className="h-4 w-4" />
      </button>
    </form>
  );
};
