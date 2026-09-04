import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

interface MonthNavigationProps {
  displayedMonth: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToday: () => void;
}

export const MonthNavigation: React.FC<MonthNavigationProps> = ({
  displayedMonth,
  onPrevMonth,
  onNextMonth,
  onJumpToday,
}) => {
  const monthYearLabel = format(displayedMonth, 'MMMM yyyy');

  return (
    <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
      <div className="flex items-center space-x-1">
        <h3
          data-testid="calendar-month-heading"
          className="text-sm font-semibold text-white tracking-tight"
        >
          {monthYearLabel}
        </h3>
      </div>

      <div className="flex items-center space-x-1">
        <button
          type="button"
          onClick={onJumpToday}
          data-testid="calendar-today-btn"
          className="text-[11px] font-medium px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition-colors"
        >
          Today
        </button>
        <button
          type="button"
          onClick={onPrevMonth}
          data-testid="calendar-prev-month"
          aria-label="Previous month"
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onNextMonth}
          data-testid="calendar-next-month"
          aria-label="Next month"
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
