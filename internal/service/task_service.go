package service

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
	"github.com/google/uuid"
	"golang.org/x/sync/errgroup"
)

const (
	maxSubtasksPerTask  = 50
	maxSubtaskTitleLen  = 250
	backlogFetchWorkers = 10
)

// TaskService orchestrates business logic for master tasks and backlog management
type TaskService interface {
	CreateTask(ctx context.Context, userID string, req model.CreateTaskRequest) (*model.Task, error)
	GetTaskByID(ctx context.Context, userID, taskID string) (*model.Task, error)
	UpdateTask(ctx context.Context, userID, taskID string, req model.UpdateTaskRequest) (*model.Task, error)
	ArchiveTask(ctx context.Context, userID, taskID string) error
	ListBacklog(ctx context.Context, userID, todayDate string) (*model.BacklogResponse, error)
	ReorderBacklog(ctx context.Context, userID string, orderedIDs []string) error
	MoveTaskToDate(ctx context.Context, userID, taskID string, req model.MoveTaskToDateRequest) (*model.DayTaskWithDetails, error)
}

type taskService struct {
	taskRepo       repository.TaskRepository
	daySessionRepo repository.DaySessionRepository
	dayTaskRepo    repository.DayTaskRepository
}

// NewTaskService constructs a new TaskService
func NewTaskService(
	taskRepo repository.TaskRepository,
	daySessionRepo repository.DaySessionRepository,
	dayTaskRepo repository.DayTaskRepository,
) TaskService {
	return &taskService{
		taskRepo:       taskRepo,
		daySessionRepo: daySessionRepo,
		dayTaskRepo:    dayTaskRepo,
	}
}

func isValidDateYYYYMMDD(d string) bool {
	if len(d) != 10 {
		return false
	}
	_, err := time.Parse("2006-01-02", d)
	return err == nil
}

func resolveTodayDate(todayDate string) (string, error) {
	if todayDate == "" {
		return time.Now().UTC().Format("2006-01-02"), nil
	}
	if !isValidDateYYYYMMDD(todayDate) {
		return "", fmt.Errorf("%w: invalid today_date format (expected YYYY-MM-DD)", model.ErrInvalidInput)
	}
	return todayDate, nil
}

func normalizeSubtasks(subtasks []model.Subtask) []model.Subtask {
	if subtasks == nil {
		return make([]model.Subtask, 0)
	}
	out := make([]model.Subtask, len(subtasks))
	copy(out, subtasks)
	return out
}

func completeAllSubtasks(task *model.Task) {
	if task == nil {
		return
	}
	if task.Subtasks == nil {
		task.Subtasks = make([]model.Subtask, 0)
		return
	}
	for i := range task.Subtasks {
		task.Subtasks[i].IsCompleted = true
	}
}

func validateAndNormalizeSubtasks(subtasks []model.Subtask) ([]model.Subtask, error) {
	if len(subtasks) > maxSubtasksPerTask {
		return nil, fmt.Errorf("%w: maximum %d subtasks allowed per task", model.ErrInvalidInput, maxSubtasksPerTask)
	}

	normalized := make([]model.Subtask, 0, len(subtasks))
	for i, sub := range subtasks {
		title := strings.TrimSpace(sub.Title)
		if title == "" {
			return nil, fmt.Errorf("%w: subtask title cannot be empty", model.ErrInvalidInput)
		}
		if utf8.RuneCountInString(title) > maxSubtaskTitleLen {
			return nil, fmt.Errorf("%w: subtask title cannot exceed %d characters", model.ErrInvalidInput, maxSubtaskTitleLen)
		}
		id := strings.TrimSpace(sub.ID)
		if id == "" {
			id = uuid.New().String()
		}
		normalized = append(normalized, model.Subtask{
			ID:          id,
			Title:       title,
			IsCompleted: sub.IsCompleted,
			Order:       i + 1,
		})
	}
	return normalized, nil
}

