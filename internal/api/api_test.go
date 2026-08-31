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

	e := echo.New()
	apiGroup := e.Group("/api")
	apiGroup.Use(middleware.FirebaseAuthMiddleware(nil))

	backlogHandler := api.NewBacklogHandler(taskService)
	backlogHandler.RegisterRoutes(apiGroup)

	tasksHandler := api.NewTasksHandler(taskService)
	tasksHandler.RegisterRoutes(apiGroup)

	daysHandler := api.NewDaysHandler(daySessionService)
	daysHandler.RegisterRoutes(apiGroup)

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
