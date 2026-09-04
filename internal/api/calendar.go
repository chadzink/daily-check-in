package api

import (
	"errors"
	"net/http"

	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/labstack/echo/v4"
)

// CalendarHandler handles calendar summary endpoints
type CalendarHandler struct {
	calendarService service.CalendarService
}

// NewCalendarHandler constructs a CalendarHandler
func NewCalendarHandler(calendarService service.CalendarService) *CalendarHandler {
	return &CalendarHandler{calendarService: calendarService}
}

// RegisterRoutes registers calendar endpoints
func (h *CalendarHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/calendar/summary", h.GetMonthSummary)
}

// GetMonthSummary returns monthly day summaries and task completion metrics
func (h *CalendarHandler) GetMonthSummary(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	month := c.QueryParam("month")
	if month == "" {
		return c.JSON(http.StatusBadRequest, model.StandardErrorResponse{
			Error:   "BadRequest",
			Message: "Query parameter 'month' is required (format: YYYY-MM)",
		})
	}

	resp, err := h.calendarService.GetMonthSummary(c.Request().Context(), userID, month)
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
