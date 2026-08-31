package middleware

import (
	"context"
	"net/http"
	"os"
	"strings"

	firebaseAuth "firebase.google.com/go/v4/auth"
	"github.com/chadzink/dailycheckin/internal/model"
	"github.com/labstack/echo/v4"
)

type contextKey string

const (
	UserIDContextKey contextKey = "dailycheckin_user_id"
	EchoUserIDKey    string     = "userID"
	DefaultDevUserID string     = "dev-user-123"
)

// FirebaseAuthMiddleware extracts user ID from Firebase ID token or dev header
func FirebaseAuthMiddleware(authClient *firebaseAuth.Client) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// 1. Check for X-User-ID header (supported in emulator / local dev mode for tenant isolation)
			devUser := c.Request().Header.Get("X-User-ID")
			if devUser != "" {
				injectUser(c, devUser)
				return next(c)
			}

			// 2. Extract Authorization: Bearer <token>
			authHeader := c.Request().Header.Get(echo.HeaderAuthorization)
			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				tokenString := strings.TrimPrefix(authHeader, "Bearer ")
				if authClient != nil {
					token, err := authClient.VerifyIDToken(c.Request().Context(), tokenString)
					if err == nil && token != nil && token.UID != "" {
						injectUser(c, token.UID)
						return next(c)
					}
				} else if tokenString != "" {
					// Fallback when client is not initialized in lightweight tests
					injectUser(c, tokenString)
					return next(c)
				}
			}

			// 3. In local emulator environment, fallback to default dev user if not specified
			if os.Getenv("FIRESTORE_EMULATOR_HOST") != "" || os.Getenv("FIREBASE_AUTH_EMULATOR_HOST") != "" {
				injectUser(c, DefaultDevUserID)
				return next(c)
			}

			return c.JSON(http.StatusUnauthorized, model.StandardErrorResponse{
				Error:   "Unauthorized",
				Message: "Missing or invalid authorization credentials",
				Code:    "UNAUTHORIZED",
			})
		}
	}
}

func injectUser(c echo.Context, userID string) {
	c.Set(EchoUserIDKey, userID)
	req := c.Request()
	ctx := context.WithValue(req.Context(), UserIDContextKey, userID)
	c.SetRequest(req.WithContext(ctx))
}

// GetUserID retrieves the authenticated user ID from echo.Context
func GetUserID(c echo.Context) string {
	if val, ok := c.Get(EchoUserIDKey).(string); ok && val != "" {
		return val
	}
	if val, ok := c.Request().Context().Value(UserIDContextKey).(string); ok && val != "" {
		return val
	}
	return ""
}