func collectCommittedTaskIDsFromDate(
	ctx context.Context,
	daySessionRepo repository.DaySessionRepository,
	dayTaskRepo repository.DayTaskRepository,
	userID, startDate string,
) (map[string]bool, error) {
	committedIDs := make(map[string]bool)
	if daySessionRepo == nil || dayTaskRepo == nil || startDate == "" {
		return committedIDs, nil
	}

	sessions, err := daySessionRepo.ListFromDate(ctx, userID, startDate)
	if err != nil {
		return nil, err
	}
	if len(sessions) == 0 {
		return committedIDs, nil
	}

	var mu sync.Mutex
	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(backlogFetchWorkers)

	for _, sess := range sessions {
		if sess == nil || sess.Date == "" {
			continue
		}
		sessDate := sess.Date
		g.Go(func() error {
			dayTasks, listErr := dayTaskRepo.ListByDate(gctx, userID, sessDate)
			if listErr != nil {
				return listErr
			}
			mu.Lock()
			for _, dt := range dayTasks {
				if dt != nil && !dt.IsCompleted && dt.Status != model.StatusYesterday && dt.TaskID != "" {
					committedIDs[dt.TaskID] = true
				}
			}
			mu.Unlock()
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, err
	}
	return committedIDs, nil
}

func (s *taskService) CreateTask(ctx context.Context, userID string, req model.CreateTaskRequest) (*model.Task, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, fmt.Errorf("%w: task title cannot be empty", model.ErrInvalidInput)
	}

	var existingBacklogIDs []string
	backlogOrder := req.BacklogOrder
	if backlogOrder <= 0 {
		backlogOrder = 1
		if backlog, err := s.taskRepo.ListBacklog(ctx, userID); err == nil {
			existingBacklogIDs = make([]string, 0, len(backlog))
			for _, t := range backlog {
				existingBacklogIDs = append(existingBacklogIDs, t.ID)
			}
		}
	}

	task := &model.Task{
		ID:           uuid.New().String(),
		UserID:       userID,
		Title:        title,
		Description:  req.Description,
		IsCompleted:  false,
		IsArchived:   false,
		BacklogOrder: backlogOrder,
		Subtasks:     make([]model.Subtask, 0),
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to persist task: %w", err)
	}

	if len(existingBacklogIDs) > 0 {
		orderedIDs := append([]string{task.ID}, existingBacklogIDs...)
		_ = s.taskRepo.ReorderBacklog(ctx, userID, orderedIDs)
	}

	// Quick-add to day session if target_date and status are specified
	if req.TargetDate != "" && req.Status != nil && s.daySessionRepo != nil && s.dayTaskRepo != nil {
		if _, err := s.daySessionRepo.GetOrCreateByDate(ctx, userID, req.TargetDate); err == nil {
			var existingSameStatusIDs []string
			if existingDayTasks, listErr := s.dayTaskRepo.ListByDate(ctx, userID, req.TargetDate); listErr == nil {
				for _, dt := range existingDayTasks {
					if dt.Status == *req.Status {
						existingSameStatusIDs = append(existingSameStatusIDs, dt.ID)
					}
				}
			}

			dayTask := &model.DayTask{
				ID:            uuid.New().String(),
				DaySessionID:  req.TargetDate,
				TaskID:        task.ID,
				Status:        *req.Status,
				IsCompleted:   false,
				PriorityOrder: 1,
			}
			if createErr := s.dayTaskRepo.Create(ctx, userID, req.TargetDate, dayTask); createErr == nil && len(existingSameStatusIDs) > 0 {
				orderedDayIDs := append([]string{dayTask.ID}, existingSameStatusIDs...)
				_ = s.dayTaskRepo.Reorder(ctx, userID, req.TargetDate, orderedDayIDs)
			}
		}
	}

	return task, nil
}

func (s *taskService) GetTaskByID(ctx context.Context, userID, taskID string) (*model.Task, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if taskID == "" {
		return nil, fmt.Errorf("%w: task ID is required", model.ErrInvalidInput)
	}
	task, err := s.taskRepo.GetByID(ctx, userID, taskID)
	if err != nil {
		return nil, err
	}
	task.Subtasks = normalizeSubtasks(task.Subtasks)
	return task, nil
}

func (s *taskService) UpdateTask(ctx context.Context, userID, taskID string, req model.UpdateTaskRequest) (*model.Task, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if taskID == "" {
		return nil, fmt.Errorf("%w: task ID is required", model.ErrInvalidInput)
	}

	existing, err := s.taskRepo.GetByID(ctx, userID, taskID)
	if err != nil {
		return nil, err
	}

	if req.Title != nil {
		title := strings.TrimSpace(*req.Title)
		if title == "" {
			return nil, fmt.Errorf("%w: title cannot be blank", model.ErrInvalidInput)
		}
		existing.Title = title
	}
	if req.Description != nil {
		existing.Description = *req.Description
	}
	if req.BacklogOrder != nil {
		existing.BacklogOrder = *req.BacklogOrder
	}
	if req.IsArchived != nil {
		existing.IsArchived = *req.IsArchived
	}
	if req.Subtasks != nil {
		normalized, valErr := validateAndNormalizeSubtasks(*req.Subtasks)
		if valErr != nil {
			return nil, valErr
		}
		existing.Subtasks = normalized
	}
	if req.IsCompleted != nil {
		existing.IsCompleted = *req.IsCompleted
		if *req.IsCompleted {
			now := time.Now().UTC()
			existing.CompletedAt = &now
			completeAllSubtasks(existing)
		} else {
			existing.CompletedAt = nil
		}
	}
	existing.Subtasks = normalizeSubtasks(existing.Subtasks)

	if err := s.taskRepo.Update(ctx, existing); err != nil {
		return nil, fmt.Errorf("failed to update task: %w", err)
	}

	return existing, nil
}

func (s *taskService) ArchiveTask(ctx context.Context, userID, taskID string) error {
	if userID == "" {
		return model.ErrUnauthorized
	}
	if taskID == "" {
		return fmt.Errorf("%w: task ID is required", model.ErrInvalidInput)
	}
	return s.taskRepo.Archive(ctx, userID, taskID)
}

func (s *taskService) ListBacklog(ctx context.Context, userID, todayDate string) (*model.BacklogResponse, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}

	today, err := resolveTodayDate(todayDate)
	if err != nil {
		return nil, err
	}

	tasks, err := s.taskRepo.ListBacklog(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch backlog tasks: %w", err)
	}

	committedIDs, err := collectCommittedTaskIDsFromDate(ctx, s.daySessionRepo, s.dayTaskRepo, userID, today)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect committed day tasks: %w", err)
	}

	filtered := make([]*model.Task, 0, len(tasks))
	for _, t := range tasks {
		if t == nil || committedIDs[t.ID] {
			continue
		}
		t.Subtasks = normalizeSubtasks(t.Subtasks)
		filtered = append(filtered, t)
	}

	return &model.BacklogResponse{Tasks: filtered}, nil
}

