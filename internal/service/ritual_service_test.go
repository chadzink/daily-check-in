package service_test

import (
	"context"
	"testing"
	"time"

	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRitualService_ExcludesArchivedTasksFromMorningCheckIn is a permanent regression test
// for PLAN-015 Item 3: archived (deleted) master tasks from a prior workday must never appear
// in either YesterdayTasks (Step 1) or RolloverCandidates (Step 2) of GetMorningCheckInContext.
func TestRitualService_ExcludesArchivedTasksFromMorningCheckIn(t *testing.T) {
	ritualSvc, taskSvc, _, daySessionRepo, dayTaskRepo, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-archived-user-" + uuid.New().String()

	previousDate := "2026-11-25"
	targetDate := "2026-11-26"
	now := time.Now().UTC()

	// Seed prior active workday session with CheckInAt stamped
	prevSession, err := daySessionRepo.GetOrCreateByDate(ctx, userID, previousDate)
	require.NoError(t, err)
	prevSession.CheckInAt = &now
	require.NoError(t, daySessionRepo.Update(ctx, prevSession))

	// Create 4 tasks on previousDate:
	// - activeCompleted: should appear in YesterdayTasks
	// - archivedCompleted: archived later -> must NOT appear in YesterdayTasks
	// - activeIncomplete: should appear in RolloverCandidates
	// - archivedIncomplete: archived later -> must NOT appear in RolloverCandidates
	activeCompleted, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Active Completed"})
	require.NoError(t, err)
	archivedCompleted, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Archived Completed"})
	require.NoError(t, err)
	activeIncomplete, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Active Incomplete"})
	require.NoError(t, err)
	archivedIncomplete, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Archived Incomplete"})
	require.NoError(t, err)

	require.NoError(t, dayTaskRepo.Create(ctx, userID, previousDate, &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  previousDate,
		TaskID:        activeCompleted.ID,
		Status:        model.StatusToday,
		IsCompleted:   true,
		CompletedAt:   &now,
		PriorityOrder: 1,
	}))
	require.NoError(t, dayTaskRepo.Create(ctx, userID, previousDate, &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  previousDate,
		TaskID:        archivedCompleted.ID,
		Status:        model.StatusToday,
		IsCompleted:   true,
		CompletedAt:   &now,
		PriorityOrder: 2,
	}))
	require.NoError(t, dayTaskRepo.Create(ctx, userID, previousDate, &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  previousDate,
		TaskID:        activeIncomplete.ID,
		Status:        model.StatusToday,
		IsCompleted:   false,
		PriorityOrder: 3,
	}))
	require.NoError(t, dayTaskRepo.Create(ctx, userID, previousDate, &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  previousDate,
		TaskID:        archivedIncomplete.ID,
		Status:        model.StatusToday,
		IsCompleted:   false,
		PriorityOrder: 4,
	}))

	// Archive both archivedCompleted and archivedIncomplete master tasks
	require.NoError(t, taskSvc.ArchiveTask(ctx, userID, archivedCompleted.ID))
	require.NoError(t, taskSvc.ArchiveTask(ctx, userID, archivedIncomplete.ID))

	// Request Morning Check-In context for targetDate
	ctxResp, err := ritualSvc.GetMorningCheckInContext(ctx, userID, targetDate)
	require.NoError(t, err)

	require.Len(t, ctxResp.YesterdayTasks, 1, "Archived completed task must be excluded from YesterdayTasks")
	assert.Equal(t, activeCompleted.ID, ctxResp.YesterdayTasks[0].TaskID)

	require.Len(t, ctxResp.RolloverCandidates, 1, "Archived incomplete task must be excluded from RolloverCandidates")
	assert.Equal(t, activeIncomplete.ID, ctxResp.RolloverCandidates[0].TaskID)
}

