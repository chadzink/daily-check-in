# QA Sign-Off Report: PLAN-014 — Yesterday Accomplishments Fix, Collapsible Execution Rows & Board Row Reorder

- **Plan Reference:** `plans/PLAN-014-yesterday-fix-collapsible-rows-and-reorder.md`
- **Branch:** `feat/PLAN-014-yesterday-fix-collapsible-rows-and-reorder`
- **Date:** 2026-11-25
- **QA Engineer:** `@tester`
- **Status:** **APPROVED (Automated Suites & Production Build Passed)**

---

## 1. Test Execution Summary

| Suite | Command | Scope | Result |
| :--- | :--- | :--- | :--- |
| Frontend Typecheck & Production Bundle | `cd frontend && npm run build` (`tsc && vite build`) | Strict TypeScript compilation + Vite bundle (`frontend/dist/`) | **PASS** |
| Frontend Unit & Component Tests | `cd frontend && npm test -- --run` | 15 test files, 49 tests (Vitest + RTL) | **PASS (49/49)** |
| Go Format & Vet | `gofmt -l internal/` & `go vet ./...` | Formatting & static analysis | **PASS** |
| Go Unit & Emulator Integration | `FIRESTORE_EMULATOR_HOST=localhost:8085 go test -v ./...` | `cmd/server`, `internal/api`, `internal/middleware`, `internal/repository`, `internal/service` (34+ tests incl. 5 new PLAN-014 regression tests) | **PASS (All packages)** |
| Single-Binary Embed Build | `go build -o bin/dailycheckin ./cmd/server` | Go binary with embedded `frontend/dist` | **PASS** |

---

## 2. Acceptance Criteria Verification Matrix

| Scenario | Description | Verification Source | Status |
| :--- | :--- | :--- | :--- |
| **Scenario 1** | Multi-day check-in non-accumulation regression (Day 3 shows only Day 2's completed task, never Day 1's; no `StatusYesterday` docs persisted) | `internal/service/ritual_test.go` (`TestRitualService_YesterdayDoesNotAccumulateAcrossDays`) | **PASS** |
| **Scenario 2** | Skipping prior days with zero completions (`yesterday_date` points to Monday while `rollover_candidates` still pulls Tuesday's incomplete task; UI shows `Mon, Nov 23` hint) | `internal/service/ritual_test.go` (`TestRitualService_YesterdaySkipsDaysWithNoCompletions`), `frontend/src/utils/dateLabels.test.ts`, `frontend/src/components/board/DailyBoard.test.tsx` | **PASS** |
| **Scenario 3** | Legacy `StatusYesterday` immunity across Daily Board, Completed Tasks Report, and Calendar Summary + `RolloverCompleted` updating prior day | `internal/service/ritual_test.go` (`TestYesterday_LegacyStatusYesterdayIgnoredAcrossBoardReportsAndCalendar`, `TestRitualService_RolloverCompletedUpdatesPriorDayAndAppearsInYesterday`, `TestYesterday_EmptyWhenNoPriorCompletions`) | **PASS** |
| **Scenario 4** | Collapsible execution rows (`aria-expanded`, hiding task lists & Quick Add, `localStorage` persistence across remount/reload, `B` shortcut auto-expand & focus) | `frontend/src/components/board/DailyBoard.test.tsx` | **PASS** |
| **Scenario 5** | Board row DOM order (`Today → Yesterday → Blocked → Backlog`) while preserving classic Scrum order (`Yesterday → Today → Blocked`) in Standup Export | `frontend/src/components/board/DailyBoard.test.tsx`, `frontend/src/utils/standupGenerator.test.ts`, `frontend/src/components/standup/StandupExportModal.test.tsx` | **PASS** |

---

## 3. Privacy & Path Hygiene Audit
- [x] All paths referenced in this report are strictly project-relative (no `/Users/...` or `/home/...` paths).
- [x] Zero personal identifiers, credentials, or auth tokens are present in test artifacts.

---

## 4. Notes
- Interactive `/browser` E2E was not executed in this pass; all backend multi-day persistence scenarios ran live against the local Firestore Emulator (`localhost:8085`) and all UI interaction, persistence, and shortcut flows were verified via Vitest + React Testing Library.
