# PLAN-012: Completed Tasks Cleanup, Date-Range Reports, CSV Export & List Ordering

- **Branch Reference:** `feat/PLAN-012-completed-reports-csv-and-ordering`
- **Document Reference:** `plans/PLAN-012-completed-reports-csv-and-ordering.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@ui-designer`, `@devops-engineer`, `@developer`, `@tester`
- **Status:** **Implemented & Verified (Pending Sprint Review Sign-Off)**

---

## 1. Overview & User Stories

1. **Story 1 (Bug — P0):** *As a user, I want completed tasks to be excluded from the Global Backlog and remain visible on the day they were completed, so that my Backlog only contains pending work.*
2. **Story 2 (Feature — P1):** *As a user, I want a Completed Tasks Report modal accessible from the top navigation bar with a date-range filter (defaulting to the last 7 days), so that I can review all tasks completed within any timeframe.*
3. **Story 3 (Feature — P1):** *As a user, I want to export the filtered Completed Tasks Report to a CSV file containing all available task fields, so that I can analyze or share my accomplishments externally.*
4. **Story 4 (UX — P1):** *As a user, I want newly added tasks in Today, Blocked, or Backlog to appear at the top of the list (`#1`) while shifting existing tasks down, so that new urgent work is immediately prioritized.*
5. **Story 5 (UX — P1):** *As a user, I want to click a task's `#N` position badge to move it directly to a specific 1-based index in the list (alongside Up/Down arrows), so that I can reprioritize long lists without repeated clicks.*

---

## 2. Architecture & Data Model Impacts

### 2.1 Story 1: Backlog Filtering
- `internal/repository/task_repo.go` (`ListBacklog`): Add `.Where("is_completed", "==", false)` to the Firestore query. Uses the existing composite index (`is_archived` ASC, `is_completed` ASC, `backlog_order` ASC) in `firestore.indexes.json`.
- `frontend/src/components/board/DailyBoard.tsx`: Keep defensive `!t.is_completed` filter on `uncommittedBacklogTasks`.

### 2.2 Story 2 & 3: Completed Tasks Report API & CSV Export
- **Models (`internal/model/domain.go`):**
  - `CompletedTaskReportItem`: `day_task_id`, `task_id`, `date`, `title`, `description`, `status`, `is_completed`, `completed_at`, `priority_order`, `blocker_reason`, `created_at`, `updated_at`.
  - `CompletedTasksReportResponse`: `start_date`, `end_date`, `total_count`, `tasks: []CompletedTaskReportItem`.
- **Service (`internal/service/report_service.go`):**
  - `GetCompletedTasksReport(ctx, userID, startDate, endDate)`: Validates `YYYY-MM-DD` dates (`startDate <= endDate`), queries `daySessionRepo.ListByDateRange`, fetches `dayTaskRepo.ListByDate` concurrently, batch-fetches master `Task`s via `taskRepo.GetByIDs`, filters `dt.IsCompleted == true`, and sorts by `date` DESC, `completed_at` DESC.
- **API (`internal/api/reports.go`):**
  - `GET /api/reports/completed?start=YYYY-MM-DD&end=YYYY-MM-DD` (defaults to last 7 days if query params omitted).
- **Frontend:**
  - `frontend/src/api/tasks.ts` & `frontend/src/hooks/useBoard.ts`: `fetchCompletedTasksReport` and `useCompletedTasksReport`.
  - `frontend/src/utils/csvExport.ts`: RFC 4180 CSV serializer & browser download trigger exporting all fields (`date,day_task_id,task_id,title,description,status,is_completed,completed_at,priority_order,blocker_reason,created_at,updated_at`).
  - `frontend/src/components/reports/ReportsModal.tsx`: Modal triggered from top navigation bar in `App.tsx`.

### 2.3 Story 4 & 5: Top-of-List Creation & Jump-to-Index Reordering
- **Backend (`internal/service/task_service.go`):**
  - `CreateTask`: New backlog tasks default to `backlog_order = 1` and shift existing backlog tasks down via `taskRepo.ReorderBacklog`. New day tasks (`TODAY` / `BLOCKED`) are created with `priority_order = 1` and shift existing same-status day tasks down via `dayTaskRepo.Reorder`.
- **Frontend (`TaskCard.tsx`, `DailyBoard.tsx`, `TodayRow.tsx`, `BlockedRow.tsx`, `BacklogRow.tsx`):**
  - Display clickable `#N` rank badge on `TODAY`, `BLOCKED`, and `BACKLOG` cards when `!isReadOnly && totalCount > 1`.
  - Clicking `#N` opens a compact inline numeric input (`1..totalCount`); submitting moves the item to `targetIndex = clamp(val, 1, totalCount) - 1`, shifting intermediate items accordingly, and calls `reorderDayTasks` / `reorderBacklog`.

---

## 3. Acceptance Criteria (Gherkin Scenarios)

- **Scenario 1.1: Completed tasks excluded from Backlog**
  - **Given** a task is marked completed on a `DaySession`
  - **When** `ListBacklog` is called
  - **Then** the completed task is not returned in the Backlog, while remaining visible on the `DaySession` for the date it was completed.
- **Scenario 2.1: Completed Tasks Report with date range**
  - **Given** completed tasks exist across multiple dates
  - **When** the user opens the Reports modal (defaulting to Last 7 Days) or changes the `start`/`end` dates
  - **Then** `GET /api/reports/completed` returns only completed tasks within `[start, end]` with full metadata.
- **Scenario 3.1: CSV Export**
  - **Given** the Completed Tasks Report displays matching tasks
  - **When** the user clicks "Export CSV"
  - **Then** a `.csv` file downloads containing headers and properly escaped rows for all available task fields.
- **Scenario 4.1: New tasks inserted at top of list**
  - **Given** Today or Backlog has existing tasks `[A (#1), B (#2)]`
  - **When** a new task `C` is created
  - **Then** `C` is assigned position `#1` and existing tasks shift to `A (#2), B (#3)`.
- **Scenario 5.1: Move task to specific index**
  - **Given** a list has `[A (#1), B (#2), C (#3), D (#4)]`
  - **When** the user clicks `#1` on `A` and enters `3`
  - **Then** `B` and `C` shift up to `#1` and `#2`, `A` moves to `#3`, and the new order `[B, C, A, D]` is persisted.

---

## 4. Definition of Done (DoD)
- [x] `ListBacklog` filters `is_completed == false`; verified by backend test.
- [x] `GET /api/reports/completed` implemented with concurrent day-task fetch and batched master-task join; verified by Go tests.
- [x] `ReportsModal.tsx` and `csvExport.ts` implemented and wired to `App.tsx`; verified by Vitest tests.
- [x] `CreateTask` inserts new tasks at position `1` and shifts existing items down; verified by Go tests.
- [x] Clickable `#N` jump-to-index control implemented on `TaskCard.tsx` and `DailyBoard.tsx`; verified by Vitest tests.
- [x] `go test -v ./...`, `npm test -- --run`, `npm run build`, and `go build -o bin/dailycheckin ./cmd/server` pass.
- [x] QA report archived in `test-reports/QA-REPORT-012-completed-reports-csv-and-ordering-2026-11-24.md`.
