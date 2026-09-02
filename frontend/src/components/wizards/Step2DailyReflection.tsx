import React from 'react';
import { HeartHandshake, FileText } from 'lucide-react';

interface Step2DailyReflectionProps {
  notes: string;
  onNotesChange: (notes: string) => void;
  completedCount: number;
}

export const Step2DailyReflection: React.FC<Step2DailyReflectionProps> = ({
  notes,
  onNotesChange,
  completedCount,
}) => {
  return (
    <div className="space-y-4">
      <div className="pb-2 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
          <HeartHandshake className="h-4 w-4 text-indigo-400" />
          <span>Daily Reflection & State Closure</span>
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          End your day with intentional reflection and mental closure.
        </p>
      </div>

      <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-indigo-300">
        <p className="font-semibold text-white mb-0.5">Great effort today!</p>
        <p className="text-indigo-200/80">
          You completed <span className="font-bold text-emerald-400">{completedCount}</span> focus commitment(s). Record any reflections or hand-off notes before closing your session.
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-300 flex items-center space-x-1.5">
          <FileText className="h-3.5 w-3.5 text-indigo-400" />
          <span>Evening Reflections & Standup Notes (Optional)</span>
        </label>
        <textarea
          rows={4}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="What went well today? What will you pick up first tomorrow? Any lessons learned?"
          className="w-full px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
        />
      </div>
    </div>
  );
};
