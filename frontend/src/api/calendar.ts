import { CalendarSummaryResponse } from '../types/domain';

const BASE_URL = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `HTTP error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Fetch monthly calendar summary with day statuses and completion metrics
export async function fetchCalendarSummary(month: string): Promise<CalendarSummaryResponse> {
  const res = await fetch(`${BASE_URL}/calendar/summary?month=${encodeURIComponent(month)}`);
  return handleResponse<CalendarSummaryResponse>(res);
}
