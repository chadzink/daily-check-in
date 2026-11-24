# QA Sign-Off Report: PLAN-012 — Completed Tasks Cleanup, Reports, CSV Export & List Ordering

- **Plan Reference:** `plans/PLAN-012-completed-reports-csv-and-ordering.md`
- **Branch:** `feat/PLAN-012-completed-reports-csv-and-ordering`
- **Date:** 2026-11-24
- **QA Engineer:** `@tester`
- **Status:** **APPROVED (Automated Suites & Production Build Passed)**

---

## 1. Test Execution Summary

| Suite | Command | Scope | Result |
| :--- | :--- | :--- | :--- |
| Frontend Typecheck | `cd frontend && npx tsc --noEmit` | Strict TypeScript compilation | **PASS** |
| Frontend Unit & Component Tests | `cd frontend && npm test -- --run` | 13 test files, 38 tests (Vitest + RTL) | **PASS (38/38)** |
| Frontend Production Bundle | `cd frontend && npm run build` | Vite bundle (`dist/`) | **PASS** |
| Go Format & Vet | `gofmt -l internal/ cmd/` & `go vet ./...` | Formatting & static analysis | **PASS** |
| Go Unit & Emulator Integration | `FIRESTORE_EMULATOR_HOST=localhost:8085 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 go test -v ./...` | `cmd/server`, `internal/api`, `internal/middleware`, `internal/repository`, `internal/service` | **PASS (All packages)** |
| Single-Binary Embed Build | `go build -o bin/dailycheckin ./cmd/server` | Go binary with embedded `frontend/dist` | **PASS** |

---

## 2. Acceptance Criteria Verification

- **Story 1 (Exclude Completed Tasks from Backlog):**
  - `internal/repository/task_repo.go` (`ListBacklog`) filters `is_completed == false` using existing composite index in `firestore.indexes.json`.
  - Verified by `TestPlan012_BacklogExcludesCompletedAndTopInsertion` and `TestScenario1_MasterTaskCRUD`.
- **Story 2 (Completed Tasks Report with Date Range Filter):**
  - `internal/service/report_service.go` and `internal/api/reports.go` (`GET /api/reports/completed`) implemented and verified by `TestPlan012_ReportServiceCompletedTasksDateRange`.
  - `frontend/src/components/reports/ReportsModal.tsx` wired to top-bar `Reports` button in `App.tsx`, defaulting to Last 7 Days with date-range inputs and presets; verified by `ReportsModal.test.tsx`.
- **Story 3 (CSV Export):**
  - `frontend/src/utils/csvExport.ts` exports all 12 task/day-task fields with RFC 4180 escaping; verified by `csvExport.test.ts` and `ReportsModal.test.tsx`.
- **Story 4 (New Tasks Added to Top of List):**
  - `internal/service/task_service.go` (`CreateTask`) inserts new Backlog and DaySession tasks at position `1` and shifts existing items down; verified by `TestPlan012_BacklogExcludesCompletedAndTopInsertion`.
- **Story 5 (Move Item to Specific Index):**
  - `TaskCard.tsx` `#N` rank badge opens an inline numeric input (`1..totalCount`) wired to `DailyBoard.tsx` (`moveItemToIndex`); verified by `TaskCard.test.tsx`.

---

## 3. Notes

- Interactive `/browser` E2E was not executed in this pass; all UI and API behaviors are covered by Vitest/RTL and Go Firestore Emulator integration tests.
