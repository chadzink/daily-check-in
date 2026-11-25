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

func TestRitualService_YesterdayDoesNotAccumulateAcrossDays(t *testing.T) {
	ritualSvc, taskSvc, daySessionSvc, _, dayTaskRepo, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-user-" + uuid.New().String()

	day1 := "2026-11-22"
	day2 := "2026-11-23"
	day3 := "2026-11-24"

	tA, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Day 1 Completed Task A"})
	require.NoError(t, err)
	tB, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Day 2 Completed Task B"})
	require.NoError(t, err)
	tC, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Day 3 Active Task C"})
	require.NoError(t, err)

	// Day 1: Check in with Task A and complete it
	day1Session, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, day1, model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{tA.ID},
	})
	require.NoError(t, err)
	require.Len(t, day1Session.Tasks.Today, 1)

	completed := true
	_, err = daySessionSvc.UpdateDayTask(ctx, userID, day1, day1Session.Tasks.Today[0].DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)

	// Day 2: Check in with Task B, verify Yesterday shows only Task A, then complete Task B
	day2Session, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, day2, model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{tB.ID},
	})
	require.NoError(t, err)
	assert.Equal(t, day1, day2Session.YesterdayDate)
	require.Len(t, day2Session.Tasks.Yesterday, 1)
	assert.Equal(t, tA.ID, day2Session.Tasks.Yesterday[0].TaskID)

	_, err = daySessionSvc.UpdateDayTask(ctx, userID, day2, day2Session.Tasks.Today[0].DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)

	// Day 3: Pre-check-in context must show ONLY Task B (not Task A)
	ctxDay3, err := ritualSvc.GetMorningCheckInContext(ctx, userID, day3)
	require.NoError(t, err)
	assert.Equal(t, day2, ctxDay3.YesterdayDate)
	require.Len(t, ctxDay3.YesterdayTasks, 1, "Day 3 check-in context must not accumulate Day 1 tasks")
	assert.Equal(t, tB.ID, ctxDay3.YesterdayTasks[0].TaskID)

	// Day 3: Execute check-in and verify board shows ONLY Task B and no StatusYesterday docs persisted
	day3Session, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, day3, model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{tC.ID},
	})
	require.NoError(t, err)
	assert.Equal(t, day2, day3Session.YesterdayDate)
	require.Len(t, day3Session.Tasks.Yesterday, 1, "Day 3 Yesterday must contain only Day 2's completed task")
	assert.Equal(t, tB.ID, day3Session.Tasks.Yesterday[0].TaskID)

	persistedDay3, err := dayTaskRepo.ListByDate(ctx, userID, day3)
	require.NoError(t, err)
	for _, dt := range persistedDay3 {
		assert.NotEqual(t, model.StatusYesterday, dt.Status, "ExecuteMorningCheckIn must not persist StatusYesterday copies")
	}
}

func TestRitualService_YesterdaySkipsDaysWithNoCompletions(t *testing.T) {
	ritualSvc, taskSvc, daySessionSvc, _, _, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-user-" + uuid.New().String()

	monday := "2026-11-23"
	tuesday := "2026-11-24"
	wednesday := "2026-11-25"

	tA, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Monday Completed Task"})
	require.NoError(t, err)
	tB, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Tuesday Incomplete Task"})
	require.NoError(t, err)

	// Monday: check in & complete Task A
	monSess, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, monday, model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{tA.ID},
	})
	require.NoError(t, err)
	completed := true
	_, err = daySessionSvc.UpdateDayTask(ctx, userID, monday, monSess.Tasks.Today[0].DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)

	// Tuesday: check in with incomplete Task B (0 completions on Tuesday)
	_, err = ritualSvc.ExecuteMorningCheckIn(ctx, userID, tuesday, model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{tB.ID},
	})
	require.NoError(t, err)

	// Wednesday: Yesterday should skip Tuesday and return Monday's completed Task A,
	// while rollover_candidates still returns Tuesday's incomplete Task B
	wedCtx, err := ritualSvc.GetMorningCheckInContext(ctx, userID, wednesday)
	require.NoError(t, err)
	assert.Equal(t, tuesday, wedCtx.PreviousDate)
	assert.Equal(t, monday, wedCtx.YesterdayDate)
	require.Len(t, wedCtx.YesterdayTasks, 1)
	assert.Equal(t, tA.ID, wedCtx.YesterdayTasks[0].TaskID)
	require.Len(t, wedCtx.RolloverCandidates, 1)
	assert.Equal(t, tB.ID, wedCtx.RolloverCandidates[0].TaskID)

	wedBoard, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, wednesday)
	require.NoError(t, err)
	assert.Equal(t, monday, wedBoard.YesterdayDate)
	require.Len(t, wedBoard.Tasks.Yesterday, 1)
	assert.Equal(t, tA.ID, wedBoard.Tasks.Yesterday[0].TaskID)
}

