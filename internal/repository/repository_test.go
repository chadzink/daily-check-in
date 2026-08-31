package repository_test

import (
	"context"
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

func setupFirestoreClient(t *testing.T) repository.TaskRepository {
	emulatorHost := os.Getenv("FIRESTORE_EMULATOR_HOST")
	if emulatorHost == "" {
		_ = os.Setenv("FIRESTORE_EMULATOR_HOST", "localhost:8085")
	}

	ctx := context.Background()
	client, err := repository.NewFirestoreClient(ctx, "dailycheckin-test")
	require.NoError(t, err, "Failed to connect to Firestore emulator")
	t.Cleanup(func() {
		_ = client.Close()
	})

	return repository.NewTaskRepository(client)
}

func setupAllRepositories(t *testing.T) (repository.TaskRepository, repository.DaySessionRepository, repository.DayTaskRepository) {
	emulatorHost := os.Getenv("FIRESTORE_EMULATOR_HOST")
	if emulatorHost == "" {
		_ = os.Setenv("FIRESTORE_EMULATOR_HOST", "localhost:8085")
	}

	ctx := context.Background()
	client, err := repository.NewFirestoreClient(ctx, "dailycheckin-test")
	require.NoError(t, err, "Failed to connect to Firestore emulator")
	t.Cleanup(func() {
		_ = client.Close()
	})

	return repository.NewTaskRepository(client),
		repository.NewDaySessionRepository(client),
		repository.NewDayTaskRepository(client)
}

// Scenario 1: Master Task CRUD in Firestore Repository
func TestScenario1_MasterTaskCRUD(t *testing.T) {
	taskRepo := setupFirestoreClient(t)
	ctx := context.Background()
	userID := "test-user-" + uuid.New().String()

	// 1. Create a master task
	task := &model.Task{
		UserID:       userID,
		Title:        "Refactor auth client",
		Description:  "Ensure Firebase token verification is seamless",
		BacklogOrder: 1,
	}

	err := taskRepo.Create(ctx, task)
	require.NoError(t, err)
	assert.NotEmpty(t, task.ID, "Task ID should be generated")
	assert.False(t, task.CreatedAt.IsZero(), "CreatedAt should be initialized")
	assert.False(t, task.UpdatedAt.IsZero(), "UpdatedAt should be initialized")

	// 2. Fetch task by ID
	fetched, err := taskRepo.GetByID(ctx, userID, task.ID)
	require.NoError(t, err)
	assert.Equal(t, "Refactor auth client", fetched.Title)
	assert.Equal(t, 1, fetched.BacklogOrder)
	assert.False(t, fetched.IsArchived)

	// 3. Create second task for backlog ordering
	task2 := &model.Task{
		UserID:       userID,
		Title:        "Design execution board UI",
		Description:  "Tailwind styling for 4 execution rows",
		BacklogOrder: 2,
	}
	err = taskRepo.Create(ctx, task2)
	require.NoError(t, err)

	// 4. List backlog tasks (should return in order: task 1, task 2)
	backlog, err := taskRepo.ListBacklog(ctx, userID)
	require.NoError(t, err)
	require.Len(t, backlog, 2)
	assert.Equal(t, task.ID, backlog[0].ID)
	assert.Equal(t, task2.ID, backlog[1].ID)

	// 5. Update task
	now := time.Now().UTC()
	fetched.Title = "Refactor auth client & token refresh"
	fetched.IsCompleted = true
	fetched.CompletedAt = &now
	err = taskRepo.Update(ctx, fetched)
	require.NoError(t, err)

	updated, err := taskRepo.GetByID(ctx, userID, task.ID)
	require.NoError(t, err)
	assert.Equal(t, "Refactor auth client & token refresh", updated.Title)
	assert.True(t, updated.IsCompleted)
	assert.NotNil(t, updated.CompletedAt)

	// 6. Batch Get by IDs (avoids N+1 reads)
	batchMap, err := taskRepo.GetByIDs(ctx, userID, []string{task.ID, task2.ID})
	require.NoError(t, err)
	assert.Len(t, batchMap, 2)
	assert.Equal(t, task.ID, batchMap[task.ID].ID)
	assert.Equal(t, task2.ID, batchMap[task2.ID].ID)

	// 7. Reorder backlog
	err = taskRepo.ReorderBacklog(ctx, userID, []string{task2.ID, task.ID})
	require.NoError(t, err)

	reorderedBacklog, err := taskRepo.ListBacklog(ctx, userID)
	require.NoError(t, err)
	require.Len(t, reorderedBacklog, 2)
	assert.Equal(t, task2.ID, reorderedBacklog[0].ID)
	assert.Equal(t, 1, reorderedBacklog[0].BacklogOrder)
	assert.Equal(t, task.ID, reorderedBacklog[1].ID)
	assert.Equal(t, 2, reorderedBacklog[1].BacklogOrder)

	// 8. Soft-delete / archive task
	err = taskRepo.Archive(ctx, userID, task.ID)
	require.NoError(t, err)

	archivedTask, err := taskRepo.GetByID(ctx, userID, task.ID)
	require.NoError(t, err)
	assert.True(t, archivedTask.IsArchived)

	// Verify archived task is omitted from active backlog
	remainingBacklog, err := taskRepo.ListBacklog(ctx, userID)
	require.NoError(t, err)
	require.Len(t, remainingBacklog, 1)
	assert.Equal(t, task2.ID, remainingBacklog[0].ID)
}

// Scenario 2: Single-Call DaySession Joined Querying
func TestScenario2_SingleCallDaySessionJoinedQuerying(t *testing.T) {
	taskRepo, daySessionRepo, dayTaskRepo := setupAllRepositories(t)
	sessionService := service.NewDaySessionService(daySessionRepo, dayTaskRepo, taskRepo)
	ctx := context.Background()
	userID := "test-user-" + uuid.New().String()
	date := "2026-08-28"

	// 1. Create master tasks
	taskYesterday := &model.Task{
		UserID:       userID,
		Title:        "Yesterday Accomplishment",
		Description:  "Completed yesterday",
		BacklogOrder: 1,
		IsCompleted:  true,
	}
	require.NoError(t, taskRepo.Create(ctx, taskYesterday))

	taskToday1 := &model.Task{
		UserID:       userID,
		Title:        "Today High Priority",
		Description:  "P1 task for today",
		BacklogOrder: 2,
	}
	require.NoError(t, taskRepo.Create(ctx, taskToday1))

	taskToday2 := &model.Task{
		UserID:       userID,
		Title:        "Today Medium Priority",
		Description:  "P2 task for today",
		BacklogOrder: 3,
	}
	require.NoError(t, taskRepo.Create(ctx, taskToday2))

	taskBlocked := &model.Task{
		UserID:       userID,
		Title:        "Blocked External Dependency",
		Description:  "Waiting on API key",
		BacklogOrder: 4,
	}
	require.NoError(t, taskRepo.Create(ctx, taskBlocked))

	// 2. Commit DayTasks to DaySession (1 Yesterday, 2 Today, 1 Blocked)
	yesterdayCompletion := time.Now().UTC().Add(-24 * time.Hour)
	require.NoError(t, dayTaskRepo.Create(ctx, userID, date, &model.DayTask{
		TaskID:        taskYesterday.ID,
		Status:        model.StatusYesterday,
		IsCompleted:   true,
		CompletedAt:   &yesterdayCompletion,
		PriorityOrder: 1,
	}))

	require.NoError(t, dayTaskRepo.Create(ctx, userID, date, &model.DayTask{
		TaskID:        taskToday1.ID,
		Status:        model.StatusToday,
		IsCompleted:   false,
		PriorityOrder: 1,
	}))

	require.NoError(t, dayTaskRepo.Create(ctx, userID, date, &model.DayTask{
		TaskID:        taskToday2.ID,
		Status:        model.StatusToday,
		IsCompleted:   false,
		PriorityOrder: 2,
	}))

	require.NoError(t, dayTaskRepo.Create(ctx, userID, date, &model.DayTask{
		TaskID:        taskBlocked.ID,
		Status:        model.StatusBlocked,
		IsCompleted:   false,
		PriorityOrder: 1,
		BlockerReason: "Waiting for third-party API credentials approval",
	}))

	// 3. Query DaySessionWithTasks in a single logical round-trip
	joinedSession, err := sessionService.GetDaySessionWithTasks(ctx, userID, date)
	require.NoError(t, err)

	// Assertions matching Gherkin Scenario 2
	assert.Equal(t, date, joinedSession.Session.Date)

	// Verify tasks.yesterday (length 1)
	require.Len(t, joinedSession.Tasks.Yesterday, 1)
	assert.Equal(t, taskYesterday.ID, joinedSession.Tasks.Yesterday[0].TaskID)
	assert.Equal(t, "Yesterday Accomplishment", joinedSession.Tasks.Yesterday[0].Title)
	assert.True(t, joinedSession.Tasks.Yesterday[0].IsCompleted)

	// Verify tasks.today (length 2, ordered by priority_order ascending)
	require.Len(t, joinedSession.Tasks.Today, 2)
	assert.Equal(t, taskToday1.ID, joinedSession.Tasks.Today[0].TaskID)
	assert.Equal(t, 1, joinedSession.Tasks.Today[0].PriorityOrder)
	assert.Equal(t, taskToday2.ID, joinedSession.Tasks.Today[1].TaskID)
	assert.Equal(t, 2, joinedSession.Tasks.Today[1].PriorityOrder)

	// Verify tasks.blocked (length 1, with blocker_reason populated)
	require.Len(t, joinedSession.Tasks.Blocked, 1)
	assert.Equal(t, taskBlocked.ID, joinedSession.Tasks.Blocked[0].TaskID)
	require.NotNil(t, joinedSession.Tasks.Blocked[0].BlockerReason)
	assert.Equal(t, "Waiting for third-party API credentials approval", *joinedSession.Tasks.Blocked[0].BlockerReason)
}

// Scenario 3: User Data Isolation
func TestScenario3_UserDataIsolation(t *testing.T) {
	taskRepo, daySessionRepo, _ := setupAllRepositories(t)
	ctx := context.Background()

	userA := "user-A-" + uuid.New().String()
	userB := "user-B-" + uuid.New().String()

	// user-A creates a task
	taskA := &model.Task{
		UserID:       userA,
		Title:        "Secret Task User A",
		BacklogOrder: 1,
	}
	require.NoError(t, taskRepo.Create(ctx, taskA))

	// user-A creates a day session
	_, err := daySessionRepo.GetOrCreateByDate(ctx, userA, "2026-08-28")
	require.NoError(t, err)

	// Verify user-B cannot list user-A's backlog
	backlogB, err := taskRepo.ListBacklog(ctx, userB)
	require.NoError(t, err)
	assert.Empty(t, backlogB, "user-B must see 0 backlog records from user-A")

	// Verify user-B cannot read user-A's task by ID
	_, err = taskRepo.GetByID(ctx, userB, taskA.ID)
	assert.ErrorIs(t, err, model.ErrNotFound, "user-B must receive ErrNotFound when querying user-A's task")

	// Verify user-B cannot read user-A's day session
	_, err = daySessionRepo.GetByDate(ctx, userB, "2026-08-28")
	assert.ErrorIs(t, err, model.ErrNotFound, "user-B must receive ErrNotFound when querying user-A's day session")
}
