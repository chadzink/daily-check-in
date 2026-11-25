import { format, parseISO, subDays, isValid } from 'date-fns';

export interface RelativeSectionLabels {
  yesterdayLabel: string;
  todayLabel: string;
  isCurrentDay: boolean;
}

/**
 * Returns "Yesterday" and "Today" when viewing the current local date,
 * or formatted calendar dates (e.g. "Sunday, Nov 22, 2026" and "Monday, Nov 23, 2026")
 * relative to the selected date when viewing a different date.
 */
export function getRelativeSectionLabels(
  dateStr?: string | null,
  referenceTodayStr?: string
): RelativeSectionLabels {
  const currentToday = referenceTodayStr ?? format(new Date(), 'yyyy-MM-dd');
  if (!dateStr || dateStr === currentToday) {
    return {
      yesterdayLabel: 'Yesterday',
      todayLabel: 'Today',
      isCurrentDay: true,
    };
  }

  const parsed = parseISO(dateStr);
  if (!isValid(parsed)) {
    return {
      yesterdayLabel: 'Yesterday',
      todayLabel: 'Today',
      isCurrentDay: true,
    };
  }

  return {
    yesterdayLabel: format(subDays(parsed, 1), 'EEEE, MMM d, yyyy'),
    todayLabel: format(parsed, 'EEEE, MMM d, yyyy'),
    isCurrentDay: false,
  };
}

/**
 * Returns a concise formatted date hint (e.g. "Mon, Nov 23") when the resolved
 * yesterday_date is older than calendar yesterday (selectedDate - 1 day).
 * Returns undefined when yesterday_date matches calendar yesterday or is absent.
 */
export function getYesterdayDateHint(
  selectedDateStr?: string | null,
  yesterdayDateStr?: string | null
): string | undefined {
  if (!selectedDateStr || !yesterdayDateStr) {
    return undefined;
  }

  const parsedSelected = parseISO(selectedDateStr);
  const parsedYesterday = parseISO(yesterdayDateStr);
  if (!isValid(parsedSelected) || !isValid(parsedYesterday)) {
    return undefined;
  }

  const calendarYesterday = format(subDays(parsedSelected, 1), 'yyyy-MM-dd');
  if (yesterdayDateStr === calendarYesterday) {
    return undefined;
  }

  return format(parsedYesterday, 'EEE, MMM d');
}
