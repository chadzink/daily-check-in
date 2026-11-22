# PLAN-010: Fix Production Firestore Client Initialization (`APP_ENV=production`)

- **Branch / Fix Reference:** `fix/PLAN-010-firestore-production-client`
- **Document Reference:** `plans/PLAN-010-firestore-production-client.md`
- **Lead Agent:** `@developer`
- **Collaborating Agents:** `@product-owner`, `@tester`, `@devops-engineer`
- **Status:** **Implemented & Verified**

---

## 1. Bug Overview & Root Cause

### 1.1 Problem Statement & User Impact
*As a user signing into the deployed Cloud Run production app, I want the backend to connect to Google Cloud Firestore using Application Default Credentials rather than `localhost:8085`, so that `/api/days/:date`, `/api/backlog`, and `/api/calendar/summary` respond immediately instead of hanging on `"Loading execution board & backlog..."`.*

### 1.2 Root Cause Analysis
In `internal/repository/firestore.go`, `NewFirestoreClient` previously:
1. Unconditionally set `FIRESTORE_EMULATOR_HOST="localhost:8085"` whenever `FIRESTORE_EMULATOR_HOST` was empty — including in production (`APP_ENV=production`) where `FIRESTORE_EMULATOR_HOST` is intentionally unset.
2. Unconditionally passed `option.WithoutAuthentication()` to `firestore.NewClient(...)`.

As a result, every Firestore-backed API endpoint in Cloud Run attempted to connect to a non-existent emulator on `localhost:8085` and hung indefinitely.

---

## 2. Architecture & Implementation Plan

1. **Production vs. Emulator Resolution (`internal/repository/firestore.go`):**
   - Resolve `projectID` from argument $\rightarrow$ `FIREBASE_PROJECT_ID` $\rightarrow$ `PROJECT_ID` $\rightarrow$ `GCP_PROJECT_ID` $\rightarrow$ `DefaultProjectID`.
   - Only default `FIRESTORE_EMULATOR_HOST` to `localhost:8085` when `FIRESTORE_EMULATOR_HOST == ""` **and** `APP_ENV != "production"`.
   - Only pass `option.WithoutAuthentication()` when `FIRESTORE_EMULATOR_HOST != ""`; otherwise call `firestore.NewClient(ctx, projectID)` so Cloud Run uses Application Default Credentials (the `dailycheckin-runtime` service account).
2. **Unit Tests (`internal/repository/firestore_test.go`):**
   - Verify `APP_ENV=production` with `FIRESTORE_EMULATOR_HOST` unset resolves to production mode (`useEmulator = false`) and does **not** mutate `FIRESTORE_EMULATOR_HOST`.
   - Verify local dev mode (neither set) defaults `FIRESTORE_EMULATOR_HOST` to `localhost:8085` (`useEmulator = true`).
   - Verify explicit `FIRESTORE_EMULATOR_HOST` preserves emulator mode (`useEmulator = true`).
3. **Documentation Updates:**
   - Update `docs/DEPLOYMENT.md` runtime environment table to document how `APP_ENV=production` + unset `FIRESTORE_EMULATOR_HOST` activates Cloud Firestore ADC.
   - Update `plans/ROADMAP.md` with Fix 10 (`PLAN-010`).

---

## 3. Acceptance Criteria (Gherkin Scenarios)

- **Scenario 1: Production Cloud Run Mode**
  - **Given:** `APP_ENV=production`, `FIREBASE_PROJECT_ID=dailycheckin-prod`, and `FIRESTORE_EMULATOR_HOST` is unset.
  - **When:** `NewFirestoreClient` resolves Firestore configuration.
  - **Then:** `FIRESTORE_EMULATOR_HOST` remains unset, `useEmulator` is `false`, `projectID` is `dailycheckin-prod`, and `firestore.NewClient` uses Application Default Credentials without `option.WithoutAuthentication()`.

- **Scenario 2: Local Development Emulator Fallback**
  - **Given:** `APP_ENV` is unset (or `development`) and `FIRESTORE_EMULATOR_HOST` is unset.
  - **When:** `NewFirestoreClient` resolves Firestore configuration.
  - **Then:** `FIRESTORE_EMULATOR_HOST` defaults to `localhost:8085` and `useEmulator` is `true` with `option.WithoutAuthentication()`.

- **Scenario 3: Explicit Emulator Override**
  - **Given:** `FIRESTORE_EMULATOR_HOST=localhost:8085` is set (e.g., CI or Docker Compose).
  - **When:** `NewFirestoreClient` resolves Firestore configuration.
  - **Then:** `useEmulator` is `true` and the explicit host is preserved.

---

## 4. Definition of Done Checklist

- [x] `internal/repository/firestore.go` fixed to use Cloud Firestore ADC in production.
- [x] `internal/repository/firestore_test.go` added and passing (`go test -v ./internal/repository/...`).
- [x] `gofmt`, `go vet ./...`, `go build ./cmd/server` pass.
- [x] `docs/DEPLOYMENT.md` and `plans/ROADMAP.md` updated.
- [x] QA report archived in `test-reports/QA-REPORT-010-firestore-production-client-2026-11-22.md`.
