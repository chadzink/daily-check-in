package main

import (
	"context"
	"errors"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	firebase "firebase.google.com/go/v4"
	firebaseAuth "firebase.google.com/go/v4/auth"
	"github.com/chadzink/dailycheckin"
	"github.com/chadzink/dailycheckin/internal/api"
	"github.com/chadzink/dailycheckin/internal/middleware"
	"github.com/chadzink/dailycheckin/internal/repository"
	"github.com/chadzink/dailycheckin/internal/service"
	"github.com/labstack/echo/v4"
)

func main() {
	e := echo.New()
	e.HideBanner = true

	// Configure standard middleware
	middleware.SetupMiddlewares(e)

	// Context for initialization
	initCtx, initCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer initCancel()

	// Initialize Firestore Client
	firestoreClient, err := repository.NewFirestoreClient(initCtx, "")
	if err != nil {
		e.Logger.Fatalf("Failed to initialize Firestore client: %v", err)
	}
	defer firestoreClient.Close()

	// Initialize Firebase Auth Client
	projectID := os.Getenv("FIREBASE_PROJECT_ID")
	if projectID == "" {
		projectID = os.Getenv("PROJECT_ID")
	}
	if projectID == "" {
		if os.Getenv("FIREBASE_AUTH_EMULATOR_HOST") != "" {
			projectID = "dailycheckin-local"
		} else {
			projectID = repository.DefaultProjectID
		}
	}
	var authClient *firebaseAuth.Client
	if fbApp, fbErr := firebase.NewApp(initCtx, &firebase.Config{ProjectID: projectID}); fbErr != nil {
		e.Logger.Warnf("Failed to initialize Firebase app for auth: %v", fbErr)
	} else if client, authErr := fbApp.Auth(initCtx); authErr != nil {
		e.Logger.Warnf("Failed to initialize Firebase Auth client: %v", authErr)
	} else {
		authClient = client
	}

	// Initialize Repositories
	taskRepo := repository.NewTaskRepository(firestoreClient)
	daySessionRepo := repository.NewDaySessionRepository(firestoreClient)
	dayTaskRepo := repository.NewDayTaskRepository(firestoreClient)

	// Initialize Services
	taskService := service.NewTaskService(taskRepo, daySessionRepo, dayTaskRepo)
	daySessionService := service.NewDaySessionService(daySessionRepo, dayTaskRepo, taskRepo)
	ritualService := service.NewRitualService(daySessionRepo, dayTaskRepo, taskRepo, daySessionService)
	calendarService := service.NewCalendarService(daySessionRepo, dayTaskRepo)

	// API route registration
	apiGroup := e.Group("/api")
	apiGroup.Match([]string{http.MethodGet, http.MethodHead}, "/health", api.HealthCheckHandler)

	// Authenticated API routes
	authGroup := apiGroup.Group("")
	authGroup.Use(middleware.FirebaseAuthMiddleware(authClient))

	// Register domain handlers
	backlogHandler := api.NewBacklogHandler(taskService)
	backlogHandler.RegisterRoutes(authGroup)

	tasksHandler := api.NewTasksHandler(taskService)
	tasksHandler.RegisterRoutes(authGroup)

	daysHandler := api.NewDaysHandler(daySessionService)
	daysHandler.RegisterRoutes(authGroup)

	ritualHandler := api.NewRitualHandler(ritualService)
	ritualHandler.RegisterRoutes(authGroup)

	calendarHandler := api.NewCalendarHandler(calendarService)
	calendarHandler.RegisterRoutes(authGroup)

	// Static asset routing (serving embedded frontend SPA)
	SetupStaticRoutes(e, dailycheckin.DistFS())

	// Resolve server port
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Graceful shutdown channel
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Start server in goroutine
	go func() {
		e.Logger.Infof("DailyCheckIn server listening on :%s", port)
		if err := e.Start(":" + port); err != nil && !errors.Is(err, http.ErrServerClosed) {
			e.Logger.Fatalf("Server shutdown with error: %v", err)
		}
	}()

	// Wait for interrupt signal
	<-ctx.Done()
	e.Logger.Info("Shutting down server gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := e.Shutdown(shutdownCtx); err != nil {
		e.Logger.Errorf("Server forced to shutdown: %v", err)
	}

	e.Logger.Info("Server stopped.")
}

// SetupStaticRoutes wires static asset file server and SPA fallback routing.
func SetupStaticRoutes(e *echo.Echo, distFS fs.FS) {
	fileServer := http.FileServer(http.FS(distFS))

	staticHandler := func(c echo.Context) error {
		reqPath := c.Request().URL.Path

		// Do not intercept /api routes
		if strings.HasPrefix(reqPath, "/api") {
			return echo.ErrNotFound
		}

		cleanPath := strings.TrimPrefix(reqPath, "/")
		if cleanPath == "" {
			cleanPath = "index.html"
		}

		// Check if file exists in embedded filesystem
		file, err := distFS.Open(cleanPath)
		if err == nil {
			stat, statErr := file.Stat()
			_ = file.Close()
			if statErr == nil && !stat.IsDir() {
				if strings.HasPrefix(cleanPath, "assets/") {
					c.Response().Header().Set(echo.HeaderCacheControl, "public, max-age=31536000, immutable")
				} else if cleanPath == "index.html" {
					c.Response().Header().Set(echo.HeaderCacheControl, "no-cache")
				}
				fileServer.ServeHTTP(c.Response(), c.Request())
				return nil
			}
		}

		// Fallback to index.html for SPA routes
		indexFile, err := distFS.Open("index.html")
		if err != nil {
			return c.String(http.StatusOK, "DailyCheckIn SPA (dist/index.html not found)")
		}
		defer indexFile.Close()

		c.Response().Header().Set(echo.HeaderContentType, echo.MIMETextHTMLCharsetUTF8)
		c.Response().Header().Set(echo.HeaderCacheControl, "no-cache")
		c.Response().WriteHeader(http.StatusOK)
		if c.Request().Method != http.MethodHead {
			_, err = io.Copy(c.Response(), indexFile)
			return err
		}
		return nil
	}

	e.GET("/*", staticHandler)
	e.HEAD("/*", staticHandler)
}
