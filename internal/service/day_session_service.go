package service

import (
	"context"
	"fmt"
	"time"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
	"github.com/google/uuid"
)

// DaySessionService orchestrates day sessions and joined DayTaskWithDetails
type DaySessionService interface {
	GetDaySessionWithTasks(ctx context.Context, userID, date string) (*model.DaySessionWithTasks, error)
	UpdateDaySession(ctx context.Context, userID, date string, req model.UpdateDaySessionRequest) (*model.DaySession, error)
	CreateDayTask(ctx context.Context, userID, date string, req model.CreateDayTaskRequest) (*model.DayTaskWithDetails, error)
	UpdateDayTask(ctx context.Context, userID, date, dayTaskID string, req model.UpdateDayTaskRequest) (*model.DayTaskWithDetails, error)
	DeleteDayTask(ctx context.Context, userID, date, dayTaskID string) error
	ReorderDayTasks(ctx context.Context, userID, date string, req model.ReorderDayTasksRequest) error
	PullDayTask(ctx context.Context, userID, date string, req model.PullDayTaskRequest) (*model.DayTask, error)
	DemoteDayTask(ctx context.Context, userID, date, dayTaskID string) error
	PatchDayTask(ctx context.Context, userID, dayTaskID string, req model.UpdateDayTaskRequest) (*model.DayTask, error)
	ReorderDayTasksDirect(ctx context.Context, userID string, req model.ReorderDayTasksRequest) error
}

type daySessionService struct {
	daySessionRepo repository.DaySessionRepository
	dayTaskRepo    repository.DayTaskRepository
	taskRepo       repository.TaskRepository
}

// NewDaySessionService constructs a DaySessionService
func NewDaySessionService(
	daySessionRepo repository.DaySessionRepository,
	dayTaskRepo repository.DayTaskRepository,
	taskRepo repository.TaskRepository,
) DaySessionService {
	return &daySessionService{
		daySessionRepo: daySessionRepo,
		dayTaskRepo:    dayTaskRepo,
		taskRepo:       taskRepo,
	}
}

// GetDaySessionWithTasks executes a batched join to retrieve a session and its tasks without N+1 queries.
func (s *daySessionService) GetDaySessionWithTasks(ctx context.Context, userID, date string) (*model.DaySessionWithTasks, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if date == "" {
		return nil, fmt.Errorf("%w: date is required", model.ErrInvalidInput)
	}

	// 1. Fetch or initialize the DaySession
	session, err := s.daySessionRepo.GetOrCreateByDate(ctx, userID, date)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve day session: %w", err)
	}

	// 2. Fetch day tasks committed to this date
	dayTasks, err := s.dayTaskRepo.ListByDate(ctx, userID, date)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve day tasks: %w", err)
	}

	// 3. Extract unique master task IDs for a single batched fetch
	taskIDs := make([]string, 0, len(dayTasks))
	for _, dt := range dayTasks {
		if dt.TaskID != "" {
			taskIDs = append(taskIDs, dt.TaskID)
		}
	}

	// 4. Batched fetch of master tasks (0 or 1 round trip total)
	tasksMap, err := s.taskRepo.GetByIDs(ctx, userID, taskIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to batch fetch task details: %w", err)
	}

	// 5. Join DayTask with master Task attributes and partition into execution rows
	grouped := model.DayTasksGrouped{
		Yesterday: make([]model.DayTaskWithDetails, 0),
		Today:     make([]model.DayTaskWithDetails, 0),
		Blocked:   make([]model.DayTaskWithDetails, 0),
	}

	for _, dt := range dayTasks {
		var title, description string
		if masterTask, ok := tasksMap[dt.TaskID]; ok {
			title = masterTask.Title
			description = masterTask.Description
		}

		var blockerPtr *string
		if dt.BlockerReason != "" {
			reason := dt.BlockerReason
			blockerPtr = &reason
		}

		detail := model.DayTaskWithDetails{
			DayTaskID:     dt.ID,
			TaskID:        dt.TaskID,
			Title:         title,
			Description:   description,
			Status:        dt.Status,
			IsCompleted:   dt.IsCompleted,
			CompletedAt:   dt.CompletedAt,
			PriorityOrder: dt.PriorityOrder,
			BlockerReason: blockerPtr,
		}

		switch dt.Status {
		case model.StatusYesterday:
			grouped.Yesterday = append(grouped.Yesterday, detail)
		case model.StatusToday:
			grouped.Today = append(grouped.Today, detail)
		case model.StatusBlocked:
			grouped.Blocked = append(grouped.Blocked, detail)
		default:
			grouped.Today = append(grouped.Today, detail)
		}
	}

	return &model.DaySessionWithTasks{
		Session: *session,
		Tasks:   grouped,
	}, nil
}

