package service_test

import (
	"context"
	"strings"
	"testing"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPlan015_Item1_PastDatePullGuard(t *testing.T) {
	taskSvc, daySessionSvc := setupServices(t)
	ctx := context.Background()
	userID := "plan015-item1-" + uuid.New().String()

	task, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Backlog Item"})
	require.NoError(t, err)

	// Past date must be rejected
	_, err = daySessionSvc.PullDayTask(ctx, userID, "2026-11-24", model.PullDayTaskRequest{
		TaskID:    task.ID,
		Status:    model.StatusToday,
		TodayDate: "2026-11-26",
	})
	require.ErrorIs(t, err, model.ErrInvalidInput)
	assert.Contains(t, err.Error(), "cannot pull tasks into a past date")

	// Today must succeed
	pulledToday, err := daySessionSvc.PullDayTask(ctx, userID, "2026-11-26", model.PullDayTaskRequest{
		TaskID:    task.ID,
		Status:    model.StatusToday,
		TodayDate: "2026-11-26",
	})
	require.NoError(t, err)
	assert.Equal(t, task.ID, pulledToday.TaskID)

	// Future date must succeed
	pulledFuture, err := daySessionSvc.PullDayTask(ctx, userID, "2026-11-28", model.PullDayTaskRequest{
		TaskID:    task.ID,
		Status:    model.StatusToday,
		TodayDate: "2026-11-26",
	})
	require.NoError(t, err)
	assert.Equal(t, "2026-11-28", pulledFuture.DaySessionID)
}

func TestPlan015_Item2_MoveTaskToFutureDate(t *testing.T) {
	taskSvc, daySessionSvc := setupServices(t)
	ctx := context.Background()
	userID := "plan015-item2-" + uuid.New().String()

	today := "2026-11-26"
	future := "2026-11-28"

	// 1. Blocked task on today with blocker_reason and subtasks
	blockedMaster, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Blocked Task"})
	require.NoError(t, err)
	subs := []model.Subtask{{Title: "Verify key", IsCompleted: false}}
	_, err = taskSvc.UpdateTask(ctx, userID, blockedMaster.ID, model.UpdateTaskRequest{Subtasks: &subs})
	require.NoError(t, err)

	blockedDT, err := daySessionSvc.CreateDayTask(ctx, userID, today, model.CreateDayTaskRequest{
		TaskID:        blockedMaster.ID,
		Status:        model.StatusBlocked,
		BlockerReason: "Waiting on API key",
	})
	require.NoError(t, err)

	movedBlocked, err := taskSvc.MoveTaskToDate(ctx, userID, blockedMaster.ID, model.MoveTaskToDateRequest{
		TargetDate: future,
		SourceDate: today,
		DayTaskID:  blockedDT.DayTaskID,
		TodayDate:  today,
	})
	require.NoError(t, err)
	assert.Equal(t, model.StatusBlocked, movedBlocked.Status)
	require.NotNil(t, movedBlocked.BlockerReason)
	assert.Equal(t, "Waiting on API key", *movedBlocked.BlockerReason)
	require.Len(t, movedBlocked.Subtasks, 1)
	assert.Equal(t, "Verify key", movedBlocked.Subtasks[0].Title)

	// Verify removed from today and present on future
	todayBoard, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, today)
	require.NoError(t, err)
	assert.Empty(t, todayBoard.Tasks.Blocked)

	futureBoard, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, future)
	require.NoError(t, err)
	require.Len(t, futureBoard.Tasks.Blocked, 1)
	assert.Equal(t, blockedMaster.ID, futureBoard.Tasks.Blocked[0].TaskID)
	require.NotNil(t, futureBoard.Tasks.Blocked[0].BlockerReason)
	assert.Equal(t, "Waiting on API key", *futureBoard.Tasks.Blocked[0].BlockerReason)

	// 2. Move Backlog task to future -> lands in Today and disappears from Backlog
	backlogTask, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Defer Backlog Task"})
	require.NoError(t, err)

	movedBacklog, err := taskSvc.MoveTaskToDate(ctx, userID, backlogTask.ID, model.MoveTaskToDateRequest{
		TargetDate: future,
		TodayDate:  today,
	})
	require.NoError(t, err)
	assert.Equal(t, model.StatusToday, movedBacklog.Status)
	assert.Nil(t, movedBacklog.BlockerReason)

	backlog, err := taskSvc.ListBacklog(ctx, userID, today)
	require.NoError(t, err)
	for _, bt := range backlog.Tasks {
		assert.NotEqual(t, backlogTask.ID, bt.ID, "Moved backlog task must be excluded from Global Backlog")
	}

	// 3. Validation guards: target <= today or target == source_date
	_, err = taskSvc.MoveTaskToDate(ctx, userID, backlogTask.ID, model.MoveTaskToDateRequest{
		TargetDate: today,
		TodayDate:  today,
	})
	require.ErrorIs(t, err, model.ErrInvalidInput)

	_, err = taskSvc.MoveTaskToDate(ctx, userID, backlogTask.ID, model.MoveTaskToDateRequest{
		TargetDate: "2026-11-25",
		TodayDate:  today,
	})
	require.ErrorIs(t, err, model.ErrInvalidInput)

	_, err = taskSvc.MoveTaskToDate(ctx, userID, backlogTask.ID, model.MoveTaskToDateRequest{
		TargetDate: future,
		SourceDate: future,
		TodayDate:  today,
	})
	require.ErrorIs(t, err, model.ErrInvalidInput)

	// 4. Archived task cannot be moved
	archivedTask, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Archived Task"})
	require.NoError(t, err)
	require.NoError(t, taskSvc.ArchiveTask(ctx, userID, archivedTask.ID))

	_, err = taskSvc.MoveTaskToDate(ctx, userID, archivedTask.ID, model.MoveTaskToDateRequest{
		TargetDate: future,
		TodayDate:  today,
	})
	require.ErrorIs(t, err, model.ErrNotFound)
}

