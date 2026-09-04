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

export interface PullDayTaskPayload {
  task_id: string;
  status: DayStatus;
  priority_order?: number;
}

export interface ReorderDayTasksPayload {
  day_session_date?: string;
  status?: DayStatus;
  ordered_day_task_ids: string[];
}

export type RolloverAction = 'ROLLOVER' | 'DEMOTE' | 'COMPLETE';

export interface RolloverDecision {
  day_task_id: string;
  task_id: string;
  action: RolloverAction;
}

export interface CheckInContextResponse {
  target_date: string;
  previous_date?: string;
  yesterday_tasks: DayTaskWithDetails[];
  rollover_candidates: DayTaskWithDetails[];
  backlog_tasks: MasterTask[];
  is_already_checked_in: boolean;
}

export interface ExecuteCheckInRequest {
  rollover_decisions: RolloverDecision[];
  pull_task_ids: string[];
  today_task_ids: string[];
  blocked_task_ids?: string[];
  notes?: string;
}

export interface ExecuteCheckOutRequest {
  demote_task_ids: string[];
  complete_task_ids: string[];
  notes?: string;
}

export interface DaySummary {
  date: string;
  has_session: boolean;
  has_check_in: boolean;
  has_check_out: boolean;
  completed_task_count: number;
  total_task_count: number;
}

export interface CalendarSummaryResponse {
  month: string;
  days: DaySummary[];
}

export interface StandupExportOptions {
  includeCompleted: boolean;
  includeBlockerReasons: boolean;
  bulletStyle: '-' | '*';
}

