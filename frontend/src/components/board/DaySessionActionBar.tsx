import React from 'react';
import { format } from 'date-fns';
import { Sun, Moon, CheckCircle2, ArrowRight, Sparkles, FileText, History } from 'lucide-react';
import { DaySession } from '../../types/domain';

interface DaySessionActionBarProps {
  session?: DaySession | null;
  onStartCheckIn: () => void;
  onStartCheckOut: () => void;
  onExportStandup?: () => void;
  isReadOnly?: boolean;
}

export const DaySessionActionBar: React.FC<DaySessionActionBarProps> = ({
  session,
  onStartCheckIn,
  onStartCheckOut,
  onExportStandup,
  isReadOnly = false,
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
            <span>{isReadOnly ? 'No Check-in Recorded' : 'Check-in Pending'}</span>
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
            <span>{isReadOnly ? 'Day Session Closed' : 'Day in Progress'}</span>
          </div>
        ) : null}

        {session?.notes && (
          <span className="text-xs text-slate-400 italic hidden md:inline-block max-w-md truncate">
            &ldquo;{session.notes}&rdquo;
          </span>
        )}
      </div>

      {/* Action Triggers */}
      <div className="flex items-center space-x-2">
        {/* Export Standup Button */}
        {onExportStandup && (
          <button
            type="button"
            onClick={onExportStandup}
            data-testid="export-standup-trigger-btn"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium shadow-sm transition-all"
            title="Export Standup Markdown for Slack or Teams"
          >
            <FileText className="h-3.5 w-3.5 text-indigo-400" />
            <span>Export Standup</span>
          </button>
        )}

        {/* Ritual Actions (disabled/hidden in read-only mode) */}
        {!isReadOnly ? (
          <>
            {!isCheckedIn && (
              <button
                type="button"
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
                type="button"
                onClick={onStartCheckOut}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs font-medium shadow-sm transition-all hover:border-slate-600 active:scale-[0.98]"
              >
                <Moon className="h-3.5 w-3.5 text-indigo-400" />
                <span>Check-Out (End Workday)</span>
              </button>
            )}
          </>
        ) : (
          <span className="inline-flex items-center space-x-1 text-xs text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
            <History className="h-3 w-3" />
            <span>Read-Only Session</span>
          </span>
        )}
      </div>
    </div>
  );
};
