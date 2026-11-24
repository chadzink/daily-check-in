package service

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
)

// ReportService provides date-range reporting over completed tasks
type ReportService interface {
	GetCompletedTasksReport(ctx context.Context, userID, startDate, endDate string) (*model.CompletedTasksReportResponse, error)
}

type reportService struct {
	daySessionRepo repository.DaySessionRepository
	dayTaskRepo    repository.DayTaskRepository
	taskRepo       repository.TaskRepository
}

// NewReportService constructs a ReportService
func NewReportService(
	daySessionRepo repository.DaySessionRepository,
	dayTaskRepo repository.DayTaskRepository,
	taskRepo repository.TaskRepository,
) ReportService {
	return &reportService{
		daySessionRepo: daySessionRepo,
		dayTaskRepo:    dayTaskRepo,
		taskRepo:       taskRepo,
	}
}

func (s *reportService) GetCompletedTasksReport(ctx context.Context, userID, startDate, endDate string) (*model.CompletedTasksReportResponse, error) {
	if userID == "" {
		return nil, model.ErrUnauthorized
	}

	now := time.Now().UTC()
	if endDate == "" {
		endDate = now.Format("2006-01-02")
	}
	if startDate == "" {
		startDate = now.AddDate(0, 0, -6).Format("2006-01-02")
	}

	startParsed, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid start date, expected YYYY-MM-DD", model.ErrInvalidInput)
	}
	endParsed, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return nil, fmt.Errorf("%w: invalid end date, expected YYYY-MM-DD", model.ErrInvalidInput)
	}
	if startParsed.After(endParsed) {
		return nil, fmt.Errorf("%w: start date cannot be after end date", model.ErrInvalidInput)
	}

	sessions, err := s.daySessionRepo.ListByDateRange(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to list sessions for report: %w", err)
	}

	type dateTaskPair struct {
		date    string
		dayTask *model.DayTask
	}

	var mu sync.Mutex
	var completedPairs []dateTaskPair
	var wg sync.WaitGroup
	errCh := make(chan error, len(sessions))

	for _, sess := range sessions {
		wg.Add(1)
		go func(date string) {
			defer wg.Done()
			dayTasks, listErr := s.dayTaskRepo.ListByDate(ctx, userID, date)
			if listErr != nil {
				errCh <- listErr
				return
			}
			var local []dateTaskPair
			for _, dt := range dayTasks {
				if dt.IsCompleted {
					local = append(local, dateTaskPair{date: date, dayTask: dt})
				}
			}
			if len(local) > 0 {
				mu.Lock()
				completedPairs = append(completedPairs, local...)
				mu.Unlock()
			}
		}(sess.Date)
	}

	wg.Wait()
	close(errCh)
	if firstErr, ok := <-errCh; ok && firstErr != nil {
		return nil, fmt.Errorf("failed to fetch day tasks for report: %w", firstErr)
	}

	taskIDs := make([]string, 0, len(completedPairs))
	for _, p := range completedPairs {
		if p.dayTask.TaskID != "" {
			taskIDs = append(taskIDs, p.dayTask.TaskID)
		}
	}

	tasksMap, err := s.taskRepo.GetByIDs(ctx, userID, taskIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to batch fetch master tasks for report: %w", err)
	}

	items := make([]model.CompletedTaskReportItem, 0, len(completedPairs))
	for _, p := range completedPairs {
		dt := p.dayTask
		item := model.CompletedTaskReportItem{
			DayTaskID:     dt.ID,
			TaskID:        dt.TaskID,
			Date:          p.date,
			Status:        dt.Status,
			IsCompleted:   dt.IsCompleted,
			CompletedAt:   dt.CompletedAt,
			PriorityOrder: dt.PriorityOrder,
			BlockerReason: dt.BlockerReason,
		}
		if masterTask, ok := tasksMap[dt.TaskID]; ok && masterTask != nil {
			item.Title = masterTask.Title
			item.Description = masterTask.Description
			created := masterTask.CreatedAt
			updated := masterTask.UpdatedAt
			item.CreatedAt = &created
			item.UpdatedAt = &updated
		}
		items = append(items, item)
	}

	sort.Slice(items, func(i, j int) bool {
		if items[i].Date != items[j].Date {
			return items[i].Date > items[j].Date
		}
		if items[i].CompletedAt != nil && items[j].CompletedAt != nil {
			return items[i].CompletedAt.After(*items[j].CompletedAt)
		}
		return items[i].PriorityOrder < items[j].PriorityOrder
	})

	return &model.CompletedTasksReportResponse{
		StartDate:  startDate,
		EndDate:    endDate,
		TotalCount: len(items),
		Tasks:      items,
	}, nil
}
