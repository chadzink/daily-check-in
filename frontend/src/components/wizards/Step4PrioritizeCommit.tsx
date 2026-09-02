import React from 'react';
import { ArrowUp, ArrowDown, ListOrdered, FileText } from 'lucide-react';

export interface PrioritizedItem {
  id: string; // task_id
  title: string;
  source: 'rollover' | 'backlog' | 'existing';
}

interface Step4PrioritizeCommitProps {
  items: PrioritizedItem[];
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  notes: string;
  onNotesChange: (notes: string) => void;
}

export const Step4PrioritizeCommit: React.FC<Step4PrioritizeCommitProps> = ({
  items,
  onMoveUp,
  onMoveDown,
  notes,
  onNotesChange,
}) => {
  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <ListOrdered className="h-4 w-4 text-indigo-400" />
          <span>Prioritize Today&apos;s Commitments</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Order your active focus list 1..N and capture any intention notes for the day.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="p-6 text-center rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400">
          <p className="text-sm font-medium text-slate-300">
            No tasks queued for Today yet.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            You can still complete check-in and add tasks on the board as your day unfolds.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
          {items.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/70 border border-slate-800 hover:border-slate-700/80 transition-all"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <span className="h-6 w-6 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 font-mono text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  {index + 1}
                </span>
                <span className="text-xs font-medium text-slate-200 truncate">
                  {item.title}
                </span>
                <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700/50 flex-shrink-0">
                  {item.source}
                </span>
              </div>

              {/* Up / Down Controls */}
              <div className="flex items-center space-x-1 flex-shrink-0">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMoveUp(index)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move item up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={index === items.length - 1}
                  onClick={() => onMoveDown(index)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Move item down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Intention Notes */}
      <div className="pt-2 border-t border-slate-800">
        <label className="block text-xs font-medium text-slate-300 mb-1.5 flex items-center space-x-1.5">
          <FileText className="h-3.5 w-3.5 text-indigo-400" />
          <span>Morning Focus Notes (Optional)</span>
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="E.g., Deep focus block from 10am-12pm on core backend endpoints..."
          className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
        />
      </div>
    </div>
  );
};
