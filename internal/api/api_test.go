package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/chadzink/dailycheckin/internal/api"
	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/repository"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestEcho(t *testing.T) *echo.Echo {
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

	taskService := service.NewTaskService(taskRepo, daySessionRepo, dayTaskRepo)
	daySessionService := service.NewDaySessionService(daySessionRepo, dayTaskRepo, taskRepo)
	ritualService := service.NewRitualService(daySessionRepo, dayTaskRepo, taskRepo, daySessionService)

	e := echo.New()
	apiGroup := e.Group("/api")
	apiGroup.Use(middleware.FirebaseAuthMiddleware(nil))

	backlogHandler := api.NewBacklogHandler(taskService)
	backlogHandler.RegisterRoutes(apiGroup)

	tasksHandler := api.NewTasksHandler(taskService)
	tasksHandler.RegisterRoutes(apiGroup)

	daysHandler := api.NewDaysHandler(daySessionService)
	daysHandler.RegisterRoutes(apiGroup)

	ritualHandler := api.NewRitualHandler(ritualService)
	ritualHandler.RegisterRoutes(apiGroup)

	return e
}

func TestBacklogAndTasksEndpoints(t *testing.T) {
	e := setupTestEcho(t)
	userID := "api-user-" + uuid.New().String()

	// 1. Create a task via POST /api/backlog/tasks
	createPayload := model.CreateTaskRequest{
		Title:        "Implement Vitest test suite",
		Description:  "Setup JSDOM environment and assertions",
		BacklogOrder: 1,
	}
	body, _ := json.Marshal(createPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/backlog/tasks", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)
	var createdTask model.Task
	err := json.Unmarshal(rec.Body.Bytes(), &createdTask)
	require.NoError(t, err)
	assert.NotEmpty(t, createdTask.ID)
	assert.Equal(t, "Implement Vitest test suite", createdTask.Title)

	// 2. Fetch Backlog via GET /api/backlog
	req = httptest.NewRequest(http.MethodGet, "/api/backlog", nil)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var backlogResp model.BacklogResponse
	err = json.Unmarshal(rec.Body.Bytes(), &backlogResp)
	require.NoError(t, err)
	require.Len(t, backlogResp.Tasks, 1)
	assert.Equal(t, createdTask.ID, backlogResp.Tasks[0].ID)

	// 3. Update task via PATCH /api/tasks/:id
	newTitle := "Implement Vitest + React Testing Library"
	updatePayload := model.UpdateTaskRequest{
		Title: &newTitle,
	}
	body, _ = json.Marshal(updatePayload)
	req = httptest.NewRequest(http.MethodPatch, "/api/tasks/"+createdTask.ID, bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var updatedTask model.Task
	err = json.Unmarshal(rec.Body.Bytes(), &updatedTask)
	require.NoError(t, err)
	assert.Equal(t, newTitle, updatedTask.Title)

	// 4. Archive task via DELETE /api/tasks/:id
	req = httptest.NewRequest(http.MethodDelete, "/api/tasks/"+createdTask.ID, nil)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)

	// Verify backlog is now empty
	req = httptest.NewRequest(http.MethodGet, "/api/backlog", nil)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var emptyBacklog model.BacklogResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &emptyBacklog)
	assert.Empty(t, emptyBacklog.Tasks)
}

