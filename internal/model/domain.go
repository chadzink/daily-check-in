package model

import (
	"errors"
	"time"
)

// Sentinel errors for domain operations
var (
	ErrNotFound     = errors.New("resource not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrInvalidInput = errors.New("invalid input")
	ErrConflict     = errors.New("resource conflict")
)

// DayStatus represents the lifecycle row of a task within a day session
type DayStatus string

const (
	StatusYesterday DayStatus = "YESTERDAY"
	StatusToday     DayStatus = "TODAY"
	StatusBlocked   DayStatus = "BLOCKED"
)

// DaySession represents an individual workday session for a user
type DaySession struct {
	ID         string     `firestore:"id" json:"id"`
	UserID     string     `firestore:"user_id" json:"user_id"`
	Date       string     `firestore:"date" json:"date"` // Format: YYYY-MM-DD
	CheckInAt  *time.Time `firestore:"check_in_at" json:"check_in_at"`
	CheckOutAt *time.Time `firestore:"check_out_at" json:"check_out_at"`
	Notes      string     `firestore:"notes" json:"notes"`
	CreatedAt  time.Time  `firestore:"created_at" json:"created_at"`
	UpdatedAt  time.Time  `firestore:"updated_at" json:"updated_at"`
}

// Task represents a persistent master task in the user's global task pool
type Task struct {
	ID           string     `firestore:"id" json:"id"`
	UserID       string     `firestore:"user_id" json:"user_id"`
	Title        string     `firestore:"title" json:"title"`
	Description  string     `firestore:"description" json:"description"`
	IsCompleted  bool       `firestore:"is_completed" json:"is_completed"`
	CompletedAt  *time.Time `firestore:"completed_at" json:"completed_at"`
	IsArchived   bool       `firestore:"is_archived" json:"is_archived"`
	BacklogOrder int        `firestore:"backlog_order" json:"backlog_order"`
	CreatedAt    time.Time  `firestore:"created_at" json:"created_at"`
	UpdatedAt    time.Time  `firestore:"updated_at" json:"updated_at"`
}

// DayTask binds a master task to a specific day session with day-specific execution metadata
type DayTask struct {
	ID            string     `firestore:"id" json:"id"`
	DaySessionID  string     `firestore:"day_session_id" json:"day_session_id"`
	TaskID        string     `firestore:"task_id" json:"task_id"`
	Status        DayStatus  `firestore:"status" json:"status"`
	IsCompleted   bool       `firestore:"is_completed" json:"is_completed"`
	CompletedAt   *time.Time `firestore:"completed_at" json:"completed_at"`
	PriorityOrder int        `firestore:"priority_order" json:"priority_order"`
	BlockerReason string     `firestore:"blocker_reason,omitempty" json:"blocker_reason,omitempty"`
	CreatedAt     time.Time  `firestore:"created_at" json:"created_at"`
	UpdatedAt     time.Time  `firestore:"updated_at" json:"updated_at"`
}

// DayTaskWithDetails joins a DayTask with its master Task attributes for atomic UI rendering
type DayTaskWithDetails struct {
	DayTaskID     string     `json:"day_task_id"`
	TaskID        string     `json:"task_id"`
	Title         string     `json:"title"`
	Description   string     `json:"description"`
	Status        DayStatus  `json:"status"`
	IsCompleted   bool       `json:"is_completed"`
	CompletedAt   *time.Time `json:"completed_at"`
	PriorityOrder int        `json:"priority_order"`
	BlockerReason *string    `json:"blocker_reason"`
}

// DayTasksGrouped groups tasks by execution status
type DayTasksGrouped struct {
	Yesterday []DayTaskWithDetails `json:"yesterday"`
	Today     []DayTaskWithDetails `json:"today"`
	Blocked   []DayTaskWithDetails `json:"blocked"`
}

// DaySessionWithTasks delivers the complete daily workspace in a single round-trip
type DaySessionWithTasks struct {
	Session DaySession      `json:"session"`
	Tasks   DayTasksGrouped `json:"tasks"`
}

// --- Request & Response DTOs ---

// CreateTaskRequest specifies parameters to create a new master task
type CreateTaskRequest struct {
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	BacklogOrder int        `json:"backlog_order"`
	TargetDate   string     `json:"target_date,omitempty"` // Optional: YYYY-MM-DD
	Status       *DayStatus `json:"status,omitempty"`      // Optional: YESTERDAY, TODAY, BLOCKED
}

// UpdateTaskRequest specifies mutable properties of a master task
type UpdateTaskRequest struct {
	Title        *string `json:"title,omitempty"`
	Description  *string `json:"description,omitempty"`
	IsCompleted  *bool   `json:"is_completed,omitempty"`
	BacklogOrder *int    `json:"backlog_order,omitempty"`
	IsArchived   *bool   `json:"is_archived,omitempty"`
}

// ReorderBacklogRequest holds ordered task IDs for backlog reordering
type ReorderBacklogRequest struct {
	OrderedTaskIDs []string `json:"ordered_task_ids"`
}

// BacklogResponse wraps the global backlog task list
type BacklogResponse struct {
	Tasks []*Task `json:"tasks"`
}

// UpdateDaySessionRequest specifies mutable properties of a day session
type UpdateDaySessionRequest struct {
	CheckInAt  *time.Time `json:"check_in_at,omitempty"`
	CheckOutAt *time.Time `json:"check_out_at,omitempty"`
	Notes      *string    `json:"notes,omitempty"`
}

// CreateDayTaskRequest specifies parameters for committing a task to a day session
type CreateDayTaskRequest struct {
	TaskID        string    `json:"task_id"`
	Status        DayStatus `json:"status"`
	PriorityOrder int       `json:"priority_order"`
	BlockerReason string    `json:"blocker_reason,omitempty"`
}

// UpdateDayTaskRequest specifies mutable properties of a day task
type UpdateDayTaskRequest struct {
	Status        *DayStatus `json:"status,omitempty"`
	IsCompleted   *bool      `json:"is_completed,omitempty"`
	PriorityOrder *int       `json:"priority_order,omitempty"`
	BlockerReason *string    `json:"blocker_reason,omitempty"`
}

// PullDayTaskRequest specifies parameters to pull a master task into a day session
type PullDayTaskRequest struct {
	TaskID        string    `json:"task_id"`
	Status        DayStatus `json:"status,omitempty"`
	PriorityOrder int       `json:"priority_order,omitempty"`
}

// ReorderDayTasksRequest holds ordered day task IDs for reordering within a day
type ReorderDayTasksRequest struct {
	DaySessionDate    string     `json:"day_session_date,omitempty"`
	Status            *DayStatus `json:"status,omitempty"`
	OrderedDayTaskIDs []string   `json:"ordered_day_task_ids"`
}

// RolloverAction represents triage decision for an incomplete task during morning check-in
type RolloverAction string

const (
	RolloverToToday   RolloverAction = "ROLLOVER"
	RolloverDemote    RolloverAction = "DEMOTE"
	RolloverCompleted RolloverAction = "COMPLETE"
)

// RolloverDecision captures the user's action on an incomplete task
type RolloverDecision struct {
	DayTaskID string         `json:"day_task_id"`
	TaskID    string         `json:"task_id"`
	Action    RolloverAction `json:"action"`
}

// CheckInContextResponse provides pre-flight data to populate Morning Check-In wizard
type CheckInContextResponse struct {
	TargetDate         string               `json:"target_date"`
	PreviousDate       string               `json:"previous_date,omitempty"`
	YesterdayTasks     []DayTaskWithDetails `json:"yesterday_tasks"`
	RolloverCandidates []DayTaskWithDetails `json:"rollover_candidates"`
	BacklogTasks       []*Task              `json:"backlog_tasks"`
	IsAlreadyCheckedIn bool                 `json:"is_already_checked_in"`
}

// ExecuteCheckInRequest defines payload submitted from Morning Check-In wizard
type ExecuteCheckInRequest struct {
	RolloverDecisions []RolloverDecision `json:"rollover_decisions"`
	PullTaskIDs       []string           `json:"pull_task_ids"`
	TodayTaskIDs      []string           `json:"today_task_ids"` // Final 1..N order
	BlockedTaskIDs    []string           `json:"blocked_task_ids,omitempty"`
	Notes             string             `json:"notes,omitempty"`
}

// ExecuteCheckOutRequest defines payload submitted from Evening Check-Out wizard
type ExecuteCheckOutRequest struct {
	DemoteTaskIDs   []string `json:"demote_task_ids"`
	CompleteTaskIDs []string `json:"complete_task_ids"`
	Notes           string   `json:"notes,omitempty"`
}

// StandardErrorResponse represents standard API error responses
type StandardErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
	Code    string `json:"code,omitempty"`
}

// DaySummary represents daily session and task metrics for a calendar date
type DaySummary struct {
	Date               string `json:"date"` // Format: YYYY-MM-DD
	HasSession         bool   `json:"has_session"`
	HasCheckIn         bool   `json:"has_check_in"`
	HasCheckOut        bool   `json:"has_check_out"`
	CompletedTaskCount int    `json:"completed_task_count"`
	TotalTaskCount     int    `json:"total_task_count"`
}

// CalendarSummaryResponse wraps month-level day summaries
type CalendarSummaryResponse struct {
	Month string       `json:"month"` // Format: YYYY-MM
	Days  []DaySummary `json:"days"`
}
