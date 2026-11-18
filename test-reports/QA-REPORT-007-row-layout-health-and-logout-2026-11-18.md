# QA Acceptance & Sign-Off Report: PLAN-007 Row-Based Board, Health Modal & Logout

- **Plan Reference:** [PLAN-007-row-layout-health-page-and-logout.md](../plans/PLAN-007-row-layout-health-page-and-logout.md)
- **Feature Name:** Row-Based Execution Board, System Health Modal & Firebase Auth Logout (Milestone 7)
- **Branch:** `phase-7-prepare-for-launch`
- **Execution Date:** 2026-11-18
- **Lead QA Engineer:** `@tester`
- **Collaborators:** `@devops-engineer`, `@developer`, `@ui-designer`, `@product-owner`
- **Sign-Off Status:** **CONDITIONALLY APPROVED (Unit, Integration, Build & API Auth Verified; Chrome Browser E2E Blocked by Missing Remote Debugging Port)**

---

## 1. Executive Summary

Milestone 7 refactors the DailyCheckIn UI and authentication flow:
1. **Row-Based Execution Board (`frontend/src/components/board/DailyBoard.tsx`, `ExecutionRow.tsx`):**
   - Replaced the 4-column grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) with a vertical stack of full-width horizontal rows (`flex flex-col gap-5`, `data-testid="daily-board-rows"`) for **Yesterday**, **Today**, **Blocked**, and **Backlog**.
2. **Removed Development Stage Markers (`frontend/src/App.tsx`):**
   - Removed `Milestone 6` header pill, `Milestone 6 • Single-Binary Packaging & Production Readiness` badge, and `Milestone 5: Interactive Calendar & Standup Export` footer label.
3. **System Health Popup Modal (`frontend/src/components/HealthModal.tsx`, `App.tsx`):**
   - Removed the header health pill, main-page offline banner, and 3-card connectivity grid from the main board.
   - Added `System Health` footer button (`data-testid="footer-health-link"`) opening `HealthModal` (`role="dialog"`, Escape/backdrop dismiss, Retry button, and 3 status cards).
4. **Full Firebase Auth & Logout (`frontend/src/firebase.ts`, `AuthContext.tsx`, `LoginPage.tsx`, `api/client.ts`, `cmd/server/main.go`, `Makefile`):**
   - Added `firebase/auth` integration connecting to the local Auth Emulator (`localhost:9099`, project `dailycheckin-local`).
   - Added `make seed-demo-user` to idempotently provision `demo@dailycheckin.com` / `Password123!`.
   - Wired `*firebaseAuth.Client` in `cmd/server/main.go` and verified live `Authorization: Bearer <idToken>` validation returning the real Firebase UID (`AwP1z4uRnj9fPFdQMSC0nRYLyt4b`).
   - Added Header **Logout** button (`data-testid="logout-button"`) clearing session and TanStack Query cache.

---

## 2. Automated Test & Build Verification

| Suite / Check | Command | Scope | Result |
| :--- | :--- | :--- | :--- |
| **Go Backend Tests** | `FIRESTORE_EMULATOR_HOST=localhost:8085 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 go test ./...` | `cmd/server`, `internal/api`, `internal/middleware`, `internal/repository`, `internal/service` | **PASS** (all 5 packages passed) |
| **Frontend Vitest Suite** | `cd frontend && npm test` | 9 test files (`App.test.tsx`, `DailyBoard.test.tsx`, `TaskCard.test.tsx`, `CalendarWidget.test.tsx`, `HistoricalDateBanner.test.tsx`, `StandupExportModal.test.tsx`, `CheckOutModal.test.tsx`, `MorningCheckInModal.test.tsx`, `standupGenerator.test.ts`) | **PASS** (25 / 25 tests passed) |
| **Frontend Production Build** | `cd frontend && npm run build` | Strict `tsc && vite build` | **PASS** (0 TS errors; `dist/` built) |
| **Single-Binary Build** | `go build -o bin/dailycheckin ./cmd/server` | Embedded SPA + Go backend | **PASS** (`bin/dailycheckin` built) |
| **Demo User Seed** | `make seed-demo-user` | Firebase Auth Emulator `:9099` (`demo@dailycheckin.com`) | **PASS** |
| **Live API + JWT Verification** | `curl` with `demo@dailycheckin.com` ID token against `./bin/dailycheckin` (`:8081`) | `GET /api/health`, `GET /api/days/2026-11-18`, `GET /api/backlog`, `GET /` | **PASS** (returned real UID `AwP1z4uRnj9fPFdQMSC0nRYLyt4b`) |
| **Chrome Browser E2E** | `@browser` subagent on `http://localhost:8081` | Live visual layout & interactive browser clicks | **BLOCKED** (`DevToolsActivePort` not found — Chrome remote debugging not enabled) |

---

## 3. Gherkin Acceptance Criteria Status

| Scenario | Description | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Scenario 1** | Row-Based Execution Board Layout (`flex-col` stack for Yesterday -> Today -> Blocked -> Backlog) | Vitest (`App.test.tsx`, `DailyBoard.test.tsx`) | **PASS (Unit); Pending Live Visual E2E** |
| **Scenario 2** | Removal of Development Stage Markers (`Milestone 5`, `Milestone 6`) | Vitest (`App.test.tsx`) | **PASS** |
| **Scenario 3** | Status Indicators Moved to `HealthModal` with Footer Link | Vitest (`App.test.tsx`) | **PASS** |
| **Scenario 4** | User Logout and Re-Login Flow (`demo@dailycheckin.com` / `Password123!`) | Vitest (`App.test.tsx`) + Live Auth Emulator & Backend JWT Check | **PASS (Unit + API); Pending Live Browser E2E** |
| **Scenario 5** | Edge Case — Backend Offline Banner & Retry in `HealthModal` | Vitest (`App.test.tsx`) | **PASS** |