func TestRitualService_RolloverCompletedUpdatesPriorDayAndAppearsInYesterday(t *testing.T) {
	ritualSvc, taskSvc, daySessionSvc, _, dayTaskRepo, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "ritual-user-" + uuid.New().String()

	day1 := "2026-11-22"
	day2 := "2026-11-23"

	tA, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Day 1 Completed"})
	require.NoError(t, err)
	tB, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Day 1 Late Completed"})
	require.NoError(t, err)

	day1Sess, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, day1, model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{tA.ID, tB.ID},
	})
	require.NoError(t, err)
	completed := true
	_, err = daySessionSvc.UpdateDayTask(ctx, userID, day1, day1Sess.Tasks.Today[0].DayTaskID, model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	})
	require.NoError(t, err)

	// Day 2: Mark Task B as RolloverCompleted during morning check-in
	day2Sess, err := ritualSvc.ExecuteMorningCheckIn(ctx, userID, day2, model.ExecuteCheckInRequest{
		RolloverDecisions: []model.RolloverDecision{
			{
				DayTaskID: day1Sess.Tasks.Today[1].DayTaskID,
				TaskID:    tB.ID,
				Action:    model.RolloverCompleted,
			},
		},
	})
	require.NoError(t, err)
	assert.Equal(t, day1, day2Sess.YesterdayDate)
	assert.Len(t, day2Sess.Tasks.Yesterday, 2, "Both completed and late-completed Day 1 tasks should appear in Yesterday")

	masterB, err := taskSvc.GetTaskByID(ctx, userID, tB.ID)
	require.NoError(t, err)
	assert.True(t, masterB.IsCompleted)

	persistedDay2, err := dayTaskRepo.ListByDate(ctx, userID, day2)
	require.NoError(t, err)
	for _, dt := range persistedDay2 {
		assert.NotEqual(t, model.StatusYesterday, dt.Status)
	}
}