func TestDaysEndpoints(t *testing.T) {
	e := setupTestEcho(t)
	userID := "api-user-" + uuid.New().String()
	date := "2026-08-31"

	// 1. Quick-add task committed to today
	status := model.StatusToday
	createPayload := model.CreateTaskRequest{
		Title:      "End-to-End browser signoff",
		TargetDate: date,
		Status:     &status,
	}
	body, _ := json.Marshal(createPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusCreated, rec.Code)

	// 2. Fetch DaySession via GET /api/days/:date
	req = httptest.NewRequest(http.MethodGet, "/api/days/"+date, nil)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var daySession model.DaySessionWithTasks
	err := json.Unmarshal(rec.Body.Bytes(), &daySession)
	require.NoError(t, err)
	assert.Equal(t, date, daySession.Session.Date)
	require.Len(t, daySession.Tasks.Today, 1)
	assert.Equal(t, "End-to-End browser signoff", daySession.Tasks.Today[0].Title)

	// 3. Update session notes via PATCH /api/days/:date
	notes := "Completed all Sprint 2 milestones on schedule."
	sessionUpdate := model.UpdateDaySessionRequest{
		Notes: &notes,
	}
	body, _ = json.Marshal(sessionUpdate)
	req = httptest.NewRequest(http.MethodPatch, "/api/days/"+date, bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	var updatedSession model.DaySession
	err = json.Unmarshal(rec.Body.Bytes(), &updatedSession)
	require.NoError(t, err)
	assert.Equal(t, notes, updatedSession.Notes)
}

func TestDayTaskPlan003Endpoints(t *testing.T) {
	e := setupTestEcho(t)
	userID := "api-user-" + uuid.New().String()
	date := "2026-09-03"

	// 1. Create a task in backlog
	createTaskPayload := model.CreateTaskRequest{
		Title: "Plan 003 Board Implementation",
	}
	body, _ := json.Marshal(createTaskPayload)
	req := httptest.NewRequest(http.MethodPost, "/api/tasks", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusCreated, rec.Code)
	var masterTask model.Task
	_ = json.Unmarshal(rec.Body.Bytes(), &masterTask)

	// 2. Pull task into Today: POST /api/days/:date/pull
	pullPayload := model.PullDayTaskRequest{
		TaskID:        masterTask.ID,
		Status:        model.StatusToday,
		PriorityOrder: 1,
	}
	body, _ = json.Marshal(pullPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/days/"+date+"/pull", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusCreated, rec.Code)
	var dayTask model.DayTask
	_ = json.Unmarshal(rec.Body.Bytes(), &dayTask)
	assert.Equal(t, masterTask.ID, dayTask.TaskID)
	assert.Equal(t, model.StatusToday, dayTask.Status)

	// 3. Toggle completion: PATCH /api/day-tasks/:id
	completed := true
	patchPayload := model.UpdateDayTaskRequest{
		IsCompleted: &completed,
	}
	body, _ = json.Marshal(patchPayload)
	req = httptest.NewRequest(http.MethodPatch, "/api/day-tasks/"+dayTask.ID, bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	var patchedDT model.DayTask
	_ = json.Unmarshal(rec.Body.Bytes(), &patchedDT)
	assert.True(t, patchedDT.IsCompleted)
	assert.NotNil(t, patchedDT.CompletedAt)

	// Verify master task was updated as well
	req = httptest.NewRequest(http.MethodGet, "/api/tasks/"+masterTask.ID, nil)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	var fetchedMaster model.Task
	_ = json.Unmarshal(rec.Body.Bytes(), &fetchedMaster)
	assert.True(t, fetchedMaster.IsCompleted)

	// 4. Reorder day tasks: PUT /api/day-tasks/reorder
	statusToday := model.StatusToday
	reorderPayload := model.ReorderDayTasksRequest{
		DaySessionDate:    date,
		Status:            &statusToday,
		OrderedDayTaskIDs: []string{dayTask.ID},
	}
	body, _ = json.Marshal(reorderPayload)
	req = httptest.NewRequest(http.MethodPut, "/api/day-tasks/reorder", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)

	// 5. Demote day task back to backlog: POST /api/days/:date/tasks/:id/demote
	req = httptest.NewRequest(http.MethodPost, "/api/days/"+date+"/tasks/"+dayTask.ID+"/demote", nil)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
}

func TestRitualEndpoints(t *testing.T) {
	e := setupTestEcho(t)
	userID := "api-ritual-user-" + uuid.New().String()
	date := "2026-09-02"

	// 1. Create a couple tasks in backlog
	t1Payload := model.CreateTaskRequest{Title: "API Check-in Task 1"}
	body, _ := json.Marshal(t1Payload)
	req := httptest.NewRequest(http.MethodPost, "/api/backlog/tasks", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusCreated, rec.Code)
	var t1 model.Task
	_ = json.Unmarshal(rec.Body.Bytes(), &t1)

	// 2. GET check-in context
	req = httptest.NewRequest(http.MethodGet, "/api/days/"+date+"/check-in/context", nil)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	var ctxResp model.CheckInContextResponse
	_ = json.Unmarshal(rec.Body.Bytes(), &ctxResp)
	assert.Equal(t, date, ctxResp.TargetDate)
	assert.False(t, ctxResp.IsAlreadyCheckedIn)
	assert.NotEmpty(t, ctxResp.BacklogTasks)

	// 3. POST check-in
	checkInPayload := model.ExecuteCheckInRequest{
		TodayTaskIDs: []string{t1.ID},
		Notes:        "Morning check-in note",
	}
	body, _ = json.Marshal(checkInPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/days/"+date+"/check-in", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	var sessionResp model.DaySessionWithTasks
	_ = json.Unmarshal(rec.Body.Bytes(), &sessionResp)
	assert.NotNil(t, sessionResp.Session.CheckInAt)
	assert.Len(t, sessionResp.Tasks.Today, 1)

	// 4. Duplicate POST check-in -> 409 Conflict
	req = httptest.NewRequest(http.MethodPost, "/api/days/"+date+"/check-in", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusConflict, rec.Code)

	// 5. POST check-out
	checkOutPayload := model.ExecuteCheckOutRequest{
		CompleteTaskIDs: []string{t1.ID},
		Notes:           "Evening checkout note",
	}
	body, _ = json.Marshal(checkOutPayload)
	req = httptest.NewRequest(http.MethodPost, "/api/days/"+date+"/check-out", bytes.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.Header.Set("X-User-ID", userID)
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	assert.Equal(t, http.StatusOK, rec.Code)
	var checkoutResp model.DaySessionWithTasks
	_ = json.Unmarshal(rec.Body.Bytes(), &checkoutResp)
	assert.NotNil(t, checkoutResp.Session.CheckOutAt)
	assert.Equal(t, "Evening checkout note", checkoutResp.Session.Notes)
}

