import React from 'react';
import { History, ArrowRight } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useDateContext } from '../../context/DateContext';

interface HistoricalDateBannerProps {
  selectedDate?: string;
  isHistorical?: boolean;
  onReturnToToday?: () => void;
}

export const HistoricalDateBanner: React.FC<HistoricalDateBannerProps> = (props) => {
  let context: ReturnType<typeof useDateContext> | null = null;
  try {
    context = useDateContext();
  } catch {
    // Graceful fallback when rendered outside DateProvider in test mocks
  }

  const isHistorical = props.isHistorical ?? context?.isHistorical ?? false;
  const selectedDate = props.selectedDate ?? context?.selectedDate ?? '';
  const jumpToToday = props.onReturnToToday ?? context?.jumpToToday ?? (() => {});

  if (!isHistorical || !selectedDate) {
    return null;
  }

  let formatted = selectedDate;
  try {
    formatted = format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy');
  } catch {
    // fallback to raw date string
  }

  return (
    <div
      data-testid="historical-date-banner"
      className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/30 text-amber-200 shadow-lg shadow-amber-950/20 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in"
    >
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
          <History className="h-5 w-5" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-amber-100 flex items-center gap-2">
            <span>Viewing Historical Session (Read-Only)</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {selectedDate}
            </span>
          </h3>
          <p className="text-xs text-amber-300/80 mt-0.5">
            Past sessions are locked for historical auditing. Actions and editing are disabled for {formatted}.
          </p>
        </div>
      </div>

      <button
        onClick={jumpToToday}
        data-testid="return-to-today-btn"
        className="inline-flex items-center justify-center space-x-2 px-3.5 py-2 rounded-lg bg-amber-500/25 hover:bg-amber-500/35 text-amber-100 border border-amber-500/40 text-xs font-semibold shadow-sm transition-all flex-shrink-0"
      >
        <span>Return to Today</span>
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
