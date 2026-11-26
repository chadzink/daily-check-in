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

	// 3. Dynamically resolve Yesterday's completed tasks from the most recent prior day with completions
	yesterdayDate, resolvedYesterday, err := resolveYesterdayCompletedTasks(
		ctx, s.daySessionRepo, s.dayTaskRepo, s.taskRepo, userID, date,
	)
	if err == nil {
		yesterdayTasks = resolvedYesterday
	}

	// 4. Look backward up to 30 days to identify the most recent active session for rollover candidates
	previousDate := ""
	recentSessions, err := s.daySessionRepo.ListBeforeDate(ctx, userID, date, yesterdayLookbackLimit)
	if err == nil {
		for _, sess := range recentSessions {
			if sess.CheckInAt != nil {
				previousDate = sess.Date
				break
			}
		}
	}

	// 5. If a previous active date was located, extract incomplete rollover candidates (excluding StatusYesterday)
	if previousDate != "" {
		prevDayTasks, err := s.dayTaskRepo.ListByDate(ctx, userID, previousDate)
		if err == nil && len(prevDayTasks) > 0 {
			incompleteTasks := make([]*model.DayTask, 0)
			taskIDs := make([]string, 0, len(prevDayTasks))
			for _, dt := range prevDayTasks {
				if dt.Status == model.StatusYesterday || dt.IsCompleted {
					continue
				}
				incompleteTasks = append(incompleteTasks, dt)
				if dt.TaskID != "" {
					taskIDs = append(taskIDs, dt.TaskID)
				}
			}

			tasksMap, _ := s.taskRepo.GetByIDs(ctx, userID, taskIDs)
			if tasksMap == nil {
				tasksMap = make(map[string]*model.Task)
			}

			for _, dt := range incompleteTasks {
				masterTask, ok := tasksMap[dt.TaskID]
				if !ok || masterTask == nil || masterTask.IsArchived {
					continue
				}

				var blockerPtr *string
				if dt.BlockerReason != "" {
					reason := dt.BlockerReason
					blockerPtr = &reason
				}

				item := model.DayTaskWithDetails{
					DayTaskID:     dt.ID,
					TaskID:        dt.TaskID,
					Title:         masterTask.Title,
					Description:   masterTask.Description,
					Status:        dt.Status,
					IsCompleted:   dt.IsCompleted,
					CompletedAt:   dt.CompletedAt,
					PriorityOrder: dt.PriorityOrder,
					BlockerReason: blockerPtr,
					Subtasks:      normalizeSubtasks(masterTask.Subtasks),
				}
				rolloverCandidates = append(rolloverCandidates, item)
			}
		}
	}

	// 6. Fetch unassigned active tasks from Global Backlog, excluding rollover candidates
	// and tasks already committed (unfinished, non-YESTERDAY) on target date or any future date.
	rolloverTaskIDs := make(map[string]bool, len(rolloverCandidates))
	for _, rc := range rolloverCandidates {
		if rc.TaskID != "" {
			rolloverTaskIDs[rc.TaskID] = true
		}
	}
	committedIDs, _ := collectCommittedTaskIDsFromDate(ctx, s.daySessionRepo, s.dayTaskRepo, userID, date)

	allBacklog, err := s.taskRepo.ListBacklog(ctx, userID)
	if err == nil {
		for _, t := range allBacklog {
			if !t.IsCompleted && !t.IsArchived && !rolloverTaskIDs[t.ID] && !committedIDs[t.ID] {
				t.Subtasks = normalizeSubtasks(t.Subtasks)
				backlogTasks = append(backlogTasks, t)
			}
		}
	}

	return &model.CheckInContextResponse{
		TargetDate:         date,
		PreviousDate:       previousDate,
		YesterdayDate:      yesterdayDate,
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

	// 3. Locate previous active workday for RolloverCompleted updates (Yesterday row is resolved dynamically)
	recentSessions, _ := s.daySessionRepo.ListBeforeDate(ctx, userID, date, yesterdayLookbackLimit)
	var prevDate string
	for _, sess := range recentSessions {
		if sess.CheckInAt != nil {
			prevDate = sess.Date
			break
		}
	}

	var prevDayTasks []*model.DayTask
	if prevDate != "" {
		prevDayTasks, _ = s.dayTaskRepo.ListByDate(ctx, userID, prevDate)
	}

	// Build lookup maps of prior day tasks by TaskID and ID to preserve BlockerReason
	prevByTaskID := make(map[string]*model.DayTask, len(prevDayTasks))
	prevByID := make(map[string]*model.DayTask, len(prevDayTasks))
	for _, dt := range prevDayTasks {
		if dt == nil || dt.Status == model.StatusYesterday {
			continue
		}
		if dt.TaskID != "" {
			prevByTaskID[dt.TaskID] = dt
		}
		if dt.ID != "" {
			prevByID[dt.ID] = dt
		}
	}

	// Map of tasks already committed to today to prevent duplicate records (ignoring legacy StatusYesterday)
	existingTodayTasks, _ := s.dayTaskRepo.ListByDate(ctx, userID, date)
	existingTaskIDs := make(map[string]bool)
	existingTodayByTaskID := make(map[string]*model.DayTask)
	blockedOrder := 0
	for _, dt := range existingTodayTasks {
		if dt.Status == model.StatusYesterday {
			continue
		}
		existingTaskIDs[dt.TaskID] = true
		existingTodayByTaskID[dt.TaskID] = dt
		if dt.Status == model.StatusBlocked {
			blockedOrder++
		}
	}

	// 4. Process Rollover Decisions
	for _, decision := range req.RolloverDecisions {
		switch decision.Action {
		case model.RolloverCompleted:
			// Marked complete late: update master task (with one-way subtask cascade) and mark the prior day's DayTask completed
			// (dynamic Yesterday resolution will surface it without persisting a StatusYesterday copy)
			if masterTask, err := s.taskRepo.GetByID(ctx, userID, decision.TaskID); err == nil && masterTask != nil {
				masterTask.IsCompleted = true
				masterTask.CompletedAt = &now
				completeAllSubtasks(masterTask)
				_ = s.taskRepo.Update(ctx, masterTask)
			}
			if prevDate != "" {
				for _, dt := range prevDayTasks {
					if dt.Status == model.StatusYesterday {
						continue
					}
					if (decision.DayTaskID != "" && dt.ID == decision.DayTaskID) ||
						(decision.TaskID != "" && dt.TaskID == decision.TaskID) {
						dt.IsCompleted = true
						dt.CompletedAt = &now
						_ = s.dayTaskRepo.Update(ctx, userID, prevDate, dt)
						break
					}
				}
			}
		case model.RolloverKeepBlocked:
			if decision.TaskID == "" {
				continue
			}
			blockerReason := decision.BlockerReason
			if blockerReason == "" {
				if prevDT, ok := prevByID[decision.DayTaskID]; ok && prevDT != nil && prevDT.BlockerReason != "" {
					blockerReason = prevDT.BlockerReason
				} else if prevDT, ok := prevByTaskID[decision.TaskID]; ok && prevDT != nil {
					blockerReason = prevDT.BlockerReason
				}
			}
			if existingDT, exists := existingTodayByTaskID[decision.TaskID]; exists && existingDT != nil {
				existingDT.Status = model.StatusBlocked
				existingDT.BlockerReason = blockerReason
				_ = s.dayTaskRepo.Update(ctx, userID, date, existingDT)
			} else {
				blockedOrder++
				dayTask := &model.DayTask{
					ID:            uuid.New().String(),
					DaySessionID:  date,
					TaskID:        decision.TaskID,
					Status:        model.StatusBlocked,
					IsCompleted:   false,
					PriorityOrder: blockedOrder,
					BlockerReason: blockerReason,
					CreatedAt:     now,
					UpdatedAt:     now,
				}
				_ = s.dayTaskRepo.Create(ctx, userID, date, dayTask)
				existingTaskIDs[decision.TaskID] = true
				existingTodayByTaskID[decision.TaskID] = dayTask
			}
		case model.RolloverDemote:
			// Demoted: do not schedule for today (master task remains uncommitted in backlog)
		case model.RolloverToToday:
			// Added to today commitments if in TodayTaskIDs below (with BlockerReason cleared)
		}
	}

	// 5. Commit Today's tasks in specified 1..N priority order
	for i, taskID := range req.TodayTaskIDs {
		if taskID == "" {
			continue
		}
		if existingDT, exists := existingTodayByTaskID[taskID]; exists && existingDT != nil {
			// Ensure Status is TODAY, clear any BlockerReason (unblocked), and apply priority order
			existingDT.Status = model.StatusToday
			existingDT.BlockerReason = ""
			existingDT.PriorityOrder = i + 1
			_ = s.dayTaskRepo.Update(ctx, userID, date, existingDT)
		} else {
			dayTask := &model.DayTask{
				ID:            uuid.New().String(),
				DaySessionID:  date,
				TaskID:        taskID,
				Status:        model.StatusToday,
				IsCompleted:   false,
				PriorityOrder: i + 1,
				BlockerReason: "",
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			_ = s.dayTaskRepo.Create(ctx, userID, date, dayTask)
			existingTaskIDs[taskID] = true
			existingTodayByTaskID[taskID] = dayTask
		}
	}

	// 6. Commit Blocked tasks (preserving prior day BlockerReason if present)
	for _, taskID := range req.BlockedTaskIDs {
		if taskID == "" {
			continue
		}
		if !existingTaskIDs[taskID] {
			blockerReason := ""
			if prevDT, ok := prevByTaskID[taskID]; ok && prevDT != nil {
				blockerReason = prevDT.BlockerReason
			}
			blockedOrder++
			dayTask := &model.DayTask{
				ID:            uuid.New().String(),
				DaySessionID:  date,
				TaskID:        taskID,
				Status:        model.StatusBlocked,
				IsCompleted:   false,
				PriorityOrder: blockedOrder,
				BlockerReason: blockerReason,
				CreatedAt:     now,
				UpdatedAt:     now,
			}
			_ = s.dayTaskRepo.Create(ctx, userID, date, dayTask)
			existingTaskIDs[taskID] = true
			existingTodayByTaskID[taskID] = dayTask
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

				// Synchronize master task (with one-way subtask completion cascade)
				if masterTask, err := s.taskRepo.GetByID(ctx, userID, dt.TaskID); err == nil && masterTask != nil {
					masterTask.IsCompleted = true
					masterTask.CompletedAt = &now
					completeAllSubtasks(masterTask)
					_ = s.taskRepo.Update(ctx, masterTask)
				}
				break
			}
		}
	}

	return s.daySessionService.GetDaySessionWithTasks(ctx, userID, date)
}
