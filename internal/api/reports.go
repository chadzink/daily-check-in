package api

import (
	"errors"
	"net/http"

	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/labstack/echo/v4"
)

// ReportHandler manages reporting endpoints
type ReportHandler struct {
	reportService service.ReportService
}

// NewReportHandler constructs a ReportHandler
func NewReportHandler(reportService service.ReportService) *ReportHandler {
	return &ReportHandler{reportService: reportService}
}

// RegisterRoutes registers reporting endpoints
func (h *ReportHandler) RegisterRoutes(g *echo.Group) {
	g.GET("/reports/completed", h.GetCompletedTasksReport)
}

// GetCompletedTasksReport returns completed tasks filtered by optional start/end YYYY-MM-DD query params
func (h *ReportHandler) GetCompletedTasksReport(c echo.Context) error {
	userID := middleware.GetUserID(c)
	if userID == "" {
		return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{Error: "Unauthorized"})
	}

	startDate := c.QueryParam("start")
	endDate := c.QueryParam("end")

	resp, err := h.reportService.GetCompletedTasksReport(c.Request().Context(), userID, startDate, endDate)
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
