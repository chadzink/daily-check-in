package service_test

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupCalendarTest(t *testing.T) (service.CalendarService, repository.DaySessionRepository, repository.DayTaskRepository, repository.TaskRepository) {
	emulatorHost := os.Getenv("FIRESTORE_EMULATOR_HOST")
	if emulatorHost == "" {
		_ = os.Setenv("FIRESTORE_EMULATOR_HOST", "localhost:8085")
	}

	ctx := context.Background()
	client, err := repository.NewFirestoreClient(ctx, "dailycheckin-test")
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = client.Close()
	})

	taskRepo := repository.NewTaskRepository(client)
	daySessionRepo := repository.NewDaySessionRepository(client)
	dayTaskRepo := repository.NewDayTaskRepository(client)
	calendarSvc := service.NewCalendarService(daySessionRepo, dayTaskRepo)

	return calendarSvc, daySessionRepo, dayTaskRepo, taskRepo
}

func TestCalendarService_GetMonthSummary_Success(t *testing.T) {
	calendarSvc, daySessionRepo, dayTaskRepo, taskRepo := setupCalendarTest(t)
	ctx := context.Background()
	userID := "calendar-user-" + uuid.New().String()

	month := "2026-09"
	date1 := "2026-09-01"
	date2 := "2026-09-02"

	// 1. Setup Session 1: CheckIn + CheckOut, 2 completed, 1 incomplete
	sess1, err := daySessionRepo.GetOrCreateByDate(ctx, userID, date1)
	require.NoError(t, err)
	now := time.Now().UTC()
	sess1.CheckInAt = &now
	sess1.CheckOutAt = &now
	require.NoError(t, daySessionRepo.Update(ctx, sess1))

	t1 := &model.Task{ID: uuid.New().String(), UserID: userID, Title: "Task 1", CreatedAt: now, UpdatedAt: now}
	require.NoError(t, taskRepo.Create(ctx, t1))
	t2 := &model.Task{ID: uuid.New().String(), UserID: userID, Title: "Task 2", CreatedAt: now, UpdatedAt: now}
	require.NoError(t, taskRepo.Create(ctx, t2))
	t3 := &model.Task{ID: uuid.New().String(), UserID: userID, Title: "Task 3", CreatedAt: now, UpdatedAt: now}
	require.NoError(t, taskRepo.Create(ctx, t3))

	dt1 := &model.DayTask{ID: uuid.New().String(), DaySessionID: date1, TaskID: t1.ID, Status: model.StatusToday, IsCompleted: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, dayTaskRepo.Create(ctx, userID, date1, dt1))
	dt2 := &model.DayTask{ID: uuid.New().String(), DaySessionID: date1, TaskID: t2.ID, Status: model.StatusToday, IsCompleted: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, dayTaskRepo.Create(ctx, userID, date1, dt2))
	dt3 := &model.DayTask{ID: uuid.New().String(), DaySessionID: date1, TaskID: t3.ID, Status: model.StatusToday, IsCompleted: false, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, dayTaskRepo.Create(ctx, userID, date1, dt3))

	// 2. Setup Session 2: CheckIn only, 1 completed, 1 incomplete
	sess2, err := daySessionRepo.GetOrCreateByDate(ctx, userID, date2)
	require.NoError(t, err)
	sess2.CheckInAt = &now
	require.NoError(t, daySessionRepo.Update(ctx, sess2))

	t4 := &model.Task{ID: uuid.New().String(), UserID: userID, Title: "Task 4", CreatedAt: now, UpdatedAt: now}
	require.NoError(t, taskRepo.Create(ctx, t4))
	t5 := &model.Task{ID: uuid.New().String(), UserID: userID, Title: "Task 5", CreatedAt: now, UpdatedAt: now}
	require.NoError(t, taskRepo.Create(ctx, t5))

	dt4 := &model.DayTask{ID: uuid.New().String(), DaySessionID: date2, TaskID: t4.ID, Status: model.StatusToday, IsCompleted: true, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, dayTaskRepo.Create(ctx, userID, date2, dt4))
	dt5 := &model.DayTask{ID: uuid.New().String(), DaySessionID: date2, TaskID: t5.ID, Status: model.StatusToday, IsCompleted: false, CreatedAt: now, UpdatedAt: now}
	require.NoError(t, dayTaskRepo.Create(ctx, userID, date2, dt5))

	// 3. Call GetMonthSummary
	resp, err := calendarSvc.GetMonthSummary(ctx, userID, month)
	require.NoError(t, err)
	require.NotNil(t, resp)

	assert.Equal(t, "2026-09", resp.Month)
	assert.Equal(t, 30, len(resp.Days), "September should contain 30 days")

	// Verify Day 1
	day1 := resp.Days[0]
	assert.Equal(t, "2026-09-01", day1.Date)
	assert.True(t, day1.HasSession)
	assert.True(t, day1.HasCheckIn)
	assert.True(t, day1.HasCheckOut)
	assert.Equal(t, 2, day1.CompletedTaskCount)
	assert.Equal(t, 3, day1.TotalTaskCount)

	// Verify Day 2
	day2 := resp.Days[1]
	assert.Equal(t, "2026-09-02", day2.Date)
	assert.True(t, day2.HasSession)
	assert.True(t, day2.HasCheckIn)
	assert.False(t, day2.HasCheckOut)
	assert.Equal(t, 1, day2.CompletedTaskCount)
	assert.Equal(t, 2, day2.TotalTaskCount)

	// Verify Day 3 (No session)
	day3 := resp.Days[2]
	assert.Equal(t, "2026-09-03", day3.Date)
	assert.False(t, day3.HasSession)
	assert.False(t, day3.HasCheckIn)
	assert.False(t, day3.HasCheckOut)
	assert.Equal(t, 0, day3.CompletedTaskCount)
	assert.Equal(t, 0, day3.TotalTaskCount)
}

func TestCalendarService_GetMonthSummary_ValidationErrors(t *testing.T) {
	calendarSvc, _, _, _ := setupCalendarTest(t)
	ctx := context.Background()

	// Missing userID
	_, err := calendarSvc.GetMonthSummary(ctx, "", "2026-09")
	assert.Error(t, err)
	assert.True(t, errors.Is(err, model.ErrInvalidInput))

	// Invalid month formats
	invalidMonths := []string{"", "invalid", "2026-13", "2026-00", "2026-9", "26-09"}
	for _, m := range invalidMonths {
		_, err := calendarSvc.GetMonthSummary(ctx, "user-123", m)
		assert.Error(t, err, "expected error for month: %s", m)
		assert.True(t, errors.Is(err, model.ErrInvalidInput))
	}
}
