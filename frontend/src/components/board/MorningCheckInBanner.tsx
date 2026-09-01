import React from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';

interface MorningCheckInBannerProps {
  onStartCheckIn: () => void;
  onDismiss: () => void;
}

export const MorningCheckInBanner: React.FC<MorningCheckInBannerProps> = ({
  onStartCheckIn,
  onDismiss,
}) => {
  return (
    <div
      data-testid="morning-checkin-banner"
      className="relative overflow-hidden rounded-xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/60 via-slate-900/80 to-sky-950/60 p-4 shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="h-10 w-10 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              Ready to begin your workday ritual?
            </h3>
            <p className="text-xs text-slate-300/80 mt-0.5">
              Review yesterday&apos;s accomplishments, triage rollover tasks, and prioritize today&apos;s commitments.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 flex-shrink-0">
          <button
            onClick={onStartCheckIn}
            className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Start Morning Check-In</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDismiss}
            aria-label="Dismiss banner"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
