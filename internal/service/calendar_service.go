package service

import (
	"context"
	"fmt"
	"regexp"
	"sync"
	"time"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
)

var monthRegex = regexp.MustCompile(`^20\d{2}-(0[1-9]|1[0-2])$`)

// CalendarService provides operations for calendar summary and temporal aggregation
type CalendarService interface {
	GetMonthSummary(ctx context.Context, userID, month string) (*model.CalendarSummaryResponse, error)
}

type calendarService struct {
	daySessionRepo repository.DaySessionRepository
	dayTaskRepo    repository.DayTaskRepository
}

// NewCalendarService constructs a CalendarService
func NewCalendarService(daySessionRepo repository.DaySessionRepository, dayTaskRepo repository.DayTaskRepository) CalendarService {
	return &calendarService{
		daySessionRepo: daySessionRepo,
		dayTaskRepo:    dayTaskRepo,
	}
}

func (s *calendarService) GetMonthSummary(ctx context.Context, userID, month string) (*model.CalendarSummaryResponse, error) {
	if userID == "" {
		return nil, fmt.Errorf("%w: user_id is required", model.ErrInvalidInput)
	}
	if !monthRegex.MatchString(month) {
		return nil, fmt.Errorf("%w: invalid month format, expected YYYY-MM", model.ErrInvalidInput)
	}

	// Parse month start date
	startTime, err := time.Parse("2006-01-02", month+"-01")
	if err != nil {
		return nil, fmt.Errorf("%w: invalid month date", model.ErrInvalidInput)
	}

	// Calculate last day of month
	endTime := startTime.AddDate(0, 1, -1)
	startDate := startTime.Format("2006-01-02")
	endDate := endTime.Format("2006-01-02")

	// Query recorded day sessions in date range
	sessions, err := s.daySessionRepo.ListByDateRange(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("failed to list sessions for calendar summary: %w", err)
	}

	// Map sessions by date
	sessionMap := make(map[string]*model.DaySession, len(sessions))
	for _, sess := range sessions {
		sessionMap[sess.Date] = sess
	}

	// Fetch day task counts for active sessions concurrently
	type taskCounts struct {
		completed int
		total     int
	}
	countsMap := make(map[string]taskCounts)
	var mu sync.Mutex

	var wg sync.WaitGroup
	errCh := make(chan error, len(sessions))

	for _, sess := range sessions {
		wg.Add(1)
		go func(date string) {
			defer wg.Done()
			dayTasks, err := s.dayTaskRepo.ListByDate(ctx, userID, date)
			if err != nil {
				errCh <- err
				return
			}
			completed := 0
			for _, dt := range dayTasks {
				if dt.IsCompleted {
					completed++
				}
			}
			mu.Lock()
			countsMap[date] = taskCounts{
				completed: completed,
				total:     len(dayTasks),
			}
			mu.Unlock()
		}(sess.Date)
	}

	wg.Wait()
	close(errCh)

	if err, ok := <-errCh; ok && err != nil {
		return nil, fmt.Errorf("failed to load day tasks for calendar summary: %w", err)
	}

	// Generate day summaries for each day of the month (1..daysInMonth)
	daysInMonth := endTime.Day()
	days := make([]model.DaySummary, 0, daysInMonth)

	for day := 1; day <= daysInMonth; day++ {
		dateStr := fmt.Sprintf("%s-%02d", month, day)
		sess, hasSession := sessionMap[dateStr]
		summary := model.DaySummary{
			Date:               dateStr,
			HasSession:         hasSession,
			HasCheckIn:         hasSession && sess.CheckInAt != nil,
			HasCheckOut:        hasSession && sess.CheckOutAt != nil,
			CompletedTaskCount: 0,
			TotalTaskCount:     0,
		}

		if hasSession {
			if counts, found := countsMap[dateStr]; found {
				summary.CompletedTaskCount = counts.completed
				summary.TotalTaskCount = counts.total
			}
		}

		days = append(days, summary)
	}

	return &model.CalendarSummaryResponse{
		Month: month,
		Days:  days,
	}, nil
}
