package repository

import (
	"context"
	"fmt"
	"os"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/option"
)

const (
	DefaultProjectID     = "dailycheckin-dev"
	DefaultEmulatorHost  = "localhost:8085"
)

// NewFirestoreClient initializes a Google Cloud Firestore client.
// It detects FIRESTORE_EMULATOR_HOST or defaults to localhost:8085 for local development.
func NewFirestoreClient(ctx context.Context, projectID string) (*firestore.Client, error) {
	if projectID == "" {
		projectID = os.Getenv("FIREBASE_PROJECT_ID")
		if projectID == "" {
			projectID = DefaultProjectID
		}
	}

	emulatorHost := os.Getenv("FIRESTORE_EMULATOR_HOST")
	if emulatorHost == "" {
		// Default to emulator in local dev if not explicitly set
		_ = os.Setenv("FIRESTORE_EMULATOR_HOST", DefaultEmulatorHost)
	}

	client, err := firestore.NewClient(ctx, projectID, option.WithoutAuthentication())
	if err != nil {
		return nil, fmt.Errorf("failed to create firestore client: %w", err)
	}

	return client, nil
}
