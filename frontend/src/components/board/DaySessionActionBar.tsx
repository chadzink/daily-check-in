import React from 'react';
import { format } from 'date-fns';
import { Sun, Moon, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import { DaySession } from '../../types/domain';

interface DaySessionActionBarProps {
  session?: DaySession | null;
  onStartCheckIn: () => void;
  onStartCheckOut: () => void;
}

export const DaySessionActionBar: React.FC<DaySessionActionBarProps> = ({
  session,
  onStartCheckIn,
  onStartCheckOut,
}) => {
  const isCheckedIn = Boolean(session?.check_in_at);
  const isCheckedOut = Boolean(session?.check_out_at);

  const formatTimestamp = (timestamp?: string | null) => {
    if (!timestamp) return '';
    try {
      return format(new Date(timestamp), 'h:mm a');
    } catch {
      return '';
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-900/60 border border-slate-800/80 rounded-xl backdrop-blur-sm shadow-md">
      {/* Status Badges */}
      <div className="flex flex-wrap items-center gap-2.5">
        {isCheckedIn ? (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Sun className="h-3.5 w-3.5 text-emerald-400" />
            <span>Checked In at {formatTimestamp(session?.check_in_at)}</span>
          </div>
        ) : (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium">
            <Sun className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span>Check-in Pending</span>
          </div>
        )}

        {isCheckedOut ? (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
            <span>Checked Out at {formatTimestamp(session?.check_out_at)}</span>
          </div>
        ) : isCheckedIn ? (
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 text-sky-400" />
            <span>Day in Progress</span>
          </div>
        ) : null}

        {session?.notes && (
          <span className="text-xs text-slate-400 italic hidden md:inline-block max-w-md truncate">
            &ldquo;{session.notes}&rdquo;
          </span>
        )}
      </div>

      {/* Ritual Action Triggers */}
      <div className="flex items-center space-x-2">
        {!isCheckedIn && (
          <button
            onClick={onStartCheckIn}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Start Morning Check-In</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        )}

        {isCheckedIn && !isCheckedOut && (
          <button
            onClick={onStartCheckOut}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium shadow-sm transition-all hover:border-slate-600 active:scale-[0.98]"
          >
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
            <span>Check-Out (End Workday)</span>
          </button>
        )}
      </div>
    </div>
  );
};
