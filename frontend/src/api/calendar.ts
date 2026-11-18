import { CalendarSummaryResponse } from '../types/domain';
import { authFetch, BASE_URL, handleResponse } from './client';

// Fetch monthly calendar summary with day statuses and completion metrics
export async function fetchCalendarSummary(month: string): Promise<CalendarSummaryResponse> {
  const res = await authFetch(`${BASE_URL}/calendar/summary?month=${encodeURIComponent(month)}`);
  return handleResponse<CalendarSummaryResponse>(res);
}
