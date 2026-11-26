# QA Sign-Off Report: PLAN-015 — Board Fixes, Future-Date Rescheduling, Blocked Rollover & Inline Sub-tasks

- **Plan Reference:** `plans/PLAN-015-board-fixes-rescheduling-and-subtasks.md`
- **Branch:** `feat/PLAN-015-board-fixes-rescheduling-and-subtasks`
- **Date:** 2026-11-26
- **QA Engineer:** `@tester`
- **Status:** **APPROVED (Automated Suites, Emulator Integration & Production Build Passed)**

---

## 1. Test Execution Summary

| Suite | Command | Scope | Result |
| :--- | :--- | :--- | :--- |
| Frontend Typecheck & Production Bundle | `cd frontend && npm run build` (`tsc && vite build`) | Strict TypeScript compilation + Vite bundle (`frontend/dist/`) | **PASS** |
| Frontend Unit & Component Tests | `cd frontend && npm test -- --run` | 16 test files, 59 tests (Vitest + RTL) | **PASS (59/59)** |
| Go Format & Vet | `gofmt -l internal/ cmd/` & `go vet ./...` | Formatting & static analysis | **PASS** |
| Go Unit & Emulator Integration | `FIRESTORE_EMULATOR_HOST=localhost:8085 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 go test -v ./...` | `cmd/server`, `internal/api`, `internal/middleware`, `internal/repository`, `internal/service` (44 tests incl. 9 new PLAN-015 tests + Item 3 TDD regression) | **PASS (44/44)** |
| Single-Binary Embed Build | `go build -o bin/dailycheckin ./cmd/server` | Go binary with embedded `frontend/dist` (`bin/dailycheckin`) | **PASS** |

---

## 2. Acceptance Criteria Verification Matrix

| Scenario | Description | Verification Source | Status |
| :--- | :--- | :--- | :--- |
| **Scenario 1 (Item 1)** | Past-day Backlog pull disabled (`Pull` button disabled + tooltip, `P` shortcut suppressed + muted hint, backend `POST /api/days/:date/pull` rejects `date < today_date` with `400`) while Backlog remains addable, editable, reorderable, and deletable on past dates | `internal/service/plan015_test.go`, `frontend/src/components/board/DailyBoard.test.tsx`, `frontend/src/components/board/TaskCard.test.tsx` | **PASS** |
| **Scenario 2 (Item 2)** | Move Today, Blocked, or Backlog task to a future date via `EditTaskModal` (`POST /api/tasks/:id/move`); Blocked tasks retain `BLOCKED` status & `blocker_reason`; rejects today/past/same-date moves with validation + `400` | `internal/service/plan015_test.go`, `frontend/src/components/board/EditTaskModal.test.tsx` | **PASS** |
| **Scenario 3 (Item 3 — TDD Regression)** | Deleted (archived) tasks excluded from both Morning Check-In Step 1 (`yesterday_tasks`) and Step 2 (`rollover_candidates`); verified **Red → Green** with failing test written before fix and retained permanently | `internal/service/ritual_service_test.go` (`TestRitualService_ExcludesArchivedTasksFromMorningCheckIn`) | **PASS** |
| **Scenario 4 (Item 4)** | Blocked tasks in Morning Check-In Step 2 show amber badge & read-only `blocker_reason`, default to `KEEP_BLOCKED`, skip Step 4 prioritization, and land in today's Blocked row preserving `blocker_reason` (while `ROLLOVER` unblocks to Today) | `internal/service/ritual_service_test.go`, `frontend/src/components/wizards/MorningCheckInModal.test.tsx` | **PASS** |
| **Scenario 5 (Item 5)** | Tasks unfinished in Today or any future date session (`date >= today`) excluded from Global Backlog across past, current, and future dates (`GET /api/backlog?today=YYYY-MM-DD`) and Step 3 Check-In backlog; demoting restores to Backlog | `internal/service/plan015_test.go`, `internal/api/api_test.go` | **PASS** |
| **Scenario 6 (Item 6)** | Inline title-only sub-tasks expanded by default on `TaskCard` with progress badge, inline add/edit/delete/toggle, one-way parent-to-subtask completion cascade (no reverse auto-complete, no uncheck cascade), read-only rendering on Yesterday/past dates, and 2-space indented bullets in Standup Markdown Export | `internal/service/plan015_test.go`, `frontend/src/components/board/TaskCard.test.tsx`, `frontend/src/utils/standupGenerator.test.ts`, `frontend/src/components/standup/StandupExportModal.test.tsx` | **PASS** |

---

## 3. Privacy & Path Hygiene Audit
- [x] All paths referenced in this report and in `test-results/backend-test.log` / `test-results/frontend-test.log` are strictly project-relative (0 `/Users/...` or `/home/...` matches).
- [x] Zero personal identifiers, credentials, or auth tokens are present in test artifacts.

---

## 4. Notes
- Backend tests ran live against the local Firebase Emulators (`localhost:8085` Firestore, `localhost:9099` Auth) with zero new composite indexes required in `firestore.indexes.json`.
- Interactive `/browser` E2E was not executed in this pass; all UI flows, keyboard shortcuts, modal validations, and Standup export formatting were verified via Vitest + React Testing Library.
