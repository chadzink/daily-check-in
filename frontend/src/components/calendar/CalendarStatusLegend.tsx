import React from 'react';

export const CalendarStatusLegend: React.FC = () => {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400 pt-2.5 border-t border-slate-800/80">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-500/50" />
        <span>Complete</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-amber-400 shadow-sm shadow-amber-500/50" />
        <span>In Progress</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-slate-500" />
        <span>Session</span>
      </div>
    </div>
  );
};
