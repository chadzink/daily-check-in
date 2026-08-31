package api

import (
	"errors"
	"net/http"

	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/labstack/echo/v4"
)

// BacklogHandler handles requests targeting the global task backlog
type BacklogHandler struct {
	taskService service.TaskService
}

// NewBacklogHandler constructs a BacklogHandler
func NewBacklogHandler(taskService service.TaskService) *BacklogHandler {
	return &BacklogHandler{taskService: taskService}
}

// RegisterRoutes attaches backlog endpoints to the Echo router
func (h *BacklogHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/backlog", h.GetBacklog)
	g.POST("/backlog/tasks", h.CreateBacklogTask)
	g.PUT("/backlog/reorder", h.ReorderBacklog)
}

// GetBacklog returns the list of active unarchived backlog tasks
func (h *BacklogHandler) GetBacklog(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	resp, err := h.taskService.ListBacklog(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, resp)
}

// CreateBacklogTask adds a task directly to the user's backlog pool
func (h *BacklogHandler) CreateBacklogTask(c echo.Context) error {
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

// ReorderBacklog updates the backlog order ranks for a list of task IDs
func (h *BacklogHandler) ReorderBacklog(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	var req model.ReorderBacklogRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid reorder payload",
		})
	}

	if err := h.taskService.ReorderBacklog(c.Request().Context(), userID, req.OrderedTaskIDs); err != nil {
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
