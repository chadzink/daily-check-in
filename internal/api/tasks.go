package api

import (
	"errors"
	"net/http"

	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/labstack/echo/v4"
)

// TasksHandler manages endpoints for master tasks
type TasksHandler struct {
	taskService service.TaskService
}

// NewTasksHandler constructs a TasksHandler
func NewTasksHandler(taskService service.TaskService) *TasksHandler {
	return &TasksHandler{taskService: taskService}
}

// RegisterRoutes registers task endpoints
func (h *TasksHandler) RegisterRoutes(g *echo.Group) {
	g.POST("/tasks", h.CreateTask)
	g.GET("/tasks/:id", h.GetTask)
	g.PATCH("/tasks/:id", h.UpdateTask)
	g.DELETE("/tasks/:id", h.ArchiveTask)
}

// CreateTask quick-adds a task, optionally committing to a day session
func (h *TasksHandler) CreateTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	var req model.CreateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid request payload",
		})
	}

	task, err := h.taskService.CreateTask(c.Request().Context(), userID, req)
	if err != nil {
		if errors.Is(err, model.ErrInvalidInput) {
			return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
				Error:   "BadRequest",
				Message: err.Error(),
			})
		}
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusCreated, task)
}

// GetTask retrieves a master task by ID
func (h *TasksHandler) GetTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	id := c.Param("id")
	task, err := h.taskService.GetTaskByID(c.Request().Context(), userID, id)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.StandardErrorResponse{
				Error:   "NotFound",
				Message: "Task not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, task)
}

// UpdateTask updates attributes of an existing task
func (h *TasksHandler) UpdateTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	id := c.Param("id")
	var req model.UpdateTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid request payload",
		})
	}

	updated, err := h.taskService.UpdateTask(c.Request().Context(), userID, id, req)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.StandardErrorResponse{
				Error:   "NotFound",
				Message: "Task not found",
			})
		}
		if errors.Is(err, model.ErrInvalidInput) {
			return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
				Error:   "BadRequest",
				Message: err.Error(),
			})
		}
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, updated)
}

// ArchiveTask soft-deletes a task by setting is_archived = true
func (h *TasksHandler) ArchiveTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	id := c.Param("id")
	if err := h.taskService.ArchiveTask(c.Request().Context(), userID, id); err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.StandardErrorResponse{
				Error:   "NotFound",
				Message: "Task not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]bool{"archived": true})
}
