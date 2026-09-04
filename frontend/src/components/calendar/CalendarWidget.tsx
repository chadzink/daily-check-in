import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  format,
  parseISO,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  getDate,
} from 'date-fns';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { useDateContext } from '../../context/DateContext';
import { useCalendarSummary } from '../../hooks/useCalendar';
import { MonthNavigation } from './MonthNavigation';
import { CalendarDayCell } from './CalendarDayCell';
import { CalendarStatusLegend } from './CalendarStatusLegend';
import { DaySummary } from '../../types/domain';

export const CalendarWidget: React.FC = () => {
  const { selectedDate, today, selectDate, jumpToToday } = useDateContext();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse currently selected date into Date object
  const selectedDateObj = useMemo(() => {
    try {
      return parseISO(selectedDate);
    } catch {
      return new Date();
    }
  }, [selectedDate]);

  // Track the month being viewed in the calendar
  const [displayedMonth, setDisplayedMonth] = useState<Date>(selectedDateObj);

  // Sync displayed month when selectedDate changes
  useEffect(() => {
    setDisplayedMonth(selectedDateObj);
  }, [selectedDateObj]);

  const monthParam = format(displayedMonth, 'yyyy-MM');
  const { data: summaryData } = useCalendarSummary(monthParam);

  // Close popover when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Month navigation handlers
  const handlePrevMonth = () => setDisplayedMonth((prev) => subMonths(prev, 1));
  const handleNextMonth = () => setDisplayedMonth((prev) => addMonths(prev, 1));
  const handleJumpToday = () => {
    jumpToToday();
    setDisplayedMonth(new Date());
    setIsOpen(false);
  };

  const handleSelectDate = (dateStr: string) => {
    selectDate(dateStr);
    setIsOpen(false);
  };

  // Build days grid
  const daysInGrid = useMemo(() => {
    const monthStart = startOfMonth(displayedMonth);
    const monthEnd = endOfMonth(displayedMonth);
    const gridStart = startOfWeek(monthStart);
    const gridEnd = endOfWeek(monthEnd);

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [displayedMonth]);

  // Map day summaries by date string
  const summaryByDate = useMemo(() => {
    const map = new Map<string, DaySummary>();
    if (summaryData?.days) {
      for (const d of summaryData.days) {
        map.set(d.date, d);
      }
    }
    return map;
  }, [summaryData]);

  const formattedSelected = useMemo(() => {
    try {
      return format(selectedDateObj, 'EEEE, MMM d, yyyy');
    } catch {
      return selectedDate;
    }
  }, [selectedDateObj, selectedDate]);

  const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        data-testid="calendar-widget-toggle"
        className={`inline-flex items-center space-x-2 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${
          isOpen
            ? 'bg-slate-800 border-indigo-500 text-white shadow-md shadow-indigo-500/10'
            : 'bg-slate-800/60 hover:bg-slate-800 border-slate-700/60 text-slate-200 hover:text-white'
        }`}
      >
        <CalendarIcon className="h-3.5 w-3.5 text-indigo-400" />
        <span className="hidden sm:inline">{formattedSelected}</span>
        <span className="sm:hidden font-mono">{selectedDate}</span>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          data-testid="calendar-popover"
          className="absolute right-0 sm:left-0 sm:right-auto mt-2 w-72 rounded-2xl p-4 bg-slate-900/95 border border-slate-700/80 shadow-2xl shadow-black/80 backdrop-blur-xl z-50 animate-in fade-in zoom-in-95"
        >
          {/* Header with Month / Navigation */}
          <MonthNavigation
            displayedMonth={displayedMonth}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onJumpToday={handleJumpToday}
          />

          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 gap-1 text-center py-2">
            {dayHeaders.map((day) => (
              <span key={day} className="text-[11px] font-semibold text-slate-500 uppercase">
                {day}
              </span>
            ))}
          </div>

          {/* Calendar Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysInGrid.map((dayDate) => {
              const dateStr = format(dayDate, 'yyyy-MM-dd');
              const dayNum = getDate(dayDate);
              const isCurrentMonth = isSameMonth(dayDate, displayedMonth);
              const isSelected = dateStr === selectedDate;
              const isCellToday = dateStr === today;
              const summary = summaryByDate.get(dateStr);

              return (
                <CalendarDayCell
                  key={dateStr}
                  dateStr={dateStr}
                  dayNumber={dayNum}
                  isCurrentMonth={isCurrentMonth}
                  isToday={isCellToday}
                  isSelected={isSelected}
                  summary={summary}
                  onSelect={handleSelectDate}
                />
              );
            })}
          </div>

          {/* Status Legend */}
          <CalendarStatusLegend />
        </div>
      )}
    </div>
  );
};
