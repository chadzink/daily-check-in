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

func TestDaySessionService_PullDemotePatchReorder(t *testing.T) {
	taskSvc, daySessionSvc := setupServices(t)
	ctx := context.Background()
	userID := "svc-user-" + uuid.New().String()
	date := "2026-09-02"

	// Create 2 master tasks in backlog
	task1, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Task 1"})
	require.NoError(t, err)
	task2, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Task 2"})
	require.NoError(t, err)

	// 1. Pull Task 1 into Today
	pulled1, err := daySessionSvc.PullDayTask(ctx, userID, date, model.PullDayTaskRequest{
		TaskID:        task1.ID,
		Status:        model.StatusToday,
		PriorityOrder: 1,
	})
	require.NoError(t, err)
	assert.Equal(t, task1.ID, pulled1.TaskID)
	assert.Equal(t, model.StatusToday, pulled1.Status)

	// 2. Pull Task 2 into Today
	pulled2, err := daySessionSvc.PullDayTask(ctx, userID, date, model.PullDayTaskRequest{
		TaskID:        task2.ID,
		Status:        model.StatusToday,
		PriorityOrder: 2,
	})
	require.NoError(t, err)
	assert.Equal(t, 2, pulled2.PriorityOrder)

	// 3. Patch Task 1: Complete it (Gherkin Scenario 1: synchronizes with master task)
	completed := true
	patched, err := daySessionSvc.PatchDayTask(ctx, userID, pulled1.ID, model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)
	assert.True(t, patched.IsCompleted)
	assert.NotNil(t, patched.CompletedAt)

	// Check master task was synchronized!
	master1, err := taskSvc.GetTaskByID(ctx, userID, task1.ID)
	require.NoError(t, err)
	assert.True(t, master1.IsCompleted)
	assert.NotNil(t, master1.CompletedAt)

	// 4. Reorder Day Tasks (Task 2 before Task 1)
	statusToday := model.StatusToday
	err = daySessionSvc.ReorderDayTasksDirect(ctx, userID, model.ReorderDayTasksRequest{
		DaySessionDate:    date,
		Status:            &statusToday,
		OrderedDayTaskIDs: []string{pulled2.ID, pulled1.ID},
	})
	require.NoError(t, err)

	// Verify order in joined query
	session, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, date)
	require.NoError(t, err)
	require.Len(t, session.Tasks.Today, 2)
	assert.Equal(t, pulled2.ID, session.Tasks.Today[0].DayTaskID)
	assert.Equal(t, pulled1.ID, session.Tasks.Today[1].DayTaskID)

	// 5. Demote Task 2 back to backlog
	err = daySessionSvc.DemoteDayTask(ctx, userID, date, pulled2.ID)
	require.NoError(t, err)

	sessionAfterDemote, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, date)
	require.NoError(t, err)
	assert.Len(t, sessionAfterDemote.Tasks.Today, 1)
	assert.Equal(t, pulled1.ID, sessionAfterDemote.Tasks.Today[0].DayTaskID)
}
