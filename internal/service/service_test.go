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

func setupServices(t *testing.T) (service.TaskService, service.DaySessionService) {
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

	return taskSvc, daySessionSvc
}

func TestTaskServiceLifecycle(t *testing.T) {
	taskSvc, _ := setupServices(t)
	ctx := context.Background()
	userID := "svc-user-" + uuid.New().String()

	// 1. Create Task
	task, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{
		Title:       "Document architecture boundaries",
		Description: "Explain Echo handler vs service isolation",
	})
	require.NoError(t, err)
	assert.NotEmpty(t, task.ID)
	assert.Equal(t, 1, task.BacklogOrder)

	// 2. Get Task By ID
	fetched, err := taskSvc.GetTaskByID(ctx, userID, task.ID)
	require.NoError(t, err)
	assert.Equal(t, task.Title, fetched.Title)

	// 3. Update Task
	completed := true
	updated, err := taskSvc.UpdateTask(ctx, userID, task.ID, model.UpdateTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)
	assert.True(t, updated.IsCompleted)
	assert.NotNil(t, updated.CompletedAt)

	// 4. Archive Task
	err = taskSvc.ArchiveTask(ctx, userID, task.ID)
	require.NoError(t, err)

	backlog, err := taskSvc.ListBacklog(ctx, userID)
	require.NoError(t, err)
	assert.Empty(t, backlog.Tasks)
}

func TestDaySessionServiceLifecycle(t *testing.T) {
	taskSvc, daySessionSvc := setupServices(t)
	ctx := context.Background()
	userID := "svc-user-" + uuid.New().String()
	date := "2026-09-01"

	// Create master task
	masterTask, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{
		Title: "Ship sprint review demo",
	})
	require.NoError(t, err)

	// Create day task
	dayTask, err := daySessionSvc.CreateDayTask(ctx, userID, date, model.CreateDayTaskRequest{
		TaskID:        masterTask.ID,
		Status:        model.StatusToday,
		PriorityOrder: 1,
	})
	require.NoError(t, err)
	assert.NotEmpty(t, dayTask.DayTaskID)
	assert.Equal(t, masterTask.Title, dayTask.Title)

	// Update day task
	statusBlocked := model.StatusBlocked
	reason := "Waiting for review sign-off"
	updatedDT, err := daySessionSvc.UpdateDayTask(ctx, userID, date, dayTask.DayTaskID, model.UpdateDayTaskRequest{
		Status:        &statusBlocked,
		BlockerReason: &reason,
	})
	require.NoError(t, err)
	assert.Equal(t, model.StatusBlocked, updatedDT.Status)
	assert.Equal(t, &reason, updatedDT.BlockerReason)

	// Retrieve DaySessionWithTasks
	joined, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, date)
	require.NoError(t, err)
	assert.Len(t, joined.Tasks.Blocked, 1)
	assert.Equal(t, masterTask.Title, joined.Tasks.Blocked[0].Title)

	// Delete day task
	err = daySessionSvc.DeleteDayTask(ctx, userID, date, dayTask.DayTaskID)
	require.NoError(t, err)

	afterDelete, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, date)
	require.NoError(t, err)
	assert.Empty(t, afterDelete.Tasks.Blocked)
}
