import {
  BacklogResponse,
  CreateDayTaskPayload,
  CreateTaskPayload,
  DaySession,
  DaySessionWithTasks,
  DayTaskWithDetails,
  MasterTask,
  UpdateDaySessionPayload,
  UpdateDayTaskPayload,
  UpdateTaskPayload,
} from '../types/domain';

const BASE_URL = '/api';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.message || errorBody.error || `HTTP error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// Backlog API
export async function fetchBacklog(): Promise<BacklogResponse> {
  const res = await fetch(`${BASE_URL}/backlog`);
  return handleResponse<BacklogResponse>(res);
}

export async function createBacklogTask(payload: CreateTaskPayload): Promise<MasterTask> {
  const res = await fetch(`${BASE_URL}/backlog/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<MasterTask>(res);
}

export async function reorderBacklog(orderedTaskIds: string[]): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/backlog/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ordered_task_ids: orderedTaskIds }),
  });
  return handleResponse<{ success: boolean }>(res);
}

// Day Sessions API
export async function fetchDaySession(date: string): Promise<DaySessionWithTasks> {
  const res = await fetch(`${BASE_URL}/days/${date}`);
  return handleResponse<DaySessionWithTasks>(res);
}

export async function updateDaySession(
  date: string,
  payload: UpdateDaySessionPayload
): Promise<DaySession> {
  const res = await fetch(`${BASE_URL}/days/${date}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DaySession>(res);
}

export async function createDayTask(
  date: string,
  payload: CreateDayTaskPayload
): Promise<DayTaskWithDetails> {
  const res = await fetch(`${BASE_URL}/days/${date}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DayTaskWithDetails>(res);
}

export async function updateDayTask(
  date: string,
  dayTaskId: string,
  payload: UpdateDayTaskPayload
): Promise<DayTaskWithDetails> {
  const res = await fetch(`${BASE_URL}/days/${date}/tasks/${dayTaskId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<DayTaskWithDetails>(res);
}

export async function deleteDayTask(
  date: string,
  dayTaskId: string
): Promise<{ deleted: boolean }> {
  const res = await fetch(`${BASE_URL}/days/${date}/tasks/${dayTaskId}`, {
    method: 'DELETE',
  });
  return handleResponse<{ deleted: boolean }>(res);
}

export async function reorderDayTasks(
  date: string,
  orderedDayTaskIds: string[]
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE_URL}/days/${date}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ordered_day_task_ids: orderedDayTaskIds }),
  });
  return handleResponse<{ success: boolean }>(res);
}

// Master Tasks API
export async function createTask(payload: CreateTaskPayload): Promise<MasterTask> {
  const res = await fetch(`${BASE_URL}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<MasterTask>(res);
}

export async function getTask(id: string): Promise<MasterTask> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`);
  return handleResponse<MasterTask>(res);
}

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<MasterTask> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<MasterTask>(res);
}

export async function archiveTask(id: string): Promise<{ archived: boolean }> {
  const res = await fetch(`${BASE_URL}/tasks/${id}`, {
    method: 'DELETE',
  });
  return handleResponse<{ archived: boolean }>(res);
}
