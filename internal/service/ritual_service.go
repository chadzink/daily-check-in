package service

import (
	"context"
	"fmt"
	"time"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
	"github.com/google/uuid"
)

// RitualService provides business logic for morning check-in and evening check-out rituals
type RitualService interface {
	GetMorningCheckInContext(ctx context.Context, userID, date string) (*model.CheckInContextResponse, error)
	ExecuteMorningCheckIn(ctx context.Context, userID, date string, req model.ExecuteCheckInRequest) (*model.DaySessionWithTasks, error)
	ExecuteCheckOut(ctx context.Context, userID, date string, req model.ExecuteCheckOutRequest) (*model.DaySessionWithTasks, error)
}

type ritualService struct {
	daySessionRepo    repository.DaySessionRepository
	dayTaskRepo       repository.DayTaskRepository
	taskRepo          repository.TaskRepository
	daySessionService DaySessionService
}

// NewRitualService constructs a RitualService
func NewRitualService(
	daySessionRepo repository.DaySessionRepository,
	dayTaskRepo repository.DayTaskRepository,
	taskRepo repository.TaskRepository,
	daySessionService DaySessionService,
) RitualService {
	return &ritualService{
		daySessionRepo:    daySessionRepo,
		dayTaskRepo:       dayTaskRepo,
		taskRepo:          taskRepo,
		daySessionService: daySessionService,
	}
}

