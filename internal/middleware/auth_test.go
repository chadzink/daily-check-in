package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestFirebaseAuthMiddleware_DevUserHeader(t *testing.T) {
	e := echo.New()
	mw := middleware.FirebaseAuthMiddleware(nil)

	handler := mw(func(c echo.Context) error {
		userID := middleware.GetUserID(c)
		return c.String(http.StatusOK, userID)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set("X-User-ID", "custom-tenant-user-99")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler(c)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "custom-tenant-user-99", rec.Body.String())
}

func TestFirebaseAuthMiddleware_BearerFallback(t *testing.T) {
	e := echo.New()
	mw := middleware.FirebaseAuthMiddleware(nil)

	handler := mw(func(c echo.Context) error {
		userID := middleware.GetUserID(c)
		return c.String(http.StatusOK, userID)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/test", nil)
	req.Header.Set(echo.HeaderAuthorization, "Bearer simulated-jwt-uid-abc")
	rec := httptest.NewRecorder()
	c := e.NewContext(req, rec)

	err := handler(c)
	assert.NoError(t, err)
	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "simulated-jwt-uid-abc", rec.Body.String())
}
