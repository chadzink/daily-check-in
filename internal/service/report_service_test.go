package service_test

import (
	"context"
	"os"
	"testing"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlan012_BacklogExcludesCompletedAndTopInsertion(t *testing.T) {
	taskSvc, daySessionSvc := setupServices(t)
	ctx := context.Background()
	userID := "plan012-user-" + uuid.New().String()
	date := "2026-11-24"

	// 1. Create two backlog tasks; second should appear at top (#1)
	first, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "First Backlog"})
	require.NoError(t, err)
	second, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Second Backlog"})
	require.NoError(t, err)

	backlog, err := taskSvc.ListBacklog(ctx, userID, date)
	require.NoError(t, err)
	require.Len(t, backlog.Tasks, 2)
	assert.Equal(t, second.ID, backlog.Tasks[0].ID)
	assert.Equal(t, first.ID, backlog.Tasks[1].ID)

	// 2. Create two Today tasks; second should appear at top (#1)
	statusToday := model.StatusToday
	today1, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{
		Title:      "Today One",
		TargetDate: date,
		Status:     &statusToday,
	})
	require.NoError(t, err)
	today2, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{
		Title:      "Today Two",
		TargetDate: date,
		Status:     &statusToday,
	})
	require.NoError(t, err)

	session, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, date)
	require.NoError(t, err)
	require.Len(t, session.Tasks.Today, 2)
	assert.Equal(t, today2.ID, session.Tasks.Today[0].TaskID)
	assert.Equal(t, today1.ID, session.Tasks.Today[1].TaskID)

	// 3. Complete today2 -> should remain on DaySession, but be excluded from ListBacklog
	completed := true
	_, err = daySessionSvc.UpdateDayTask(ctx, userID, date, session.Tasks.Today[0].DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)

	backlogAfterComplete, err := taskSvc.ListBacklog(ctx, userID, date)
	require.NoError(t, err)
	for _, bt := range backlogAfterComplete.Tasks {
		assert.NotEqual(t, today2.ID, bt.ID, "completed task should not appear in backlog")
	}

	sessionAfterComplete, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, date)
	require.NoError(t, err)
	require.Len(t, sessionAfterComplete.Tasks.Today, 2)
	assert.True(t, sessionAfterComplete.Tasks.Today[0].IsCompleted)
}

func TestPlan012_ReportServiceCompletedTasksDateRange(t *testing.T) {
	if os.Getenv("FIRESTORE_EMULATOR_HOST") == "" {
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
	reportSvc := service.NewReportService(daySessionRepo, dayTaskRepo, taskRepo)

	userID := "report-user-" + uuid.New().String()
	statusToday := model.StatusToday
	completed := true

	// Create completed task on 2026-11-20
	_, err = taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{
		Title:       "Shipped Feature A",
		Description: "Detailed notes A",
		TargetDate:  "2026-11-20",
		Status:      &statusToday,
	})
	require.NoError(t, err)
	s1, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, "2026-11-20")
	require.NoError(t, err)
	_, err = daySessionSvc.UpdateDayTask(ctx, userID, "2026-11-20", s1.Tasks.Today[0].DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)

	// Create incomplete task on 2026-11-22 (should NOT appear in completed report)
	_, err = taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{
		Title:      "Pending Task B",
		TargetDate: "2026-11-22",
		Status:     &statusToday,
	})
	require.NoError(t, err)

	// Create completed task on 2026-11-24
	_, err = taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{
		Title:      "Shipped Feature C",
		TargetDate: "2026-11-24",
		Status:     &statusToday,
	})
	require.NoError(t, err)
	s2, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, "2026-11-24")
	require.NoError(t, err)
	_, err = daySessionSvc.UpdateDayTask(ctx, userID, "2026-11-24", s2.Tasks.Today[0].DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)

	report, err := reportSvc.GetCompletedTasksReport(ctx, userID, "2026-11-20", "2026-11-24")
	require.NoError(t, err)
	require.Equal(t, 2, report.TotalCount)
	assert.Equal(t, "Shipped Feature C", report.Tasks[0].Title)
	assert.Equal(t, "2026-11-24", report.Tasks[0].Date)
	assert.Equal(t, "Shipped Feature A", report.Tasks[1].Title)
	assert.Equal(t, "Detailed notes A", report.Tasks[1].Description)

	// Invalid date range should return ErrInvalidInput
	_, err = reportSvc.GetCompletedTasksReport(ctx, userID, "2026-11-25", "2026-11-20")
	require.ErrorIs(t, err, model.ErrInvalidInput)
}
