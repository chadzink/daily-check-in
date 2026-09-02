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

func setupRitualTest(t *testing.T) (service.RitualService, service.TaskService, service.DaySessionService, repository.DaySessionRepository, repository.DayTaskRepository, repository.TaskRepository) {
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

	taskSvc := service.NewTaskService(taskRepo, daySessionRepo, dayTaskRepo)
	daySessionSvc := service.NewDaySessionService(daySessionRepo, dayTaskRepo, taskRepo)
	ritualSvc := service.NewRitualService(daySessionRepo, dayTaskRepo, taskRepo, daySessionSvc)

	return ritualSvc, taskSvc, daySessionSvc, daySessionRepo, dayTaskRepo, taskRepo
}

func TestRitualService_MultiDayLookback(t *testing.T) {
	ritualSvc, taskSvc, _, daySessionRepo, dayTaskRepo, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-user-" + uuid.New().String()

	friday := "2026-08-28"
	monday := "2026-08-31"

	// 1. Create Friday session with CheckInAt stamped
	fridaySession, err := daySessionRepo.GetOrCreateByDate(ctx, userID, friday)
	require.NoError(t, err)
	now := time.Now().UTC()
	fridaySession.CheckInAt = &now
	require.NoError(t, daySessionRepo.Update(ctx, fridaySession))

	// 2. Add 2 completed tasks and 2 incomplete tasks to Friday
	t1, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Friday Complete 1"})
	require.NoError(t, err)
	t2, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Friday Complete 2"})
	require.NoError(t, err)
	t3, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Friday Incomplete 1"})
	require.NoError(t, err)
	t4, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Friday Incomplete 2"})
	require.NoError(t, err)

	dt1 := &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  friday,
		TaskID:        t1.ID,
		Status:        model.StatusToday,
		IsCompleted:   true,
		CompletedAt:   &now,
		PriorityOrder: 1,
	}
	dt2 := &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  friday,
		TaskID:        t2.ID,
		Status:        model.StatusToday,
		IsCompleted:   true,
		CompletedAt:   &now,
		PriorityOrder: 2,
	}
	dt3 := &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  friday,
		TaskID:        t3.ID,
		Status:        model.StatusToday,
		IsCompleted:   false,
		PriorityOrder: 3,
	}
	dt4 := &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  friday,
		TaskID:        t4.ID,
		Status:        model.StatusToday,
		IsCompleted:   false,
		PriorityOrder: 4,
	}

	require.NoError(t, dayTaskRepo.Create(ctx, userID, friday, dt1))
	require.NoError(t, dayTaskRepo.Create(ctx, userID, friday, dt2))
	require.NoError(t, dayTaskRepo.Create(ctx, userID, friday, dt3))
	require.NoError(t, dayTaskRepo.Create(ctx, userID, friday, dt4))

	// 3. Query Monday check-in context
	contextResp, err := ritualSvc.GetMorningCheckInContext(ctx, userID, monday)
	require.NoError(t, err)

	assert.Equal(t, monday, contextResp.TargetDate)
	assert.Equal(t, friday, contextResp.PreviousDate, "Should skip weekend and identify Friday as previous date")
	assert.Len(t, contextResp.YesterdayTasks, 2, "Should identify 2 completed tasks from Friday")
	assert.Len(t, contextResp.RolloverCandidates, 2, "Should identify 2 incomplete tasks from Friday")
	assert.False(t, contextResp.IsAlreadyCheckedIn)
}

func TestRitualService_ExecuteMorningCheckIn_AndConflict(t *testing.T) {
	ritualSvc, taskSvc, _, _, _, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-user-" + uuid.New().String()
	date := "2026-09-01"

	t1, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Task 1"})
	require.NoError(t, err)
	t2, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Task 2"})
	require.NoError(t, err)

	// Execute check-in
	req := model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{t1.ID, t2.ID},
		Notes:        "Starting Tuesday focused",
	}

	sessionWithTasks, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, date, req)
	require.NoError(t, err)
	require.NotNil(t, sessionWithTasks)
	assert.NotNil(t, sessionWithTasks.Session.CheckInAt)
	assert.Equal(t, "Starting Tuesday focused", sessionWithTasks.Session.Notes)
	assert.Len(t, sessionWithTasks.Tasks.Today, 2)

	// Second check-in must trigger 409 Conflict
	_, conflictErr := ritualSvc.ExecuteMorningCheckIn(ctx, userID, date, req)
	require.Error(t, conflictErr)
	assert.True(t, errors.Is(conflictErr, model.ErrConflict), "Duplicate check-in must yield ErrConflict")
}

func TestRitualService_ExecuteCheckOut(t *testing.T) {
	ritualSvc, taskSvc, _, _, _, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-user-" + uuid.New().String()
	date := "2026-09-01"

	// 1. Check out on un-checked-in session should return invalid input error
	_, err := ritualSvc.ExecuteCheckOut(ctx, userID, date, model.ExecuteCheckOutRequest{})
	require.Error(t, err)
	assert.True(t, errors.Is(err, model.ErrInvalidInput))

	// 2. Check in first with 2 tasks
	t1, _ := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Today Task A"})
	t2, _ := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Today Task B"})

	_, err = ritualSvc.ExecuteMorningCheckIn(ctx, userID, date, model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{t1.ID, t2.ID},
	})
	require.NoError(t, err)

	// 3. Check out: mark t1 complete, demote t2 to backlog
	checkoutResp, err := ritualSvc.ExecuteCheckOut(ctx, userID, date, model.ExecuteCheckOutRequest{
		CompleteTaskIDs: []string{t1.ID},
		DemoteTaskIDs:   []string{t2.ID},
		Notes:           "Good progress today",
	})
	require.NoError(t, err)
	assert.NotNil(t, checkoutResp.Session.CheckOutAt)
	assert.Equal(t, "Good progress today", checkoutResp.Session.Notes)

	// In Today: t1 completed should remain, t2 should have been demoted
	assert.Len(t, checkoutResp.Tasks.Today, 1)
	assert.Equal(t, t1.ID, checkoutResp.Tasks.Today[0].TaskID)
	assert.True(t, checkoutResp.Tasks.Today[0].IsCompleted)
}
