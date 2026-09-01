package api

import (
	"errors"
	"net/http"

	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/labstack/echo/v4"
)

// DaysHandler manages daily workday session endpoints
type DaysHandler struct {
	sessionService service.DaySessionService
}

// NewDaysHandler constructs a DaysHandler
func NewDaysHandler(sessionService service.DaySessionService) *DaysHandler {
	return &DaysHandler{sessionService: sessionService}
}

// RegisterRoutes registers daily session routes
func (h *DaysHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/days/:date", h.GetDaySession)
	g.PATCH("/days/:date", h.UpdateDaySession)
	g.POST("/days/:date/tasks", h.CreateDayTask)
	g.PATCH("/days/:date/tasks/:id", h.UpdateDayTask)
	g.DELETE("/days/:date/tasks/:id", h.DeleteDayTask)
	g.PUT("/days/:date/reorder", h.ReorderDayTasks)
	g.POST("/days/:date/pull", h.PullDayTask)
	g.POST("/days/:date/tasks/:id/demote", h.DemoteDayTask)
	g.PATCH("/day-tasks/:id", h.PatchDayTask)
	g.PUT("/day-tasks/reorder", h.ReorderDayTasksDirect)
}

// GetDaySession retrieves the session and joined tasks grouped into yesterday, today, and blocked
func (h *DaysHandler) GetDaySession(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	data, err := h.sessionService.GetDaySessionWithTasks(c.Request().Context(), userID, date)
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

	return c.JSON(http.StatusOK, data)
}

// UpdateDaySession updates notes, reflections, or timestamps
func (h *DaysHandler) UpdateDaySession(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	var req model.UpdateDaySessionRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid request payload",
		})
	}

	session, err := h.sessionService.UpdateDaySession(c.Request().Context(), userID, date, req)
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

	return c.JSON(http.StatusOK, session)
}

// CreateDayTask commits a task to a day session
func (h *DaysHandler) CreateDayTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	var req model.CreateDayTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid request payload",
		})
	}

	dt, err := h.sessionService.CreateDayTask(c.Request().Context(), userID, date, req)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.StandardErrorResponse{
				Error:   "NotFound",
				Message: "Referenced master task not found",
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

	return c.JSON(http.StatusCreated, dt)
}

// UpdateDayTask updates day-specific execution status, completion, or blocker reason
func (h *DaysHandler) UpdateDayTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	dayTaskID := c.Param("id")
	var req model.UpdateDayTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid request payload",
		})
	}

	dt, err := h.sessionService.UpdateDayTask(c.Request().Context(), userID, date, dayTaskID, req)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.StandardErrorResponse{
				Error:   "NotFound",
				Message: "Day task not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, dt)
}

// DeleteDayTask removes a day task association
func (h *DaysHandler) DeleteDayTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	dayTaskID := c.Param("id")
	if err := h.sessionService.DeleteDayTask(c.Request().Context(), userID, date, dayTaskID); err != nil {
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]bool{"deleted": true})
}

// ReorderDayTasks updates priority ranks for day tasks
func (h *DaysHandler) ReorderDayTasks(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	var req model.ReorderDayTasksRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid reorder payload",
		})
	}

	if err := h.sessionService.ReorderDayTasks(c.Request().Context(), userID, date, req); err != nil {
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

// PullDayTask pulls an existing master task into the specified day session
func (h *DaysHandler) PullDayTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	var req model.PullDayTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid pull payload",
		})
	}

	dt, err := h.sessionService.PullDayTask(c.Request().Context(), userID, date, req)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.StandardErrorResponse{
				Error:   "NotFound",
				Message: "Referenced master task not found",
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

	return c.JSON(http.StatusCreated, dt)
}

// DemoteDayTask removes a task from day execution, demoting it back to global backlog
func (h *DaysHandler) DemoteDayTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	dayTaskID := c.Param("id")
	if err := h.sessionService.DemoteDayTask(c.Request().Context(), userID, date, dayTaskID); err != nil {
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}

// PatchDayTask updates a day task by its ID across day sessions
func (h *DaysHandler) PatchDayTask(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	dayTaskID := c.Param("id")
	var req model.UpdateDayTaskRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid request payload",
		})
	}

	dt, err := h.sessionService.PatchDayTask(c.Request().Context(), userID, dayTaskID, req)
	if err != nil {
		if errors.Is(err, model.ErrNotFound) {
			return c.JSON(http.StatusNotFound, model.StandardErrorResponse{
				Error:   "NotFound",
				Message: "Day task not found",
			})
		}
		return c.JSON(http.StatusInternalServerError, model.StandardErrorResponse{
			Error:   "InternalServerError",
			Message: err.Error(),
		})
	}

	return c.JSON(http.StatusOK, dt)
}

// ReorderDayTasksDirect updates priority ranks using day_session_date in request payload
func (h *DaysHandler) ReorderDayTasksDirect(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	var req model.ReorderDayTasksRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid reorder payload",
		})
	}

	if err := h.sessionService.ReorderDayTasksDirect(c.Request().Context(), userID, req); err != nil {
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

	return c.JSON(http.StatusOK, map[string]bool{"success": true})
}
