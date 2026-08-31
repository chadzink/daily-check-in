/**
 * Domain types matching backend models in internal/model/domain.go
 */

export type DayStatus = 'YESTERDAY' | 'TODAY' | 'BLOCKED';

export interface DaySession {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  check_in_at?: string | null;
  check_out_at?: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface MasterTask {
  id: string;
  user_id: string;
  title: string;
  description: string;
  is_completed: boolean;
  completed_at?: string | null;
  is_archived: boolean;
  backlog_order: number;
  created_at: string;
  updated_at: string;
}

export interface DayTaskWithDetails {
  day_task_id: string;
  task_id: string;
  title: string;
  description: string;
  status: DayStatus;
  is_completed: boolean;
  completed_at?: string | null;
  priority_order: number;
  blocker_reason?: string | null;
}

export interface DayTasksGrouped {
  yesterday: DayTaskWithDetails[];
  today: DayTaskWithDetails[];
  blocked: DayTaskWithDetails[];
}

export interface DaySessionWithTasks {
  session: DaySession;
  tasks: DayTasksGrouped;
}

export interface BacklogResponse {
  tasks: MasterTask[];
}

export interface CreateTaskPayload {
  title: string;
  description?: string;
  backlog_order?: number;
  target_date?: string;
  status?: DayStatus;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  is_completed?: boolean;
  backlog_order?: number;
  is_archived?: boolean;
}

export interface UpdateDaySessionPayload {
  check_in_at?: string | null;
  check_out_at?: string | null;
  notes?: string;
}

export interface CreateDayTaskPayload {
  task_id: string;
  status: DayStatus;
  priority_order?: number;
  blocker_reason?: string;
}

export interface UpdateDayTaskPayload {
  status?: DayStatus;
  is_completed?: boolean;
  priority_order?: number;
  blocker_reason?: string | null;
}