func (s *taskService) ReorderBacklog(ctx context.Context, userID string, orderedIDs []string) error {
	if userID == "" {
		return model.ErrUnauthorized
	}
	return s.taskRepo.ReorderBacklog(ctx, userID, orderedIDs)
}

func (s *taskService) MoveTaskToDate(ctx context.Context, userID, taskID string, req model.MoveTaskToDateRequest) (*model.DayTaskWithDetails, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if taskID == "" {
		return nil, fmt.Errorf("%w: task ID is required", model.ErrInvalidInput)
	}
	if !isValidDateYYYYMMDD(req.TargetDate) {
		return nil, fmt.Errorf("%w: target_date must be in YYYY-MM-DD format", model.ErrInvalidInput)
	}
	if req.SourceDate != "" && !isValidDateYYYYMMDD(req.SourceDate) {
		return nil, fmt.Errorf("%w: source_date must be in YYYY-MM-DD format", model.ErrInvalidInput)
	}

	today, err := resolveTodayDate(req.TodayDate)
	if err != nil {
		return nil, err
	}
	if req.TargetDate <= today {
		return nil, fmt.Errorf("%w: target_date must be a future date", model.ErrInvalidInput)
	}
	if req.SourceDate != "" && req.TargetDate == req.SourceDate {
		return nil, fmt.Errorf("%w: target_date must differ from source_date", model.ErrInvalidInput)
	}

	masterTask, err := s.taskRepo.GetByID(ctx, userID, taskID)
	if err != nil {
		return nil, err
	}
	if masterTask.IsArchived {
		return nil, fmt.Errorf("%w: cannot move an archived task", model.ErrNotFound)
	}

	targetStatus := model.StatusToday
	targetBlockerReason := ""
	sourceDayTaskID := ""

	if req.SourceDate != "" {
		sourceDayTasks, listErr := s.dayTaskRepo.ListByDate(ctx, userID, req.SourceDate)
		if listErr != nil {
			return nil, fmt.Errorf("failed to list source day tasks: %w", listErr)
		}
		for _, dt := range sourceDayTasks {
			if dt == nil || dt.Status == model.StatusYesterday {
				continue
			}
			if (req.DayTaskID != "" && dt.ID == req.DayTaskID) || dt.TaskID == taskID {
				sourceDayTaskID = dt.ID
				if dt.Status == model.StatusBlocked {
					targetStatus = model.StatusBlocked
					targetBlockerReason = dt.BlockerReason
				}
				break
			}
		}
	}

	now := time.Now().UTC()
	targetExisting, err := s.dayTaskRepo.ListByDate(ctx, userID, req.TargetDate)
	if err != nil {
		return nil, fmt.Errorf("failed to list target day tasks: %w", err)
	}

	var targetDayTask *model.DayTask
	nonYesterdayCount := 0
	for _, dt := range targetExisting {
		if dt == nil || dt.Status == model.StatusYesterday {
			continue
		}
		nonYesterdayCount++
		if dt.TaskID == taskID && targetDayTask == nil {
			copied := *dt
			copied.Status = targetStatus
			copied.BlockerReason = targetBlockerReason
			copied.UpdatedAt = now
			targetDayTask = &copied
		}
	}

	if targetDayTask == nil {
		targetDayTask = &model.DayTask{
			ID:            uuid.New().String(),
			DaySessionID:  req.TargetDate,
			TaskID:        masterTask.ID,
			Status:        targetStatus,
			IsCompleted:   false,
			PriorityOrder: nonYesterdayCount + 1,
			BlockerReason: targetBlockerReason,
			CreatedAt:     now,
			UpdatedAt:     now,
		}
	}

	targetSession := &model.DaySession{
		ID:        req.TargetDate,
		UserID:    userID,
		Date:      req.TargetDate,
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := s.dayTaskRepo.MoveAtomic(ctx, userID, req.SourceDate, sourceDayTaskID, req.TargetDate, targetSession, targetDayTask); err != nil {
		return nil, fmt.Errorf("failed to move task to date: %w", err)
	}

	var blockerPtr *string
	if targetDayTask.BlockerReason != "" {
		reason := targetDayTask.BlockerReason
		blockerPtr = &reason
	}

	return &model.DayTaskWithDetails{
		DayTaskID:     targetDayTask.ID,
		TaskID:        masterTask.ID,
		Title:         masterTask.Title,
		Description:   masterTask.Description,
		Status:        targetDayTask.Status,
		IsCompleted:   targetDayTask.IsCompleted,
		CompletedAt:   targetDayTask.CompletedAt,
		PriorityOrder: targetDayTask.PriorityOrder,
		BlockerReason: blockerPtr,
		Subtasks:      normalizeSubtasks(masterTask.Subtasks),
	}, nil
}
