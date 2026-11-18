import {
  CheckInContextResponse,
  DaySessionWithTasks,
  ExecuteCheckInRequest,
  ExecuteCheckOutRequest,
} from '../types/domain';
import { authFetch, BASE_URL, handleResponse } from './client';

// Fetch pre-flight context for morning check-in
export async function fetchCheckInContext(date: string): Promise<CheckInContextResponse> {
  const res = await authFetch(`${BASE_URL}/days/${date}/check-in/context`);
  return handleResponse<CheckInContextResponse>(res);
}

// Commit morning check-in state atomically
export async function executeMorningCheckIn(
  date: string,
  payload: ExecuteCheckInRequest
): Promise<DaySessionWithTasks> {
  const res = await authFetch(`${BASE_URL}/days/${date}/check-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DaySessionWithTasks>(res);
}

// Commit evening check-out and reflections
export async function executeCheckOut(
  date: string,
  payload: ExecuteCheckOutRequest
): Promise<DaySessionWithTasks> {
  const res = await authFetch(`${BASE_URL}/days/${date}/check-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DaySessionWithTasks>(res);
}