func TestYesterday_LegacyStatusYesterdayIgnoredAcrossBoardReportsAndCalendar(t *testing.T) {
	_, taskSvc, daySessionSvc, daySessionRepo, dayTaskRepo, taskRepo := setupRitualTest(t)
	reportSvc := service.NewReportService(daySessionRepo, dayTaskRepo, taskRepo)
	calendarSvc := service.NewCalendarService(daySessionRepo, dayTaskRepo)

	ctx := context.Background()
	userID := "legacy-user-" + uuid.New().String()
	now := time.Now().UTC()

	day1 := "2026-11-22"
	day2 := "2026-11-23"
	day3 := "2026-11-24"

	tA, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Old Day 1 Task"})
	require.NoError(t, err)
	tB, err := taskSvc.CreateTask(ctx, userID, model.CreateTaskRequest{Title: "Recent Day 2 Task"})
	require.NoError(t, err)

	// Create sessions for day1, day2, day3
	for _, d := range []string{day1, day2, day3} {
		sess, err := daySessionRepo.GetOrCreateByDate(ctx, userID, d)
		require.NoError(t, err)
		sess.CheckInAt = &now
		require.NoError(t, daySessionRepo.Update(ctx, sess))
	}

	// Day 1: Task A completed
	require.NoError(t, dayTaskRepo.Create(ctx, userID, day1, &model.DayTask{
		ID: uuid.New().String(), DaySessionID: day1, TaskID: tA.ID,
		Status: model.StatusToday, IsCompleted: true, CompletedAt: &now, PriorityOrder: 1,
	}))
	// Day 2: Legacy polluted StatusYesterday for Task A + real completed Task B
	require.NoError(t, dayTaskRepo.Create(ctx, userID, day2, &model.DayTask{
		ID: uuid.New().String(), DaySessionID: day2, TaskID: tA.ID,
		Status: model.StatusYesterday, IsCompleted: true, CompletedAt: &now, PriorityOrder: 1,
	}))
	require.NoError(t, dayTaskRepo.Create(ctx, userID, day2, &model.DayTask{
		ID: uuid.New().String(), DaySessionID: day2, TaskID: tB.ID,
		Status: model.StatusToday, IsCompleted: true, CompletedAt: &now, PriorityOrder: 2,
	}))
	// Day 3: Legacy polluted StatusYesterday copies for both Task A and Task B
	require.NoError(t, dayTaskRepo.Create(ctx, userID, day3, &model.DayTask{
		ID: uuid.New().String(), DaySessionID: day3, TaskID: tA.ID,
		Status: model.StatusYesterday, IsCompleted: true, CompletedAt: &now, PriorityOrder: 1,
	}))
	require.NoError(t, dayTaskRepo.Create(ctx, userID, day3, &model.DayTask{
		ID: uuid.New().String(), DaySessionID: day3, TaskID: tB.ID,
		Status: model.StatusYesterday, IsCompleted: true, CompletedAt: &now, PriorityOrder: 2,
	}))

	// 1. Board on Day 3 must ignore legacy StatusYesterday docs and resolve only Day 2's Task B
	day3Board, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, day3)
	require.NoError(t, err)
	assert.Equal(t, day2, day3Board.YesterdayDate)
	require.Len(t, day3Board.Tasks.Yesterday, 1)
	assert.Equal(t, tB.ID, day3Board.Tasks.Yesterday[0].TaskID)

	// 2. Completed Tasks Report must not double-count legacy StatusYesterday docs
	report, err := reportSvc.GetCompletedTasksReport(ctx, userID, day1, day3)
	require.NoError(t, err)
	assert.Equal(t, 2, report.TotalCount)
	require.Len(t, report.Tasks, 2)

	// 3. Calendar summary must not count legacy StatusYesterday docs in completed or total counts
	cal, err := calendarSvc.GetMonthSummary(ctx, userID, "2026-11")
	require.NoError(t, err)
	dayMap := make(map[string]model.DaySummary)
	for _, d := range cal.Days {
		dayMap[d.Date] = d
	}
	assert.Equal(t, 1, dayMap[day2].CompletedTaskCount)
	assert.Equal(t, 1, dayMap[day2].TotalTaskCount)
	assert.Equal(t, 0, dayMap[day3].CompletedTaskCount)
	assert.Equal(t, 0, dayMap[day3].TotalTaskCount)
}

func TestYesterday_EmptyWhenNoPriorCompletions(t *testing.T) {
	_, _, daySessionSvc, _, _, _ := setupRitualTest(t)
	ctx := context.Background()
	userID := "empty-user-" + uuid.New().String()

	board, err := daySessionSvc.GetDaySessionWithTasks(ctx, userID, "2026-11-25")
	require.NoError(t, err)
	assert.Empty(t, board.YesterdayDate)
	assert.NotNil(t, board.Tasks.Yesterday)
	assert.Empty(t, board.Tasks.Yesterday)
}
