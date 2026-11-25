# PLAN-014: Yesterday Accomplishments Fix, Collapsible Execution Rows & Board Row Reorder

- **Branch Reference:** `feat/PLAN-014-yesterday-fix-collapsible-rows-and-reorder`
- **Document Reference:** `plans/PLAN-014-yesterday-fix-collapsible-rows-and-reorder.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@ui-designer`, `@developer`, `@devops-engineer`, `@tester`
- **Status:** **Implemented & QA Verified (Pending Merge Sign-Off)**

---

## 1. Feature Overview & User Stories

1. **Story 1 (Bug Fix — P0):** *As a daily user, I want the "Yesterday" list to show ONLY tasks completed on the most recent prior day that had at least one completed task (never accumulating older days' tasks), with automated regression tests, so that my accomplishments list stays accurate and does not grow indefinitely over time.*
2. **Story 2 (Feature — P1):** *As a daily user, I want to collapse and expand each of the four execution rows (Today, Yesterday, Blocked, Backlog) and have my preference remembered across reloads and date changes, so that I can focus on the sections that matter most right now.*
3. **Story 3 (UX Change — P1):** *As a daily user, I want the **Today** row positioned above the **Yesterday** row (new board order: **Today → Yesterday → Blocked → Backlog**), so that my active work is immediately visible at the top of the board while keeping Standup Export in classic Scrum order (**Yesterday → Today → Blocked**).*

### Scope Boundaries
- **In Scope:**
  - Dynamic backend resolution of `yesterday` tasks & `yesterday_date` from the most recent prior day with at least one non-`YESTERDAY` completed task (`dt.Status != model.StatusYesterday && dt.IsCompleted`).
  - Stop persisting `StatusYesterday` `DayTask` copies during `ExecuteMorningCheckIn` (update `prevDate`'s `DayTask` for `RolloverCompleted` instead).
  - Collateral safeguard in `report_service.go` and `calendar_service.go` to ignore legacy `dt.Status == model.StatusYesterday` documents.
  - Subtle date hint on the `Yesterday` row header when `yesterday_date` is older than calendar yesterday (`selectedDate - 1`).
  - Collapsible/expandable `ExecutionRow` for all 4 rows with `localStorage` persistence and `N`/`B` keyboard shortcut auto-expand.
  - Reorder board rows to **Today → Yesterday → Blocked → Backlog** while keeping Standup Export order **Yesterday → Today → Blocked**.
  - Backend unit/regression tests and frontend unit tests.
- **Out of Scope:**
  - Database migration/deletion script for legacy Firestore `StatusYesterday` documents (dynamic resolution + service guards make existing data harmless immediately).
  - Changing Standup Export section order.
  - Drag-and-drop reintroduction or custom user-defined row ordering.

---

## 2. Architecture & Data Model Impacts

### 2.1 Domain Models (`internal/model/domain.go` & `frontend/src/types/domain.ts`)
- Add optional `YesterdayDate` field to `DaySessionWithTasks`:
  ```go
  type DaySessionWithTasks struct {
      Session       DaySession      `json:"session"`
      Tasks         DayTasksGrouped `json:"tasks"`
      YesterdayDate string          `json:"yesterday_date,omitempty"`
  }
  ```
- Add optional `YesterdayDate` field to `CheckInContextResponse`:
  ```go
  type CheckInContextResponse struct {
      TargetDate         string               `json:"target_date"`
      PreviousDate       string               `json:"previous_date,omitempty"`
      YesterdayDate      string               `json:"yesterday_date,omitempty"`
      YesterdayTasks     []DayTaskWithDetails `json:"yesterday_tasks"`
      RolloverCandidates []DayTaskWithDetails `json:"rollover_candidates"`
      BacklogTasks       []*Task              `json:"backlog_tasks"`
      IsAlreadyCheckedIn bool                 `json:"is_already_checked_in"`
  }
  ```
- Mirror `yesterday_date?: string` in `frontend/src/types/domain.ts` on `DaySessionWithTasks` and `CheckInContextResponse`.

### 2.2 Backend Service Changes
1. **Shared Lookback Helper (`internal/service/yesterday_resolver.go` or helper method):**
   - `resolveYesterdayCompletedTasks(ctx, userID, targetDate) (yesterdayDate string, tasks []model.DayTaskWithDetails, err error)`:
     - Calls `daySessionRepo.ListBeforeDate(ctx, userID, targetDate, 30)` (returns sessions ordered by `date DESC`).
     - Iterates chronologically backward through prior sessions.
     - For each session, fetches `dayTaskRepo.ListByDate(ctx, userID, sess.Date)` and filters for tasks where `dt.IsCompleted && dt.Status != model.StatusYesterday`.
     - On the **first** prior session with `len(completed) > 0`:
       - Batch-fetches master tasks via `taskRepo.GetByIDs(ctx, userID, taskIDs)` (preventing N+1 queries).
       - Builds `[]model.DayTaskWithDetails` with `Status: model.StatusYesterday`, `IsCompleted: true`.
       - Returns `sess.Date` as `yesterdayDate` and the slice.
     - If no prior session in the lookback window has a completed task, returns `("", make([]model.DayTaskWithDetails, 0), nil)`.
2. **`DaySessionService.GetDaySessionWithTasks` (`internal/service/day_session_service.go`):**
   - When partitioning `dayTasks` for `date`, **ignore** any legacy `dt.Status == model.StatusYesterday` records stored on `date`.
   - Call `resolveYesterdayCompletedTasks(ctx, userID, date)` to populate `grouped.Yesterday` and `DaySessionWithTasks.YesterdayDate`.
   - Ensure `grouped.Yesterday`, `grouped.Today`, and `grouped.Blocked` are always initialized via `make([]model.DayTaskWithDetails, 0)` (never `nil`).
3. **`RitualService` (`internal/service/ritual_service.go`):**
   - **`GetMorningCheckInContext`:**
     - `PreviousDate` & `RolloverCandidates`: Still resolved from the most recent prior checked-in session (`sess.CheckInAt != nil`), filtering incomplete tasks with `dt.Status != model.StatusYesterday && !dt.IsCompleted`.
     - `YesterdayDate` & `YesterdayTasks`: Resolved via `resolveYesterdayCompletedTasks(ctx, userID, date)` so the wizard previews the exact last day with completions.
   - **`ExecuteMorningCheckIn`:**
     - **Remove** the block that copies `prevDayTasks` into `date` with `Status: model.StatusYesterday`.
     - For `model.RolloverCompleted` decisions: update the master `Task` (`IsCompleted = true`, `CompletedAt = &now`) **and** mark the matching `DayTask` on `prevDate` as `IsCompleted = true`, `CompletedAt = &now` (matching by `dt.ID == decision.DayTaskID || dt.TaskID == decision.TaskID`) rather than inserting a `StatusYesterday` copy onto `date`. When `GetDaySessionWithTasks` is called at the end of `ExecuteMorningCheckIn`, dynamic resolution will automatically surface it in `Yesterday`.
4. **Collateral Safeguards:**
   - **`ReportService.GetCompletedTasksReport` (`internal/service/report_service.go`):** Guard with `if dt.IsCompleted && dt.Status != model.StatusYesterday` so legacy `YESTERDAY` copies are never double-counted in Completed Tasks Reports.
   - **`CalendarService.GetMonthSummary` (`internal/service/calendar_service.go`):** Skip `dt.Status == model.StatusYesterday` when counting both `completed` and `total` tasks for each day so legacy `YESTERDAY` copies do not inflate calendar day counts.

### 2.3 Firestore Indexes
- **No new Firestore composite indexes are required.** `ListBeforeDate` and `ListByDate` already use existing single-field/path queries.

---

## 3. API Contracts & Endpoints

| Method & Path | Change Summary | Response / Status Codes |
| :--- | :--- | :--- |
| `GET /api/days/:date` | Dynamically resolves `tasks.yesterday` from the most recent prior day with non-`YESTERDAY` completions; adds optional `yesterday_date` (`YYYY-MM-DD`) to response. | `200 OK` (`DaySessionWithTasks`), `401`, `400` |
| `GET /api/days/:date/check-in/context` | Resolves `yesterday_tasks` from the most recent prior day with non-`YESTERDAY` completions; adds optional `yesterday_date` (`YYYY-MM-DD`). `rollover_candidates` still come from `previous_date` (most recent checked-in session) excluding `StatusYesterday`. | `200 OK` (`CheckInContextResponse`), `401`, `400` |
| `POST /api/days/:date/check-in` | No longer writes `StatusYesterday` `DayTask` documents onto `:date`. `RolloverCompleted` marks the `prevDate` `DayTask` and master `Task` completed. Returns updated `DaySessionWithTasks` with dynamically resolved `tasks.yesterday` and `yesterday_date`. | `200 OK` (`DaySessionWithTasks`), `409 Conflict`, `401`, `400` |

---

## 4. UI / UX & Interaction Flow

### 4.1 Board Row Reorder (`frontend/src/components/board/DailyBoard.tsx`)
- Render execution rows inside `[data-testid="daily-board-rows"]` in the following order:
  1. **Today** (`execution-row-today`)
  2. **Yesterday** (`execution-row-yesterday`)
  3. **Blocked** (`execution-row-blocked`)
  4. **Backlog** (`execution-row-backlog`)
- Keep Standup Export (`frontend/src/utils/standupGenerator.ts`) in classic Scrum order: **Yesterday → Today → Blocked**.

### 4.2 Collapsible Execution Rows (`frontend/src/components/board/ExecutionRow.tsx`)
- Add optional props to `ExecutionRowProps` (defaulting to expanded so existing tests remain isolated and backwards-compatible):
  - `isCollapsed?: boolean` (default `false`)
  - `onToggleCollapse?: () => void`
  - `subtitle?: string` (optional muted date hint rendered next to the title, e.g. `Mon, Nov 23`)
- **Accessible Header Structure:**
  - Wrap **only** the left title cluster (Chevron + Accent Icon + Title + optional subtitle + Count Pill) in a semantic `<button type="button">` with:
    - `aria-expanded={!isCollapsed}`
    - `aria-controls={`execution-row-content-${droppableId.toLowerCase()}`}`
    - `aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${title} section`}`
    - `data-testid={`toggle-row-${droppableId.toLowerCase()}`}`
  - Do **not** wrap the full header bar or `headerAction` (`QuickAddInput`) in the button.
  - Place `ChevronDown` (`lucide-react`, `h-4 w-4 text-slate-400 transition-transform duration-150`) to the left of the accent icon, rotating `-rotate-90` when collapsed and `rotate-0` when expanded.
- **Collapsed State Presentation:**
  - Header bottom margin changes from `mb-3.5` to `mb-0` when collapsed for a clean single-line card.
  - Hide `headerAction` (`QuickAddInput`) when collapsed.
  - Unmount the task list container (`id={`execution-row-content-${droppableId.toLowerCase()}`}`), including the empty-state dashed box, while keeping the task count pill visible in the header.

### 4.3 Collapse Persistence & Keyboard Shortcuts (`DailyBoard.tsx`)
- Store collapsed row map in `localStorage` under key `dailycheckin_collapsed_rows` (JSON object `{ TODAY?: boolean, YESTERDAY?: boolean, BLOCKED?: boolean, BACKLOG?: boolean }`), wrapped in safe `try/catch` for SSR/test/private-mode resilience.
- Default state: all 4 rows expanded (`false`).
- Persist across page reloads and calendar date switches.
- **Keyboard Shortcut Auto-Expand:**
  - Pressing `N` (Add Today): if `TODAY` is collapsed, expand it and focus `todayQuickAddRef.current` (e.g., via `requestAnimationFrame` / `setTimeout(..., 0)` after state update).
  - Pressing `B` (Add Backlog): if `BACKLOG` is collapsed, expand it and focus `backlogQuickAddRef.current`.

### 4.4 Yesterday Row Date Hint (`YesterdayRow.tsx` & `dateLabels.ts`)
- Compare `daySession?.yesterday_date` against calendar yesterday (`format(subDays(parseISO(date), 1), 'yyyy-MM-dd')`).
- When `yesterday_date` is present and differs from calendar yesterday (e.g., today is Wed Nov 25, Tue Nov 24 had 0 completions, and `yesterday_date` is `2026-11-23`), render a subtle date hint alongside the Yesterday title (e.g., `Yesterday` with muted hint `· Mon, Nov 23`).
- When `yesterday_date` equals calendar yesterday or is empty, render no extra subtitle.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Multi-day Check-In Non-Accumulation Regression (Happy Path)
- **Given** the user completes Task A on Day 1 (`2026-11-22`), checks in on Day 2 (`2026-11-23`) and completes Task B, and checks in on Day 3 (`2026-11-24`)
- **When** the user fetches `GET /api/days/2026-11-24` and `GET /api/days/2026-11-24/check-in/context`
- **Then** `tasks.yesterday` contains **only** Task B (not Task A)
- **And** `yesterday_date` equals `"2026-11-23"`
- **And** no `StatusYesterday` `DayTask` records are persisted on `2026-11-24`.

### Scenario 2: Skipping Prior Days With Zero Completions (Edge Case)
- **Given** the user completed Task A on Monday (`2026-11-23`), checked in on Tuesday (`2026-11-24`) with 1 incomplete task (Task B) and 0 completed tasks
- **When** the user views Wednesday (`2026-11-25`) or opens the Morning Check-In wizard for Wednesday
- **Then** `tasks.yesterday` contains **only** Task A with `yesterday_date` equal to `"2026-11-23"`
- **And** `rollover_candidates` still contains Tuesday's incomplete Task B with `previous_date` equal to `"2026-11-24"`
- **And** the Yesterday row header displays a subtle date hint for `Mon, Nov 23`.

### Scenario 3: Legacy `StatusYesterday` Immunity Across Board, Reports & Calendar
- **Given** existing Firestore data contains legacy `StatusYesterday` `DayTask` documents with `is_completed = true` from before PLAN-014
- **When** the user loads the Daily Board (`GET /api/days/:date`), Completed Tasks Report (`GET /api/reports/completed`), or Calendar Summary (`GET /api/calendar`)
- **Then** legacy `StatusYesterday` documents are ignored and never duplicated on the board, in completed reports, or in calendar task counts.

### Scenario 4: Collapsible Execution Rows, Persistence & Keyboard Shortcuts
- **Given** the user is on the Daily Board with all 4 rows expanded by default
- **When** the user clicks the toggle button for `Yesterday` (`data-testid="toggle-row-yesterday"`) and `Backlog` (`data-testid="toggle-row-backlog"`)
- **Then** both rows collapse to single-line headers showing their count pills, hiding their task lists and Quick Add bars, with `aria-expanded="false"`
- **And** after reloading the page or switching dates, `Yesterday` and `Backlog` remain collapsed via `localStorage`
- **When** the user presses `B` while `Backlog` is collapsed
- **Then** `Backlog` automatically expands and focuses the Backlog Quick Add input.

### Scenario 5: Board Row Reorder vs. Standup Export Order
- **Given** the user views the Daily Board
- **Then** the execution rows render in DOM order: `execution-row-today`, `execution-row-yesterday`, `execution-row-blocked`, `execution-row-backlog`
- **When** the user opens the Standup Export modal
- **Then** the generated Markdown still outputs sections in classic Scrum order: **Yesterday → Today → Blocked**.

---

## 6. Definition of Done (DoD) Checklist
- [x] Backend dynamic `Yesterday` resolver, `ExecuteMorningCheckIn` fix, and `ReportService`/`CalendarService` guards implemented (`@developer`)
- [x] Backend unit & regression tests added for multi-day non-accumulation, skipping zero-completion days, `RolloverCompleted`, and legacy `StatusYesterday` immunity (`@developer`)
- [x] Frontend `ExecutionRow` collapse/expand UI, `localStorage` persistence, `N`/`B` auto-expand, `Yesterday` date hint, and board row reorder implemented (`@developer` / `@ui-designer`)
- [x] Frontend Vitest unit tests added/updated for row order, collapse/expand, `localStorage` persistence, shortcut auto-expand, and Yesterday date hint (`@developer`)
- [x] `docs/SPECIFICATION.md` and `plans/ROADMAP.md` updated to reflect new row order & collapsible rows
- [x] `go test -v ./...`, `npm test -- --run`, `npm run build`, and `go build -o bin/dailycheckin ./cmd/server` pass cleanly (`@devops-engineer` / `@tester`)
- [x] Acceptance criteria verified with QA report archived in `test-reports/` (`@tester`)

### Definition of Ready (DoR) Gate
- [x] No ambiguous requirements or open questions (all user decisions confirmed).
- [x] Explicit Gherkin acceptance criteria defined for happy paths, regressions, and edge cases.
- [x] Data models, API contracts, and UI specifications finalized.
