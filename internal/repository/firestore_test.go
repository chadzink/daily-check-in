package repository

import (
	"os"
	"testing"
)

func TestResolveFirestoreConfig_ProductionUsesADC(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("FIREBASE_PROJECT_ID", "dailycheckin-prod-1234")
	t.Setenv("FIRESTORE_EMULATOR_HOST", "")

	projectID, useEmulator := resolveFirestoreConfig("")
	if projectID != "dailycheckin-prod-1234" {
		t.Fatalf("expected projectID dailycheckin-prod-1234, got %q", projectID)
	}
	if useEmulator {
		t.Fatalf("expected useEmulator=false in production")
	}
	if got := os.Getenv("FIRESTORE_EMULATOR_HOST"); got != "" {
		t.Fatalf("expected FIRESTORE_EMULATOR_HOST to remain unset, got %q", got)
	}
}

func TestResolveFirestoreConfig_LocalDevDefaultsToEmulator(t *testing.T) {
	t.Setenv("APP_ENV", "development")
	t.Setenv("FIREBASE_PROJECT_ID", "")
	t.Setenv("PROJECT_ID", "")
	t.Setenv("GCP_PROJECT_ID", "")
	t.Setenv("FIRESTORE_EMULATOR_HOST", "")

	projectID, useEmulator := resolveFirestoreConfig("")
	if projectID != DefaultProjectID {
		t.Fatalf("expected default projectID %q, got %q", DefaultProjectID, projectID)
	}
	if !useEmulator {
		t.Fatalf("expected useEmulator=true in local dev")
	}
	if got := os.Getenv("FIRESTORE_EMULATOR_HOST"); got != DefaultEmulatorHost {
		t.Fatalf("expected FIRESTORE_EMULATOR_HOST=%q, got %q", DefaultEmulatorHost, got)
	}
}

func TestResolveFirestoreConfig_ExplicitEmulatorHost(t *testing.T) {
	t.Setenv("APP_ENV", "production")
	t.Setenv("FIRESTORE_EMULATOR_HOST", "localhost:8085")

	projectID, useEmulator := resolveFirestoreConfig("explicit-proj")
	if projectID != "explicit-proj" {
		t.Fatalf("expected explicit-proj, got %q", projectID)
	}
	if !useEmulator {
		t.Fatalf("expected useEmulator=true when FIRESTORE_EMULATOR_HOST is set")
	}
}
