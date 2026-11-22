package repository

import (
	"context"
	"fmt"
	"os"

	"cloud.google.com/go/firestore"
	"google.golang.org/api/option"
)

const (
	DefaultProjectID    = "dailycheckin-dev"
	DefaultEmulatorHost = "localhost:8085"
)

// resolveFirestoreConfig determines the target project ID and whether to use the
// local Firestore emulator. In production (APP_ENV=production) with no explicit
// FIRESTORE_EMULATOR_HOST, it avoids setting an emulator host so Google Cloud
// Application Default Credentials are used.
func resolveFirestoreConfig(projectID string) (resolvedProjectID string, useEmulator bool) {
	if projectID == "" {
		projectID = os.Getenv("FIREBASE_PROJECT_ID")
	}
	if projectID == "" {
		projectID = os.Getenv("PROJECT_ID")
	}
	if projectID == "" {
		projectID = os.Getenv("GCP_PROJECT_ID")
	}
	if projectID == "" {
		projectID = DefaultProjectID
	}

	emulatorHost := os.Getenv("FIRESTORE_EMULATOR_HOST")
	if emulatorHost == "" && os.Getenv("APP_ENV") != "production" {
		_ = os.Setenv("FIRESTORE_EMULATOR_HOST", DefaultEmulatorHost)
		emulatorHost = DefaultEmulatorHost
	}

	return projectID, emulatorHost != ""
}

// NewFirestoreClient initializes a Google Cloud Firestore client.
// When FIRESTORE_EMULATOR_HOST is set (or defaulted in non-production), it connects
// without authentication; in production it uses Application Default Credentials.
func NewFirestoreClient(ctx context.Context, projectID string) (*firestore.Client, error) {
	resolvedProjectID, useEmulator := resolveFirestoreConfig(projectID)

	var opts []option.ClientOption
	if useEmulator {
		opts = append(opts, option.WithoutAuthentication())
	}

	client, err := firestore.NewClient(ctx, resolvedProjectID, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create firestore client: %w", err)
	}

	return client, nil
}