func (s *daySessionService) UpdateDaySession(ctx context.Context, userID, date string, req model.UpdateDaySessionRequest) (*model.DaySession, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if date == "" {
		return nil, fmt.Errorf("%w: date is required", model.ErrInvalidInput)
	}

	session, err := s.daySessionRepo.GetOrCreateByDate(ctx, userID, date)
	if err != nil {
		return nil, err
	}

	if req.CheckInAt != nil {
		session.CheckInAt = req.CheckInAt
	}
	if req.CheckOutAt != nil {
		session.CheckOutAt = req.CheckOutAt
	}
	if req.Notes != nil {
		session.Notes = *req.Notes
	}

	if err := s.daySessionRepo.Update(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to update day session: %w", err)
	}

	return session, nil
}

func (s *daySessionService) CreateDayTask(ctx context.Context, userID, date string, req model.CreateDayTaskRequest) (*model.DayTaskWithDetails, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if date == "" || req.TaskID == "" {
		return nil, fmt.Errorf("%w: date and task_id are required", model.ErrInvalidInput)
	}

	// Ensure session exists
	if _, err := s.daySessionRepo.GetOrCreateByDate(ctx, userID, date); err != nil {
		return nil, err
	}

	// Verify master task exists
	masterTask, err := s.taskRepo.GetByID(ctx, userID, req.TaskID)
	if err != nil {
		return nil, err
	}

	status := req.Status
	if status == "" {
		status = model.StatusToday
	}

	priorityOrder := req.PriorityOrder
	if priorityOrder <= 0 {
		existing, _ := s.dayTaskRepo.ListByDate(ctx, userID, date)
		priorityOrder = len(existing) + 1
	}

	dayTask := &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  date,
		TaskID:        req.TaskID,
		Status:        status,
		IsCompleted:   false,
		PriorityOrder: priorityOrder,
		BlockerReason: req.BlockerReason,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	if err := s.dayTaskRepo.Create(ctx, userID, date, dayTask); err != nil {
		return nil, fmt.Errorf("failed to persist day task: %w", err)
	}

	var blockerPtr *string
	if dayTask.BlockerReason != "" {
		reason := dayTask.BlockerReason
		blockerPtr = &reason
	}

	return &model.DayTaskWithDetails{
		DayTaskID:     dayTask.ID,
		TaskID:        masterTask.ID,
		Title:         masterTask.Title,
		Description:   masterTask.Description,
		Status:        dayTask.Status,
		IsCompleted:   dayTask.IsCompleted,
		CompletedAt:   dayTask.CompletedAt,
		PriorityOrder: dayTask.PriorityOrder,
		BlockerReason: blockerPtr,
	}, nil
}

func (s *daySessionService) UpdateDayTask(ctx context.Context, userID, date, dayTaskID string, req model.UpdateDayTaskRequest) (*model.DayTaskWithDetails, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if date == "" || dayTaskID == "" {
		return nil, fmt.Errorf("%w: date and day_task_id are required", model.ErrInvalidInput)
	}

	dayTask, err := s.dayTaskRepo.GetByID(ctx, userID, date, dayTaskID)
	if err != nil {
		return nil, err
	}

	if req.Status != nil {
		dayTask.Status = *req.Status
	}
	if req.IsCompleted != nil {
		dayTask.IsCompleted = *req.IsCompleted
		if *req.IsCompleted {
			now := time.Now().UTC()
			dayTask.CompletedAt = &now
		} else {
			dayTask.CompletedAt = nil
		}
		// Synchronize completion with master task
		if masterTask, err := s.taskRepo.GetByID(ctx, userID, dayTask.TaskID); err == nil && masterTask != nil {
			masterTask.IsCompleted = *req.IsCompleted
			masterTask.CompletedAt = dayTask.CompletedAt
			_ = s.taskRepo.Update(ctx, masterTask)
		}
	}
	if req.PriorityOrder != nil {
		dayTask.PriorityOrder = *req.PriorityOrder
	}
	if req.BlockerReason != nil {
		dayTask.BlockerReason = *req.BlockerReason
	}

	if err := s.dayTaskRepo.Update(ctx, userID, date, dayTask); err != nil {
		return nil, fmt.Errorf("failed to update day task: %w", err)
	}

	masterTask, _ := s.taskRepo.GetByID(ctx, userID, dayTask.TaskID)
	var title, description string
	if masterTask != nil {
		title = masterTask.Title
		description = masterTask.Description
	}

	var blockerPtr *string
	if dayTask.BlockerReason != "" {
		reason := dayTask.BlockerReason
		blockerPtr = &reason
	}

	return &model.DayTaskWithDetails{
		DayTaskID:     dayTask.ID,
		TaskID:        dayTask.TaskID,
		Title:         title,
		Description:   description,
		Status:        dayTask.Status,
		IsCompleted:   dayTask.IsCompleted,
		CompletedAt:   dayTask.CompletedAt,
		PriorityOrder: dayTask.PriorityOrder,
		BlockerReason: blockerPtr,
	}, nil
}

