package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
	"github.com/google/uuid"
)

// TaskService orchestrates business logic for master tasks and backlog management
type TaskService interface {
	CreateTask(ctx context.Context, userID string, req model.CreateTaskRequest) (*model.Task, error)
	GetTaskByID(ctx context.Context, userID, taskID string) (*model.Task, error)
	UpdateTask(ctx context.Context, userID, taskID string, req model.UpdateTaskRequest) (*model.Task, error)
	ArchiveTask(ctx context.Context, userID, taskID string) error
	ListBacklog(ctx context.Context, userID string) (*model.BacklogResponse, error)
	ReorderBacklog(ctx context.Context, userID string, orderedIDs []string) error
}

type taskService struct {
	taskRepo     repository.TaskRepository
	daySessionRepo repository.DaySessionRepository
	dayTaskRepo  repository.DayTaskRepository
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

func (s *taskService) CreateTask(ctx context.Context, userID string, req model.CreateTaskRequest) (*model.Task, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	title := strings.TrimSpace(req.Title)
	if title == "" {
		return nil, fmt.Errorf("%w: task title cannot be empty", model.ErrInvalidInput)
	}

	backlogOrder := req.BacklogOrder
	if backlogOrder <= 0 {
		backlog, err := s.taskRepo.ListBacklog(ctx, userID)
		if err == nil {
			backlogOrder = len(backlog) + 1
		} else {
			backlogOrder = 1
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
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, fmt.Errorf("failed to persist task: %w", err)
	}

	// Quick-add to day session if target_date and status are specified
	if req.TargetDate != "" && req.Status != nil && s.daySessionRepo != nil && s.dayTaskRepo != nil {
		if _, err := s.daySessionRepo.GetOrCreateByDate(ctx, userID, req.TargetDate); err == nil {
			dayTask := &model.DayTask{
				ID:            uuid.New().String(),
				DaySessionID:  req.TargetDate,
				TaskID:        task.ID,
				Status:        *req.Status,
				IsCompleted:   false,
				PriorityOrder: 1,
			}
			_ = s.dayTaskRepo.Create(ctx, userID, req.TargetDate, dayTask)
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
	return s.taskRepo.GetByID(ctx, userID, taskID)
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
	if req.IsCompleted != nil {
		existing.IsCompleted = *req.IsCompleted
		if *req.IsCompleted {
			now := time.Now().UTC()
			existing.CompletedAt = &now
		} else {
			existing.CompletedAt = nil
		}
	}

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

func (s *taskService) ListBacklog(ctx context.Context, userID string) (*model.BacklogResponse, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}

	tasks, err := s.taskRepo.ListBacklog(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch backlog tasks: %w", err)
	}
	if tasks == nil {
		tasks = []*model.Task{}
	}

	return &model.BacklogResponse{Tasks: tasks}, nil
}

func (s *taskService) ReorderBacklog(ctx context.Context, userID string, orderedIDs []string) error {
	if userID == "" {
		return model.ErrUnauthorized
	}
	return s.taskRepo.ReorderBacklog(ctx, userID, orderedIDs)
}