func TestRitualService_BlockedTaskRollover_KeepBlockedAndUnblockToToday(t *testing.T) {
	ritualSvc, taskSvc, _, daySessionRepo, dayTaskRepo, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-blocked-user-" + uuid.New().String()

	previousDate := "2026-11-25"
	targetDate := "2026-11-26"
	now := time.Now().UTC()

	prevSession, err := daySessionRepo.GetOrCreateByDate(ctx, userID, previousDate)
	require.NoError(t, err)
	prevSession.CheckInAt = &now
	require.NoError(t, daySessionRepo.Update(ctx, prevSession))

	taskA, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Incomplete Today A"})
	require.NoError(t, err)
	taskB, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Blocked Keep B"})
	require.NoError(t, err)
	taskC, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Blocked Unblock C"})
	require.NoError(t, err)
	taskD, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Blocked Via List D"})
	require.NoError(t, err)

	dtA := &model.DayTask{ID: uuid.New().String(), DaySessionID: previousDate, TaskID: taskA.ID, Status: model.StatusToday, PriorityOrder: 1}
	dtB := &model.DayTask{ID: uuid.New().String(), DaySessionID: previousDate, TaskID: taskB.ID, Status: model.StatusBlocked, BlockerReason: "Waiting on QA", PriorityOrder: 2}
	dtC := &model.DayTask{ID: uuid.New().String(), DaySessionID: previousDate, TaskID: taskC.ID, Status: model.StatusBlocked, BlockerReason: "Waiting on API key", PriorityOrder: 3}
	dtD := &model.DayTask{ID: uuid.New().String(), DaySessionID: previousDate, TaskID: taskD.ID, Status: model.StatusBlocked, BlockerReason: "Waiting on legal", PriorityOrder: 4}
	for _, dt := range []*model.DayTask{dtA, dtB, dtC, dtD} {
		require.NoError(t, dayTaskRepo.Create(ctx, userID, previousDate, dt))
	}

	ctxResp, err := ritualSvc.GetMorningCheckInContext(ctx, userID, targetDate)
	require.NoError(t, err)
	require.Len(t, ctxResp.RolloverCandidates, 4)

	res, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, targetDate, model.ExecuteCheckInRequest{
		RolloverDecisions: []model.RolloverDecision{
			{DayTaskID: dtA.ID, TaskID: taskA.ID, Action: model.RolloverToToday},
			{DayTaskID: dtB.ID, TaskID: taskB.ID, Action: model.RolloverKeepBlocked},
			{DayTaskID: dtC.ID, TaskID: taskC.ID, Action: model.RolloverToToday},
		},
		TodayTaskIDs:   []string{taskA.ID, taskC.ID},
		BlockedTaskIDs: []string{taskB.ID, taskD.ID},
	})
	require.NoError(t, err)

	// Today should have A and C (C unblocked with nil BlockerReason)
	require.Len(t, res.Tasks.Today, 2)
	assert.Equal(t, taskA.ID, res.Tasks.Today[0].TaskID)
	assert.Equal(t, taskC.ID, res.Tasks.Today[1].TaskID)
	assert.Nil(t, res.Tasks.Today[1].BlockerReason, "Unblocked task rolled to Today must clear blocker_reason")

	// Blocked should have B (deduplicated from BlockedTaskIDs) and D, both preserving BlockerReason
	require.Len(t, res.Tasks.Blocked, 2)
	blockedByTask := make(map[string]model.DayTaskWithDetails)
	for _, b := range res.Tasks.Blocked {
		blockedByTask[b.TaskID] = b
	}
	require.Contains(t, blockedByTask, taskB.ID)
	require.NotNil(t, blockedByTask[taskB.ID].BlockerReason)
	assert.Equal(t, "Waiting on QA", *blockedByTask[taskB.ID].BlockerReason)

	require.Contains(t, blockedByTask, taskD.ID)
	require.NotNil(t, blockedByTask[taskD.ID].BlockerReason)
	assert.Equal(t, "Waiting on legal", *blockedByTask[taskD.ID].BlockerReason)
}

