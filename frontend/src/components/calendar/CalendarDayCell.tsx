import React from 'react';
import { DaySummary } from '../../types/domain';

interface CalendarDayCellProps {
  dateStr: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  summary?: DaySummary;
  onSelect: (dateStr: string) => void;
}

export const CalendarDayCell: React.FC<CalendarDayCellProps> = ({
  dateStr,
  dayNumber,
  isCurrentMonth,
  isToday,
  isSelected,
  summary,
  onSelect,
}) => {
  // Determine status dot
  let dotColor = '';
  let tooltipText = dateStr;

  if (summary?.has_session) {
    if (summary.has_check_in && summary.has_check_out) {
      dotColor = 'bg-emerald-400 shadow-sm shadow-emerald-500/50';
      tooltipText = `${dateStr}: Checked in & checked out (${summary.completed_task_count}/${summary.total_task_count} completed)`;
    } else if (summary.has_check_in) {
      dotColor = 'bg-amber-400 shadow-sm shadow-amber-500/50';
      tooltipText = `${dateStr}: Checked in, active (${summary.completed_task_count}/${summary.total_task_count} completed)`;
    } else {
      dotColor = 'bg-slate-500';
      tooltipText = `${dateStr}: Session recorded (${summary.completed_task_count}/${summary.total_task_count} completed)`;
    }
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(dateStr)}
      title={tooltipText}
      data-testid={`calendar-cell-${dateStr}`}
      className={`relative h-9 w-9 rounded-lg flex flex-col items-center justify-center transition-all group focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        !isCurrentMonth
          ? 'text-slate-600 opacity-40 hover:opacity-75'
          : isSelected
          ? 'bg-indigo-600/30 text-white font-bold ring-2 ring-indigo-500 shadow-md shadow-indigo-500/20'
          : isToday
          ? 'bg-slate-800/90 text-indigo-300 font-bold border border-indigo-500/40 hover:bg-slate-700'
          : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
      }`}
    >
      <span className="text-xs">{dayNumber}</span>
      {dotColor && (
        <span
          data-testid={`status-dot-${dateStr}`}
          className={`h-1.5 w-1.5 rounded-full mt-0.5 ${dotColor}`}
        />
      )}
    </button>
  );
};