func TestPlan015_Item5_BacklogExcludesCommittedTodayAndFutureTasks(t *testing.T) {
	taskSvc, daySessionSvc := setupServices(t)
	ctx := context.Background()
	userID := "plan015-item5-" + uuid.New().String()

	today := "2026-11-26"
	future := "2026-11-28"

	taskX, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Task X Today"})
	require.NoError(t, err)
	taskY, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Task Y Future"})
	require.NoError(t, err)
	taskZ, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Task Z Uncommitted"})
	require.NoError(t, err)

	dtX, err := daySessionSvc.PullDayTask(ctx, userID, today, model.PullDayTaskRequest{
		TaskID:    taskX.ID,
		Status:    model.StatusToday,
		TodayDate: today,
	})
	require.NoError(t, err)
	_, err = daySessionSvc.PullDayTask(ctx, userID, future, model.PullDayTaskRequest{
		TaskID:    taskY.ID,
		Status:    model.StatusToday,
		TodayDate: today,
	})
	require.NoError(t, err)

	// Backlog should contain ONLY Task Z
	backlog, err := taskSvc.ListBacklog(ctx, userID, today)
	require.NoError(t, err)
	require.Len(t, backlog.Tasks, 1)
	assert.Equal(t, taskZ.ID, backlog.Tasks[0].ID)

	// Demote Task X -> Task X reappears in Backlog
	require.NoError(t, daySessionSvc.DemoteDayTask(ctx, userID, today, dtX.ID))

	backlogAfterDemote, err := taskSvc.ListBacklog(ctx, userID, today)
	require.NoError(t, err)
	ids := make([]string, 0, len(backlogAfterDemote.Tasks))
	for _, bt := range backlogAfterDemote.Tasks {
		ids = append(ids, bt.ID)
	}
	assert.Contains(t, ids, taskX.ID)
	assert.Contains(t, ids, taskZ.ID)
	assert.NotContains(t, ids, taskY.ID)
}