func TestRitualService_GetMorningCheckInContext_ExcludesCommittedFutureTasksFromBacklog(t *testing.T) {
	ritualSvc, taskSvc, _, daySessionRepo, dayTaskRepo, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-backlog-filter-" + uuid.New().String()

	todayDate := "2026-11-26"
	futureDate := "2026-11-28"

	uncommitted, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Uncommitted Backlog"})
	require.NoError(t, err)
	futureTask, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Scheduled Future"})
	require.NoError(t, err)

	_, err = daySessionRepo.GetOrCreateByDate(ctx, userID, futureDate)
	require.NoError(t, err)
	require.NoError(t, dayTaskRepo.Create(ctx, userID, futureDate, &model.DayTask{
		ID:            uuid.New().String(),
		DaySessionID:  futureDate,
		TaskID:        futureTask.ID,
		Status:        model.StatusToday,
		IsCompleted:   false,
		PriorityOrder: 1,
	}))

	ctxResp, err := ritualSvc.GetMorningCheckInContext(ctx, userID, todayDate)
	require.NoError(t, err)
	require.Len(t, ctxResp.BacklogTasks, 1)
	assert.Equal(t, uncommitted.ID, ctxResp.BacklogTasks[0].ID)
}

func TestRitualService_SubtaskCascadeOnRolloverCompletedAndCheckOut(t *testing.T) {
	ritualSvc, taskSvc, _, daySessionRepo, dayTaskRepo, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-subtask-cascade-" + uuid.New().String()

	day1 := "2026-11-25"
	day2 := "2026-11-26"
	now := time.Now().UTC()

	prevSession, err := daySessionRepo.GetOrCreateByDate(ctx, userID, day1)
	require.NoError(t, err)
	prevSession.CheckInAt = &now
	require.NoError(t, daySessionRepo.Update(ctx, prevSession))

	// Task 1 for RolloverCompleted cascade
	t1, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Late Complete With Subtasks"})
	require.NoError(t, err)
	subs1 := []model.Subtask{{Title: "Sub 1A", IsCompleted: false}, {Title: "Sub 1B", IsCompleted: false}}
	_, err = taskSvc.UpdateTask(ctx, userID, t1.ID, model.UpdateTaskRequest{Subtasks: &subs1})
	require.NoError(t, err)

	dt1 := &model.DayTask{ID: uuid.New().String(), DaySessionID: day1, TaskID: t1.ID, Status: model.StatusToday, PriorityOrder: 1}
	require.NoError(t, dayTaskRepo.Create(ctx, userID, day1, dt1))

	// Task 2 for CheckOut CompleteTaskIDs cascade
	t2, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Checkout Complete With Subtasks"})
	require.NoError(t, err)
	subs2 := []model.Subtask{{Title: "Sub 2A", IsCompleted: true}, {Title: "Sub 2B", IsCompleted: false}}
	_, err = taskSvc.UpdateTask(ctx, userID, t2.ID, model.UpdateTaskRequest{Subtasks: &subs2})
	require.NoError(t, err)

	// Check in on day2: mark t1 RolloverCompleted, schedule t2 for Today
	day2Sess, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, day2, model.ExecuteCheckInRequest{
		RolloverDecisions: []model.RolloverDecision{
			{DayTaskID: dt1.ID, TaskID: t1.ID, Action: model.RolloverCompleted},
		},
		TodayTaskIDs: []string{t2.ID},
	})
	require.NoError(t, err)
	require.Len(t, day2Sess.Tasks.Yesterday, 1)
	require.Len(t, day2Sess.Tasks.Yesterday[0].Subtasks, 2)
	assert.True(t, day2Sess.Tasks.Yesterday[0].Subtasks[0].IsCompleted)
	assert.True(t, day2Sess.Tasks.Yesterday[0].Subtasks[1].IsCompleted)

	// Check out on day2: mark t2 complete -> all subtasks of t2 must cascade to completed
	checkoutSess, err := ritualSvc.ExecuteCheckOut(ctx, userID, day2, model.ExecuteCheckOutRequest{
		CompleteTaskIDs: []string{t2.ID},
	})
	require.NoError(t, err)
	require.Len(t, checkoutSess.Tasks.Today, 1)
	require.Len(t, checkoutSess.Tasks.Today[0].Subtasks, 2)
	assert.True(t, checkoutSess.Tasks.Today[0].Subtasks[0].IsCompleted)
	assert.True(t, checkoutSess.Tasks.Today[0].Subtasks[1].IsCompleted)
}
