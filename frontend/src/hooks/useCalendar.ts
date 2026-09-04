import { useQuery } from '@tanstack/react-query';
import { fetchCalendarSummary } from '../api/calendar';

export function useCalendarSummary(month: string) {
  return useQuery({
    queryKey: ['calendarSummary', month],
    queryFn: () => fetchCalendarSummary(month),
    enabled: Boolean(month),
    staleTime: 1000 * 60, // 1 minute
  });
}
