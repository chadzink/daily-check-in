package api

import (
	"errors"
	"net/http"

	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/labstack/echo/v4"
)

// RitualHandler handles morning check-in and evening check-out endpoints
type RitualHandler struct {
	ritualService service.RitualService
}

// NewRitualHandler constructs a RitualHandler
func NewRitualHandler(ritualService service.RitualService) *RitualHandler {
	return &RitualHandler{ritualService: ritualService}
}

// RegisterRoutes registers ritual endpoints
func (h *RitualHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/days/:date/check-in/context", h.GetCheckInContext)
	g.POST("/days/:date/check-in", h.ExecuteCheckIn)
	g.POST("/days/:date/check-out", h.ExecuteCheckOut)
}

// GetCheckInContext returns pre-flight context for morning check-in wizard
func (h *RitualHandler) GetCheckInContext(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	resp, err := h.ritualService.GetMorningCheckInContext(c.Request().Context(), userID, date)
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

	return c.JSON(http.StatusOK, resp)
}

// ExecuteCheckIn commits the morning check-in state atomically
func (h *RitualHandler) ExecuteCheckIn(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	var req model.ExecuteCheckInRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid request payload",
		})
	}

	sessionWithTasks, err := h.ritualService.ExecuteMorningCheckIn(c.Request().Context(), userID, date, req)
	if err != nil {
		if errors.Is(err, model.ErrConflict) {
			return c.JSON(http.StatusConflict, model.StandardErrorResponse{
				Error:   "Conflict",
				Message: "Session already checked in",
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

	return c.JSON(http.StatusOK, sessionWithTasks)
}

// ExecuteCheckOut commits the evening check-out and reflections
func (h *RitualHandler) ExecuteCheckOut(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	date := c.Param("date")
	var req model.ExecuteCheckOutRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Invalid request payload",
		})
	}

	sessionWithTasks, err := h.ritualService.ExecuteCheckOut(c.Request().Context(), userID, date, req)
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

	return c.JSON(http.StatusOK, sessionWithTasks)
}
