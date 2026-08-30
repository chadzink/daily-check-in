package api

import (
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
)

// HealthResponse represents the response payload for the health check endpoint.
type HealthResponse struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
}

// CurrentVersion is the application semantic version.
const CurrentVersion = "0.1.0"

// HealthCheckHandler handles GET /api/health requests.
func HealthCheckHandler(c echo.Context) error {
	resp := HealthResponse{
		Status:    "healthy",
		Timestamp: time.Now().UTC(),
		Version:   CurrentVersion,
	}
	return c.JSON(http.StatusOK, resp)
}