// GetMorningCheckInContext collects previous active workday accomplishments, rollover candidates, and backlog tasks.
func (s *ritualService) GetMorningCheckInContext(ctx context.Context, userID, date string) (*model.CheckInContextResponse, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if date == "" {
		return nil, fmt.Errorf("%w: date is required", model.ErrInvalidInput)
	}

	// 1. Check if the target date session is already checked in
	isAlreadyCheckedIn := false
	currentSession, err := s.daySessionRepo.GetByDate(ctx, userID, date)
	if err == nil && currentSession != nil && currentSession.CheckInAt != nil {
		isAlreadyCheckedIn = true
	}

	// 2. Initialize empty slices to ensure [] JSON serialization
	yesterdayTasks := make([]model.DayTaskWithDetails, 0)
	rolloverCandidates := make([]model.DayTaskWithDetails, 0)
	backlogTasks := make([]*model.Task, 0)

	// 3. Look backward up to 30 days to identify the most recent active session
	previousDate := ""
	recentSessions, err := s.daySessionRepo.ListBeforeDate(ctx, userID, date, 30)
	if err == nil {
		for _, sess := range recentSessions {
			if sess.CheckInAt != nil {
				previousDate = sess.Date
				break
			}
		}
	}

	// 4. If a previous active date was located, extract yesterday's completed and incomplete tasks
	if previousDate != "" {
		prevDayTasks, err := s.dayTaskRepo.ListByDate(ctx, userID, previousDate)
		if err == nil && len(prevDayTasks) > 0 {
			// Extract task IDs for batch retrieval
			taskIDs := make([]string, 0, len(prevDayTasks))
			for _, dt := range prevDayTasks {
				if dt.TaskID != "" {
					taskIDs = append(taskIDs, dt.TaskID)
				}
			}

			tasksMap, _ := s.taskRepo.GetByIDs(ctx, userID, taskIDs)
			if tasksMap == nil {
				tasksMap = make(map[string]*model.Task)
			}

			for _, dt := range prevDayTasks {
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

				item := model.DayTaskWithDetails{
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

				if dt.IsCompleted {
					yesterdayTasks = append(yesterdayTasks, item)
				} else {
					rolloverCandidates = append(rolloverCandidates, item)
				}
			}
		}
	}

	// 5. Fetch unassigned active tasks from Global Backlog
	allBacklog, err := s.taskRepo.ListBacklog(ctx, userID)
	if err == nil {
		for _, t := range allBacklog {
			if !t.IsCompleted && !t.IsArchived {
				backlogTasks = append(backlogTasks, t)
			}
		}
	}

	return &model.CheckInContextResponse{
		TargetDate:         date,
		PreviousDate:       previousDate,
		YesterdayTasks:     yesterdayTasks,
		RolloverCandidates: rolloverCandidates,
		BacklogTasks:       backlogTasks,
		IsAlreadyCheckedIn: isAlreadyCheckedIn,
	}, nil
}

// ExecuteMorningCheckIn executes check-in atomically, triages rollover items, and stamps check_in_at.
func (s *ritualService) ExecuteMorningCheckIn(ctx context.Context, userID, date string, req model.ExecuteCheckInRequest) (*model.DaySessionWithTasks, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if date == "" {
		return nil, fmt.Errorf("%w: date is required", model.ErrInvalidInput)
	}

	// 1. Conflict Guard: Return 409 Conflict if session is already checked in
	existingSession, err := s.daySessionRepo.GetByDate(ctx, userID, date)
	if err == nil && existingSession != nil && existingSession.CheckInAt != nil {
		return nil, fmt.Errorf("%w: session already checked in", model.ErrConflict)
	}

	// 2. Fetch or create session
	session, err := s.daySessionRepo.GetOrCreateByDate(ctx, userID, date)
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve day session: %w", err)
	}

	now := time.Now().UTC()
	session.CheckInAt = &now
	if req.Notes != "" {
		session.Notes = req.Notes
	}

	if err := s.daySessionRepo.Update(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to stamp check-in on session: %w", err)
	}

	// 3. Process previous active workday's completed tasks into Yesterday row
	// Find previous date to copy completed accomplishments
	recentSessions, _ := s.daySessionRepo.ListBeforeDate(ctx, userID, date, 30)
	var prevDate string
	for _, sess := range recentSessions {
		if sess.CheckInAt != nil {
			prevDate = sess.Date
			break
		}
	}

	// Map of tasks already committed to today to prevent duplicate records
	existingTodayTasks, _ := s.dayTaskRepo.ListByDate(ctx, userID, date)
	existingTaskIDs := make(map[string]bool)
	for _, dt := range existingTodayTasks {
		existingTaskIDs[dt.TaskID] = true
	}

	if prevDate != "" {
		prevDayTasks, _ := s.dayTaskRepo.ListByDate(ctx, userID, prevDate)
		for _, dt := range prevDayTasks {
			if dt.IsCompleted && !existingTaskIDs[dt.TaskID] {
				yesterdayDT := &model.DayTask{
					ID:            uuid.New().String(),
					DaySessionID:  date,
					TaskID:        dt.TaskID,
					Status:        model.StatusYesterday,
					IsCompleted:   true,
					CompletedAt:   dt.CompletedAt,
					PriorityOrder: dt.PriorityOrder,
					CreatedAt:     now,
					UpdatedAt:     now,
				}
				_ = s.dayTaskRepo.Create(ctx, userID, date, yesterdayDT)
				existingTaskIDs[dt.TaskID] = true
			}
		}
	}

	// 4. Process Rollover Decisions
	for _, decision := range req.RolloverDecisions {
		switch decision.Action {
		case model.RolloverCompleted:
			// Marked complete late: update master task and record in Yesterday row
			if masterTask, err := s.taskRepo.GetByID(ctx, userID, decision.TaskID); err == nil && masterTask != nil {
				masterTask.IsCompleted = true
				masterTask.CompletedAt = &now
				_ = s.taskRepo.Update(ctx, masterTask)
			}
			if !existingTaskIDs[decision.TaskID] {
				yesterdayDT := &model.DayTask{
					ID:            uuid.New().String(),
					DaySessionID:  date,
					TaskID:        decision.TaskID,
					Status:        model.StatusYesterday,
					IsCompleted:   true,
					CompletedAt:   &now,
					PriorityOrder: 0,
					CreatedAt:     now,
					UpdatedAt:     now,
				}
				_ = s.dayTaskRepo.Create(ctx, userID, date, yesterdayDT)
				existingTaskIDs[decision.TaskID] = true
			}
		case model.RolloverDemote:
			// Demoted: do not schedule for today (master task remains uncommitted in backlog)
		case model.RolloverToToday:
			// Added to today commitments if in TodayTaskIDs below
		}
	}

	// 5. Commit Today's tasks in specified 1..N priority order
	for i, taskID := range req.TodayTaskIDs {
		if taskID == "" {
			continue
		}
		if existingTaskIDs[taskID] {
			// Find existing and ensure Status is TODAY with priority order
			for _, dt := range existingTodayTasks {
				if dt.TaskID == taskID {
					dt.Status = model.StatusToday
					dt.PriorityOrder = i + 1
					_ = s.dayTaskRepo.Update(ctx, userID, date, dt)
					break
				}
			}
		} else {
			dayTask := &model.DayTask{
				ID:            uuid.New().String(),
				DaySessionID:  date,
				TaskID:        taskID,
				Status:        model.StatusToday,
				IsCompleted:   false,
				PriorityOrder: i + 1,
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			_ = s.dayTaskRepo.Create(ctx, userID, date, dayTask)
			existingTaskIDs[taskID] = true
		}
	}

	// 6. Commit Blocked tasks
	for i, taskID := range req.BlockedTaskIDs {
		if taskID == "" {
			continue
		}
		if !existingTaskIDs[taskID] {
			dayTask := &model.DayTask{
				ID:            uuid.New().String(),
				DaySessionID:  date,
				TaskID:        taskID,
				Status:        model.StatusBlocked,
				IsCompleted:   false,
				PriorityOrder: i + 1,
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			_ = s.dayTaskRepo.Create(ctx, userID, date, dayTask)
			existingTaskIDs[taskID] = true
		}
	}

	// 7. Pull additional backlog tasks if specified
	for _, taskID := range req.PullTaskIDs {
		if taskID != "" && !existingTaskIDs[taskID] {
			dayTask := &model.DayTask{
				ID:            uuid.New().String(),
				DaySessionID:  date,
				TaskID:        taskID,
				Status:        model.StatusToday,
				IsCompleted:   false,
				PriorityOrder: len(req.TodayTaskIDs) + 1,
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			_ = s.dayTaskRepo.Create(ctx, userID, date, dayTask)
			existingTaskIDs[taskID] = true
		}
	}

	return s.daySessionService.GetDaySessionWithTasks(ctx, userID, date)
}

// ExecuteCheckOut stamps check_out_at, saves reflections, and handles end-of-day task dispositions.
func (s *ritualService) ExecuteCheckOut(ctx context.Context, userID, date string, req model.ExecuteCheckOutRequest) (*model.DaySessionWithTasks, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}
	if date == "" {
		return nil, fmt.Errorf("%w: date is required", model.ErrInvalidInput)
	}

	// 1. Verify session exists and is checked in
	session, err := s.daySessionRepo.GetByDate(ctx, userID, date)
	if err != nil || session == nil || session.CheckInAt == nil {
		return nil, fmt.Errorf("%w: cannot check out a session that has not been checked in", model.ErrInvalidInput)
	}

	now := time.Now().UTC()
	session.CheckOutAt = &now
	if req.Notes != "" {
		session.Notes = req.Notes
	}

	if err := s.daySessionRepo.Update(ctx, session); err != nil {
		return nil, fmt.Errorf("failed to stamp check-out on session: %w", err)
	}

	// 2. Fetch day tasks for session
	dayTasks, _ := s.dayTaskRepo.ListByDate(ctx, userID, date)

	// 3. Demote specified tasks (removes day commitment, task returns to unassigned backlog)
	for _, id := range req.DemoteTaskIDs {
		if id == "" {
			continue
		}
		for _, dt := range dayTasks {
			if dt.ID == id || dt.TaskID == id {
				_ = s.dayTaskRepo.Delete(ctx, userID, date, dt.ID)
				break
			}
		}
	}

	// 4. Mark specified tasks as completed
	for _, id := range req.CompleteTaskIDs {
		if id == "" {
			continue
		}
		for _, dt := range dayTasks {
			if dt.ID == id || dt.TaskID == id {
				dt.IsCompleted = true
				dt.CompletedAt = &now
				_ = s.dayTaskRepo.Update(ctx, userID, date, dt)

				// Synchronize master task
				if masterTask, err := s.taskRepo.GetByID(ctx, userID, dt.TaskID); err == nil && masterTask != nil {
					masterTask.IsCompleted = true
					masterTask.CompletedAt = &now
					_ = s.taskRepo.Update(ctx, masterTask)
				}
				break
			}
		}
	}

	return s.daySessionService.GetDaySessionWithTasks(ctx, userID, date)
}