func TestPlan015_Item6_SubtasksCRUDValidationAndOneWayCascade(t *testing.T) {
	taskSvc, daySessionSvc := setupServices(t)
	ctx := context.Background()
	userID := "plan015-item6-" + uuid.New().String()
	today := "2026-11-26"

	// 1. Newly created task has empty non-nil subtasks slice
	task, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Parent Task"})
	require.NoError(t, err)
	assert.NotNil(t, task.Subtasks)
	assert.Empty(t, task.Subtasks)

	// 2. Add subtasks via UpdateTask (auto-UUID, trimmed title, 1..N order)
	subs := []model.Subtask{
		{Title: "  Write tests  ", IsCompleted: true},
		{Title: "Update docs", IsCompleted: false},
	}
	updated, err := taskSvc.UpdateTask(ctx, userID, task.ID, model.UpdateTaskRequest{Subtasks: &subs})
	require.NoError(t, err)
	require.Len(t, updated.Subtasks, 2)
	assert.NotEmpty(t, updated.Subtasks[0].ID)
	assert.Equal(t, "Write tests", updated.Subtasks[0].Title)
	assert.Equal(t, 1, updated.Subtasks[0].Order)
	assert.Equal(t, 2, updated.Subtasks[1].Order)

	// 3. Completing all subtasks never auto-completes parent
	allDone := []model.Subtask{
		{ID: updated.Subtasks[0].ID, Title: "Write tests", IsCompleted: true},
		{ID: updated.Subtasks[1].ID, Title: "Update docs", IsCompleted: true},
	}
	updated, err = taskSvc.UpdateTask(ctx, userID, task.ID, model.UpdateTaskRequest{Subtasks: &allDone})
	require.NoError(t, err)
	assert.False(t, updated.IsCompleted, "Completing all subtasks must never auto-complete parent")

	// Reset second subtask to incomplete for cascade test
	mixed := []model.Subtask{
		{ID: updated.Subtasks[0].ID, Title: "Write tests", IsCompleted: true},
		{ID: updated.Subtasks[1].ID, Title: "Update docs", IsCompleted: false},
	}
	_, err = taskSvc.UpdateTask(ctx, userID, task.ID, model.UpdateTaskRequest{Subtasks: &mixed})
	require.NoError(t, err)

	// 4. One-way cascade via UpdateDayTask: completing parent completes all subtasks; unchecking leaves them complete
	dt, err := daySessionSvc.CreateDayTask(ctx, userID, today, model.CreateDayTaskRequest{
		TaskID: task.ID,
		Status: model.StatusToday,
	})
	require.NoError(t, err)

	done := true
	completedDT, err := daySessionSvc.UpdateDayTask(ctx, userID, today, dt.DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &done,
	})
	require.NoError(t, err)
	require.Len(t, completedDT.Subtasks, 2)
	assert.True(t, completedDT.Subtasks[0].IsCompleted)
	assert.True(t, completedDT.Subtasks[1].IsCompleted)

	undone := false
	uncheckedDT, err := daySessionSvc.UpdateDayTask(ctx, userID, today, dt.DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &undone,
	})
	require.NoError(t, err)
	assert.False(t, uncheckedDT.IsCompleted)
	require.Len(t, uncheckedDT.Subtasks, 2)
	assert.True(t, uncheckedDT.Subtasks[0].IsCompleted, "Unchecking parent must not uncheck subtasks")
	assert.True(t, uncheckedDT.Subtasks[1].IsCompleted, "Unchecking parent must not uncheck subtasks")

	// 5. Validation caps: blank title, >250 chars, >50 subtasks
	blankSub := []model.Subtask{{Title: "   "}}
	_, err = taskSvc.UpdateTask(ctx, userID, task.ID, model.UpdateTaskRequest{Subtasks: &blankSub})
	require.ErrorIs(t, err, model.ErrInvalidInput)

	longSub := []model.Subtask{{Title: strings.Repeat("a", 251)}}
	_, err = taskSvc.UpdateTask(ctx, userID, task.ID, model.UpdateTaskRequest{Subtasks: &longSub})
	require.ErrorIs(t, err, model.ErrInvalidInput)

	tooMany := make([]model.Subtask, 51)
	for i := range tooMany {
		tooMany[i] = model.Subtask{Title: "Sub"}
	}
	_, err = taskSvc.UpdateTask(ctx, userID, task.ID, model.UpdateTaskRequest{Subtasks: &tooMany})
	require.ErrorIs(t, err, model.ErrInvalidInput)
}
