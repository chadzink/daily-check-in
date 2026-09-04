package main_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	main "github.com/chadzink/dailycheckin/cmd/server"
	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func setupTestServer() (*echo.Echo, fstest.MapFS) {
	e := echo.New()

	mockFS := fstest.MapFS{
		"index.html": &fstest.MapFile{
			Data: []byte("<!DOCTYPE html><html><body>DailyCheckIn SPA Root</body></html>"),
		},
		"assets/index-mock.js": &fstest.MapFile{
			Data: []byte("console.log('DailyCheckIn Bundled Assets');"),
		},
		"favicon.ico": &fstest.MapFile{
			Data: []byte("mock-icon-bytes"),
		},
	}

	// Register API route to verify non-interception
	e.GET("/api/health", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})

	main.SetupStaticRoutes(e, mockFS)
	return e, mockFS
}

func TestStaticRouting_RootIndex(t *testing.T) {
	e, _ := setupTestServer()

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get(echo.HeaderContentType), "text/html")
	assert.Equal(t, "no-cache", rec.Header().Get(echo.HeaderCacheControl))
	assert.Contains(t, rec.Body.String(), "DailyCheckIn SPA Root")
}

func TestStaticRouting_SPAFallback(t *testing.T) {
	e, _ := setupTestServer()

	// Client-side routes like /calendar or /history should fall back to index.html
	testRoutes := []string{"/calendar", "/settings", "/history/2026-09-04"}

	for _, route := range testRoutes {
		req := httptest.NewRequest(http.MethodGet, route, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code, "route: "+route)
		assert.Contains(t, rec.Header().Get(echo.HeaderContentType), "text/html")
		assert.Equal(t, "no-cache", rec.Header().Get(echo.HeaderCacheControl))
		assert.Contains(t, rec.Body.String(), "DailyCheckIn SPA Root")
	}
}

func TestStaticRouting_AssetsCachingHeaders(t *testing.T) {
	e, _ := setupTestServer()

	req := httptest.NewRequest(http.MethodGet, "/assets/index-mock.js", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "public, max-age=31536000, immutable", rec.Header().Get(echo.HeaderCacheControl))
	assert.Contains(t, rec.Body.String(), "DailyCheckIn Bundled Assets")
}

func TestStaticRouting_ApiRouteNonInterception(t *testing.T) {
	e, _ := setupTestServer()

	// API route that exists
	req := httptest.NewRequest(http.MethodGet, "/api/health", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get(echo.HeaderContentType), "application/json")
	assert.Contains(t, rec.Body.String(), `{"status":"ok"}`)

	// API route that does not exist should return 404, not fallback to index.html
	req404 := httptest.NewRequest(http.MethodGet, "/api/unmapped-endpoint", nil)
	rec404 := httptest.NewRecorder()
	e.ServeHTTP(rec404, req404)

	assert.Equal(t, http.StatusNotFound, rec404.Code)
	assert.NotContains(t, rec404.Body.String(), "DailyCheckIn SPA Root")
}

func TestStaticRouting_HeadRequests(t *testing.T) {
	e, _ := setupTestServer()

	// HEAD /
	req := httptest.NewRequest(http.MethodHead, "/", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get(echo.HeaderContentType), "text/html")
	assert.Equal(t, "no-cache", rec.Header().Get(echo.HeaderCacheControl))
	assert.Empty(t, rec.Body.String()) // Body must be empty for HEAD

	// HEAD /assets/index-mock.js
	reqAsset := httptest.NewRequest(http.MethodHead, "/assets/index-mock.js", nil)
	recAsset := httptest.NewRecorder()
	e.ServeHTTP(recAsset, reqAsset)

	assert.Equal(t, http.StatusOK, recAsset.Code)
	assert.Equal(t, "public, max-age=31536000, immutable", recAsset.Header().Get(echo.HeaderCacheControl))
}