func (s *daySessionService) DeleteDayTask(ctx context.Context, userID, date, dayTaskID string) error {
	if userID == "" {
		return model.ErrUnauthorized
	}
	return s.dayTaskRepo.Delete(ctx, userID, date, dayTaskID)
}

func (s *daySessionService) ReorderDayTasks(ctx context.Context, userID, date string, req model.ReorderDayTasksRequest) error {
	if userID == "" {
		return model.ErrUnauthorized
	}
	return s.dayTaskRepo.Reorder(ctx, userID, date, req.OrderedDayTaskIDs)
}

func (s *daySessionService) PullDayTask(ctx context.Context, userID, date string, req model.PullDayTaskRequest) (*model.DayTask, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if date == "" || req.TaskID == "" {
		return nil, fmt.Errorf("%w: date and task_id are required", model.ErrInvalidInput)
	}

	// Ensure session exists
	if _, err := s.daySessionRepo.GetOrCreateByDate(ctx, userID, date); err != nil {
		return nil, err
	}

	// Verify master task exists
	masterTask, err := s.taskRepo.GetByID(ctx, userID, req.TaskID)
	if err != nil {
		return nil, err
	}

	status := req.Status
	if status == "" {
		status = model.StatusToday
	}

	priorityOrder := req.PriorityOrder
	if priorityOrder <= 0 {
		existing, _ := s.dayTaskRepo.ListByDate(ctx, userID, date)
		priorityOrder = len(existing) + 1
	}

	dayTask := &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  date,
		TaskID:        masterTask.ID,
		Status:        status,
		IsCompleted:   false,
		PriorityOrder: priorityOrder,
		CreatedAt:     time.Now().UTC(),
		UpdatedAt:     time.Now().UTC(),
	}

	if err := s.dayTaskRepo.Create(ctx, userID, date, dayTask); err != nil {
		return nil, fmt.Errorf("failed to persist pulled day task: %w", err)
	}

	return dayTask, nil
}

func (s *daySessionService) DemoteDayTask(ctx context.Context, userID, date, dayTaskID string) error {
	if userID == "" {
		return model.ErrUnauthorized
	}
	if date == "" || dayTaskID == "" {
		return fmt.Errorf("%w: date and day_task_id are required", model.ErrInvalidInput)
	}
	return s.dayTaskRepo.Delete(ctx, userID, date, dayTaskID)
}

func (s *daySessionService) PatchDayTask(ctx context.Context, userID, dayTaskID string, req model.UpdateDayTaskRequest) (*model.DayTask, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if dayTaskID == "" {
		return nil, fmt.Errorf("%w: day_task_id is required", model.ErrInvalidInput)
	}

	dayTask, date, err := s.dayTaskRepo.FindByID(ctx, userID, dayTaskID)
	if err != nil {
		return nil, err
	}

	if req.Status != nil {
		dayTask.Status = *req.Status
	}
	if req.IsCompleted != nil {
		dayTask.IsCompleted = *req.IsCompleted
		if *req.IsCompleted {
			now := time.Now().UTC()
			dayTask.CompletedAt = &now
		} else {
			dayTask.CompletedAt = nil
		}
		// Synchronize completion with master task
		if masterTask, err := s.taskRepo.GetByID(ctx, userID, dayTask.TaskID); err == nil && masterTask != nil {
			masterTask.IsCompleted = *req.IsCompleted
			masterTask.CompletedAt = dayTask.CompletedAt
			_ = s.taskRepo.Update(ctx, masterTask)
		}
	}
	if req.PriorityOrder != nil {
		dayTask.PriorityOrder = *req.PriorityOrder
	}
	if req.BlockerReason != nil {
		dayTask.BlockerReason = *req.BlockerReason
	}

	if err := s.dayTaskRepo.Update(ctx, userID, date, dayTask); err != nil {
		return nil, fmt.Errorf("failed to update day task: %w", err)
	}

	return dayTask, nil
}

func (s *daySessionService) ReorderDayTasksDirect(ctx context.Context, userID string, req model.ReorderDayTasksRequest) error {
	if userID == "" {
		return model.ErrUnauthorized
	}
	if req.DaySessionDate == "" {
		return fmt.Errorf("%w: day_session_date is required", model.ErrInvalidInput)
	}
	return s.dayTaskRepo.Reorder(ctx, userID, req.DaySessionDate, req.OrderedDayTaskIDs)
}
