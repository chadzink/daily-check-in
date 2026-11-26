# PLAN-015: Board Fixes, Future-Date Rescheduling, Blocked Rollover & Inline Sub-tasks

- **Branch Reference:** `feat/PLAN-015-board-fixes-rescheduling-and-subtasks`
- **Document Reference:** `plans/PLAN-015-board-fixes-rescheduling-and-subtasks.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@ui-designer`, `@developer`, `@devops-engineer`, `@tester`
- **Status:** **Implemented & QA Verified (Pending Merge Sign-Off)**

---

## 1. Feature Overview & User Stories

1. **Story 1 — Disable Pull from Backlog on Past Days (Bug Fix — P0):**
   *As a daily user viewing a historical (past) date, I want pulling tasks from the Backlog disabled (both the Pull button and `P` shortcut, plus a backend guard) while still being able to manage the Global Backlog (add, edit, reorder, delete), so that past read-only days are never accidentally mutated.*
2. **Story 2 — Move Task to a Future Date When Editing (Feature — P1):**
   *As a daily user editing a task from Today, Blocked, or Backlog, I want to pick a future date to move/schedule that task onto, preserving `BLOCKED` status and `blocker_reason` for blocked tasks, so that I can defer work cleanly without demoting and re-pulling.*
3. **Story 3 — Exclude Deleted Tasks from Morning Check-In (Bug Fix — P0):**
   *As a daily user running Morning Check-In, I want deleted (archived) tasks excluded from both Step 1 (Yesterday's accomplishments) and Step 2 (Rollover candidates), backed by a permanent regression test that reproduces the bug first, so that deleted tasks never reappear in my morning ritual.*
4. **Story 4 — Preserve Blocked Tasks During Morning Check-In Rollover (Bug Fix — P0):**
   *As a daily user with blocked tasks from my prior workday, I want Step 2 (Rollover) to display their `BLOCKED` status and blocker reason and default them to **Keep Blocked** (preserving `blocker_reason` and omitting them from Step 4's Today prioritization), while still letting me unblock them to Today, demote to Backlog, or mark Done Late.*
5. **Story 5 — Exclude Committed Today/Future Tasks from Backlog Across All Dates (Bug Fix — P0):**
   *As a daily user navigating to future or past dates, I want tasks that are currently unfinished in Today or any future date session excluded from the Global Backlog, so that active work never appears as unscheduled backlog items.*
6. **Story 6 — Inline Sub-tasks & Standup Export (Feature — P1):**
   *As a daily user, I want tasks to support lightweight title-only sub-tasks that travel with the parent task, display expanded by default on task cards with a completion progress badge, allow inline add/edit/delete/toggle directly on the card, auto-complete when the parent is marked done (without reverse cascades), and export as indented Markdown bullets in Standup Export.*

### Scope Boundaries
- **In Scope:**
  - Frontend & backend past-date pull guard (`disablePull={isHistorical}`, `P` shortcut suppression, `POST /api/days/:date/pull` guard) while keeping Backlog CRUD/reordering enabled on past dates.
  - Future-date rescheduling inside `EditTaskModal` for Today, Blocked, and Backlog tasks with atomic Firestore move endpoint (`POST /api/tasks/:id/move`).
  - Regression test + fix excluding archived master tasks from Morning Check-In Step 1 (`resolveYesterdayCompletedTasks`) and Step 2 (`GetMorningCheckInContext`).
  - Blocked task rollover triage (`KEEP_BLOCKED` default action, read-only blocker reason display in Step 2, omission from Step 4, backend `BlockerReason` preservation in `ExecuteMorningCheckIn`).
  - Global Backlog exclusion of master tasks that have an unfinished (`!is_completed`) non-`YESTERDAY` `DayTask` on `today` or any future date (`date >= today`).
  - Embedded `subtasks` array on master `Task`, inline `SubtaskList` UI on `TaskCard`, parent-to-subtask completion cascade, and Standup Markdown indented sub-bullets.
- **Out of Scope:**
  - Inline editing of blocker reasons inside Morning Check-In Step 2 (view-only).
  - Sub-task descriptions, nested sub-sub-tasks, or sub-task management inside `EditTaskModal`.
  - Auto-completing a parent task when all sub-tasks are checked, or unchecking sub-tasks when a parent task is unchecked.
  - Drag-and-drop reordering of sub-tasks.
  - New Firestore composite indexes or Terraform/Docker infrastructure changes.

---

## 2. Architecture & Data Model Impacts

### 2.1 Domain Models (`internal/model/domain.go` & `frontend/src/types/domain.ts`)

1. **Sub-task Model (Embedded on Master `Task` & Projected onto `DayTaskWithDetails`):**
   ```go
   type Subtask struct {
       ID          string `firestore:"id" json:"id"`
       Title       string `firestore:"title" json:"title"`
       IsCompleted bool   `firestore:"is_completed" json:"is_completed"`
       Order       int    `firestore:"order" json:"order"`
   }
   ```
   - Add `Subtasks []Subtask` to `model.Task` with tags `` `firestore:"subtasks" json:"subtasks"` `` (no `omitempty` on JSON so it always serializes as `[]`).
   - Add `Subtasks []Subtask` to `model.DayTaskWithDetails` with tag `` `json:"subtasks"` ``.
   - Add `Subtasks *[]Subtask` to `model.UpdateTaskRequest` (`json:"subtasks,omitempty"`).
   - **Nil-Slice Normalization (DoD Requirement):**
     - Initialize `Subtasks: make([]model.Subtask, 0)` on task creation.
     - Normalize `if task.Subtasks == nil { task.Subtasks = make([]model.Subtask, 0) }` immediately after `snap.DataTo(&task)` in `task_repo.go` (`GetByID`, `GetByIDs`, `ListBacklog`) and when constructing `DayTaskWithDetails` so legacy Firestore documents serialize as `[]` rather than `null`.
   - **Validation Caps:** Max **50** sub-tasks per task; max **250** characters per trimmed non-empty sub-task title. Reject invalid payloads with `400 Bad Request` (`model.ErrInvalidInput`).

2. **Blocked Rollover Action & Decision (`internal/model/domain.go`):**
   ```go
   const (
       RolloverToToday     RolloverAction = "ROLLOVER"
       RolloverKeepBlocked RolloverAction = "KEEP_BLOCKED"
       RolloverDemote      RolloverAction = "DEMOTE"
       RolloverCompleted   RolloverAction = "COMPLETE"
   )
   ```
   - `RolloverDecision` optionally carries `BlockerReason string` (`json:"blocker_reason,omitempty"`), while backend `ExecuteMorningCheckIn` also looks up the prior day's `DayTask.BlockerReason` as the authoritative fallback.

3. **Move / Reschedule Task Request (`internal/model/domain.go`):**
   ```go
   type MoveTaskToDateRequest struct {
       TargetDate string `json:"target_date"`           // Required: YYYY-MM-DD (must be strictly > today)
       SourceDate string `json:"source_date,omitempty"` // Optional: YYYY-MM-DD when moving from Today/Blocked
       DayTaskID  string `json:"day_task_id,omitempty"` // Optional: source DayTask ID when moving from Today/Blocked
       TodayDate  string `json:"today_date,omitempty"`  // Optional: client local YYYY-MM-DD for timezone-safe validation
   }
   ```

4. **Past-Date Pull Guard (`internal/model/domain.go`):**
   - Extend `PullDayTaskRequest` with optional `TodayDate string` (`json:"today_date,omitempty"`), defaulting to server UTC `YYYY-MM-DD` when omitted. If `date < todayDate`, reject with `400 Bad Request` (`model.ErrInvalidInput`: `"cannot pull tasks into a past date"`).

5. **Frontend Types (`frontend/src/types/domain.ts`):**
   - Add `Subtask` interface (`id`, `title`, `is_completed`, `order`).
   - Add `subtasks: Subtask[]` to `MasterTask` and `DayTaskWithDetails`, and `subtasks?: Subtask[]` to `UpdateTaskPayload`.
   - Extend `RolloverAction` to `'ROLLOVER' | 'KEEP_BLOCKED' | 'DEMOTE' | 'COMPLETE'`.
   - Add `blocker_reason?: string` to `RolloverDecision`, `today_date?: string` to `PullDayTaskPayload`, and `MoveTaskToDatePayload`.

### 2.2 Backend Repository & Service Changes

1. **Item 1 — Past-Date Pull Guard (`internal/service/day_session_service.go`):**
   - In `PullDayTask(ctx, userID, date, req)`, validate `date` (`YYYY-MM-DD`). Resolve `today := req.TodayDate` (falling back to `time.Now().UTC().Format("2006-01-02")`). If `date < today`, return `fmt.Errorf("%w: cannot pull tasks into a past date", model.ErrInvalidInput)`.

2. **Item 2 — Atomic Move Task to Future Date (`internal/service/task_service.go` & `day_session_service.go`):**
   - Add `MoveTaskToDate(ctx, userID, taskID string, req model.MoveTaskToDateRequest) (*model.DayTaskWithDetails, error)`:
     - Validate `req.TargetDate` (`YYYY-MM-DD`), resolve `today` (`req.TodayDate` or server UTC date), and reject if `req.TargetDate <= today` or `req.TargetDate == req.SourceDate` with `model.ErrInvalidInput`.
     - Verify master `Task` exists and is not archived.
     - Determine target `Status` and `BlockerReason`:
       - If moving from a source day (`req.SourceDate != ""`): locate source `DayTask` in `req.SourceDate` matching defensively by `dt.ID == req.DayTaskID || dt.TaskID == taskID` (DoD standard). If source status is `BLOCKED`, preserve `Status = StatusBlocked` and `BlockerReason = source.BlockerReason`; otherwise `Status = StatusToday`, `BlockerReason = ""`.
       - If moving from Backlog (`req.SourceDate == ""`): `Status = StatusToday`, `BlockerReason = ""`.
     - Use a Firestore `WriteBatch` (or `RunTransaction`) to atomically:
       1. Ensure target `day_sessions/{targetDate}` document exists (required so Item 5's `ListFromDate` discovers it).
       2. Check target date's `day_tasks`: if a non-`YESTERDAY` `DayTask` for `taskID` already exists on `targetDate`, update it (avoiding duplicates); otherwise create a new `DayTask` at `PriorityOrder: len(existing) + 1`.
       3. If moving from a source date, delete the matched source `DayTask` from `req.SourceDate`.

3. **Item 3 — Exclude Archived Tasks in Morning Check-In (`internal/service/ritual_service.go` & `yesterday_resolver.go`):**
   - **Step 2 (`GetMorningCheckInContext`):** When iterating `incompleteTasks` after `taskRepo.GetByIDs`, skip any task where `masterTask` is missing (`!ok`) OR `masterTask.IsArchived == true`.
   - **Step 1 (`resolveYesterdayCompletedTasks`):** Apply the same guard (`masterTask, ok := tasksMap[dt.TaskID]; if !ok || masterTask.IsArchived { continue }`) so archived tasks never appear in Yesterday's accomplishments either.
   - **TDD Mandate:** Write a failing unit test in `internal/service/ritual_service_test.go` first confirming that an archived task from `previousDate` currently leaks into `RolloverCandidates` (and `YesterdayTasks`), then apply the fix and keep the test permanently.

4. **Item 4 — Blocked Rollover Preservation (`internal/service/ritual_service.go`):**
   - In `ExecuteMorningCheckIn`:
     - Build a lookup map of `prevDayTasks` by `TaskID` (and `ID`) to read each task's prior `BlockerReason`.
     - Handle `model.RolloverKeepBlocked`: ensure the task is committed to `date` with `Status: model.StatusBlocked` and `BlockerReason` copied from `decision.BlockerReason` (if non-empty) or from the prior day's `DayTask.BlockerReason`.
     - Also preserve `BlockerReason` in the `req.BlockedTaskIDs` loop by looking up the prior day's `DayTask.BlockerReason` when creating a `StatusBlocked` `DayTask`, and deduplicate against `RolloverKeepBlocked` via `existingTaskIDs`.
     - For `model.RolloverToToday`: commit with `Status: model.StatusToday` and `BlockerReason: ""` (explicitly unblocking a previously blocked task).

5. **Item 5 — Global Backlog Exclusion for Today + Future Sessions (`internal/repository/day_session_repo.go` & `internal/service/task_service.go`):**
   - Add `ListFromDate(ctx context.Context, userID, startDate string) ([]*model.DaySession, error)` to `DaySessionRepository`:
     - Queries `/users/{userID}/day_sessions` with `.Where("date", ">=", startDate).OrderBy("date", firestore.Asc)`.
   - In `taskService.ListBacklog(ctx, userID, todayDate string)`:
     - Fetch `tasks` from `taskRepo.ListBacklog(ctx, userID)` (kept unfiltered so `CreateTask` backlog ordering still sees all unarchived/incomplete master tasks).
     - Resolve `today := todayDate` (defaulting to server UTC `YYYY-MM-DD`).
     - Call `daySessionRepo.ListFromDate(ctx, userID, today)`.
     - Concurrently fetch `dayTaskRepo.ListByDate(ctx, userID, sess.Date)` across returned sessions using `golang.org/x/sync/errgroup` with `g.SetLimit(10)`.
     - Collect `committedIDs` for every `DayTask` where `!dt.IsCompleted && dt.Status != model.StatusYesterday`.
     - Filter `tasks` to exclude any `t.ID` in `committedIDs`, returning `make([]*model.Task, 0)` when empty.
   - Apply the same committed-ID exclusion in `RitualService.GetMorningCheckInContext` when populating `backlogTasks` for Step 3 (also excluding `rolloverCandidates`), so tasks already committed to Today/future sessions don't appear in Step 3 Backlog pull either.

6. **Item 6 — Sub-task CRUD & Parent Completion Cascade (`internal/service/task_service.go` & `day_session_service.go`):**
   - In `taskService.UpdateTask`: when `req.Subtasks != nil`, validate count (`<= 50`), trim titles (reject empty or `> 250` chars), auto-assign UUID if `sub.ID == ""`, normalize `Order` (`1..N`), and persist.
   - **Parent Completion Cascade (One-Way Only):**
     - In `daySessionService.UpdateDayTask`, `daySessionService.PatchDayTask`, `taskService.UpdateTask`, `ritualService.ExecuteMorningCheckIn` (`RolloverCompleted`), and `ritualService.ExecuteCheckOut` (`CompleteTaskIDs`):
     - When a task transitions to `is_completed = true`, mark **all** `masterTask.Subtasks[i].IsCompleted = true` before saving `masterTask`.
     - When a task transitions to `is_completed = false`, do **NOT** modify `masterTask.Subtasks[i].IsCompleted`.
     - Updating sub-tasks via `PATCH /api/tasks/:id` never auto-completes the parent `Task` even if all sub-tasks are `is_completed = true`.
   - Join `masterTask.Subtasks` into `DayTaskWithDetails.Subtasks` in `GetDaySessionWithTasks`, `CreateDayTask`, `UpdateDayTask`, `resolveYesterdayCompletedTasks`, and `GetMorningCheckInContext`.

### 2.3 DevOps & Firestore Assessment (`@devops-engineer`)
- **Zero New Composite Indexes Required:**
  - `ListFromDate` uses a single-field range/order query on `date` within `/users/{uid}/day_sessions` (auto-indexed by Firestore).
  - Embedded `subtasks` on `Task` requires no subcollection queries or indexes.
- **No `firestore.indexes.json`, `docker-compose.yml`, or `firebase.json` changes needed.**
- **Data Hygiene:** Normalize `nil` `Subtasks` slices to `make([]model.Subtask, 0)` in repository decoders for backward compatibility with existing Firestore documents.

---

## 3. API Contracts & Endpoints

| Method & Path | Request / Query Schema | Response & Status Codes |
| :--- | :--- | :--- |
| `POST /api/days/:date/pull` | `{ "task_id": "uuid", "status": "TODAY", "priority_order"?: 1, "today_date"?: "YYYY-MM-DD" }` | `201 Created` (`DayTask`); `400 Bad Request` if `date < today_date`; `404`, `401` |
| `POST /api/tasks/:id/move` | `{ "target_date": "YYYY-MM-DD", "source_date"?: "YYYY-MM-DD", "day_task_id"?: "uuid", "today_date"?: "YYYY-MM-DD" }` | `200 OK` (`DayTaskWithDetails` on `target_date`); `400 Bad Request` if `target_date <= today_date` or `target_date == source_date`; `404`, `401` |
| `GET /api/backlog?today=YYYY-MM-DD` | Query param `today` (optional, client local date `YYYY-MM-DD`, defaults to server UTC date) | `200 OK` (`BacklogResponse` excluding tasks with unfinished non-`YESTERDAY` `DayTask` on `date >= today`; `tasks` always `[]` never `null`); `401` |
| `GET /api/days/:date/check-in/context` | Path param `:date` | `200 OK` (`CheckInContextResponse` excluding archived tasks from both `yesterday_tasks` and `rollover_candidates`, and excluding committed `date >= today` tasks from `backlog_tasks`; includes `subtasks: []` on tasks); `400`, `401` |
| `POST /api/days/:date/check-in` | `ExecuteCheckInRequest` supporting `action: "KEEP_BLOCKED"` (and optional `blocker_reason`) in `rollover_decisions` | `200 OK` (`DaySessionWithTasks` with kept-blocked tasks in `tasks.blocked` retaining `blocker_reason`); `409 Conflict`, `400`, `401` |
| `PATCH /api/tasks/:id` | `UpdateTaskRequest` adding optional `subtasks?: Subtask[]` | `200 OK` (`Task` with normalized `subtasks: []`); `400 Bad Request` on >50 subtasks or blank/>250-char title; `404`, `401` |
| `PATCH /api/days/:date/tasks/:id` | `UpdateDayTaskRequest` (`is_completed: true` cascades to mark all master `subtasks` completed; `is_completed: false` leaves sub-tasks unchanged) | `200 OK` (`DayTaskWithDetails` with updated `subtasks: []`); `404`, `401` |

---

## 4. UI / UX & Interaction Flows (`@ui-designer`)

### 4.1 Item 1 — Disable Pull from Backlog on Past Days (`DailyBoard.tsx`, `BacklogRow.tsx`, `TaskCard.tsx`)
- Pass `disablePull={isHistorical}` (not `isReadOnly`) from `DailyBoard` → `BacklogRow` → `TaskCard`.
- Remove `if (isHistorical) return;` from `handleMoveBacklogTaskToIndex` in `DailyBoard.tsx` so Backlog remains addable, editable, reorderable, and deletable on past dates.
- On `TaskCard`, when `isBacklog && disablePull`:
  - Render the Pull button with `disabled`, `aria-disabled="true"`, muted styling (`cursor-not-allowed opacity-60 text-slate-500 bg-slate-800/60 border-slate-700/60`), and `title="Cannot pull tasks into a past date"`.
- In `DailyBoard.tsx`:
  - Ignore the `P` global keyboard shortcut when `isHistorical === true`.
  - Visually mute the `P Pull Top Item` hint in the Quick Shortcuts bar (`opacity-40 line-through`) when `isHistorical === true`.
  - Pass client local `today` (`useDateContext().today`) in `pullBacklogTask` (`today_date`) and `useBacklog(today)` (`?today=...`).

### 4.2 Item 2 — Move Task to Future Date (`EditTaskModal.tsx`, `DailyBoard.tsx`)
- Render a **"Move to Future Date"** section inside `EditTaskModal` **only** when `mode === 'edit'` and the task is in **Today**, **Blocked**, or **Backlog** (never in `mode === 'create'`).
- Controls:
  - Native `<input id="edit-task-move-date" data-testid="edit-task-move-date" type="date" min={minFutureDate} />` where `minFutureDate` is local tomorrow (`today + 1 day`).
  - Clear (`X`) button beside the date input when a date is selected.
  - Context-aware helper text:
    - Today / Backlog: *"Schedules this task onto the selected future date's Today list."*
    - Blocked: amber note (*"Blocked tasks keep their Blocked status and blocker reason when moved."*).
  - Inline validation error if user manually enters `targetDate <= today` or `targetDate === currentDate`.
  - Submit button text updates to **`Save & Move`** when a valid target date is chosen; saving updates title/description (if changed) and invokes `POST /api/tasks/:id/move`, invalidating `daySession(currentDate)`, `daySession(targetDate)`, and `backlog(today)`.

### 4.3 Items 3 & 4 — Morning Check-In Step 2 Blocked Rollover (`Step2RolloverTriage.tsx`, `MorningCheckInModal.tsx`)
- **Card Styling for Blocked Candidates (`task.status === 'BLOCKED'`):**
  - Amber card border (`border-amber-500/35 bg-slate-900/80`).
  - Inline `Blocked` pill badge with `ShieldAlert` icon (`bg-amber-500/15 text-amber-300 border-amber-500/30`).
  - Read-only amber blocker reason box below title/description showing `task.blocker_reason` (no inline editing).
- **Segmented Action Control (`role="radiogroup"`):**
  - **Blocked tasks (4 options, default: `KEEP_BLOCKED`):**
    1. **Keep Blocked** (`bg-amber-600 text-white` when active) — rolls into today's Blocked row preserving `blocker_reason`.
    2. **Roll Over** (`bg-sky-500 text-white` when active) — unblocks and rolls into Today.
    3. **Backlog** (`bg-violet-600 text-white` when active) — demotes to Backlog.
    4. **Done Late** (`bg-emerald-600 text-white` when active) — marks complete on prior day.
  - **Non-blocked tasks (3 options, default: `ROLLOVER`):** `Roll Over`, `Backlog`, `Done Late`.
- **Step 4 Behavior:**
  - Omit tasks marked `KEEP_BLOCKED` from Step 4 ("Prioritize Today's List") — no extra "Staying Blocked" section.
  - Show a subtle muted note at the bottom of Step 2 when ≥1 task is set to `KEEP_BLOCKED` (e.g., *"Tasks set to Keep Blocked will carry directly into today's Blocked row and skip Step 4 prioritization."*).

### 4.4 Item 6 — Inline Sub-tasks (`SubtaskList.tsx`, `TaskCard.tsx`, `standupGenerator.ts`)
- **No sub-task UI in `EditTaskModal.tsx`.**
- **Progress Badge on `TaskCard.tsx`:**
  - When `(task.subtasks?.length ?? 0) > 0`, render a compact pill beside the task title with `ListChecks` icon and `${completedCount}/${totalCount}` (`text-emerald-300 bg-emerald-500/15 border-emerald-500/30` when all completed, otherwise `text-slate-300 bg-slate-800 border-slate-700`). Sub-tasks remain **expanded by default** (not hidden behind the badge).
- **Inline `SubtaskList.tsx` (inside `TaskCard` body below description/blocker pill with subtle top border `border-t border-slate-800/70 pt-2 mt-2`):**
  - Each `SubtaskItem`:
    - Compact checkbox (`h-3.5 w-3.5`, `data-testid="subtask-checkbox-${sub.id}"`) toggling `is_completed` independently via `PATCH /api/tasks/:id` with optimistic TanStack Query update.
    - Clickable title (`data-testid="subtask-title-${sub.id}"`) that switches to an inline `<input>` (`Enter` saves, `Escape` cancels, `onBlur` saves if changed and non-empty).
    - Hover/focus-visible delete `X` button (`data-testid="subtask-delete-${sub.id}"`).
  - Inline `+ Add sub-task` trigger (`data-testid="task-add-subtask-trigger-${task.id}"`) opening a compact inline form (`data-testid="task-add-subtask-input-${task.id}"`); `Enter` appends the sub-task and keeps the input open/focused for rapid entry, `Escape` closes it.
  - **Read-only Mode (`isReadOnly || isYesterday`):** Render the progress badge and expanded sub-tasks with disabled checkboxes and plain `<span>` titles; hide the `+ Add sub-task` trigger, inline editing, and delete buttons.
- **Standup Markdown Export (`frontend/src/utils/standupGenerator.ts`):**
  - Under each task in Yesterday, Today, and Blocked, render `(task.subtasks || [])` as 2-space indented bullets:
    ```markdown
    - [ ] Ship auth middleware (Priority 1)
      - [x] Verify JWT claims
      - [ ] Add rate limit test
    ```

---

## 5. Vertical Slice Execution Order

1. **Slice 1 (Backend Bug Fixes & Guards — Items 1, 3, 4, 5):**
   - Write failing regression test for Item 3 (archived task in Morning Check-In Step 1 & Step 2), then fix `ritual_service.go` & `yesterday_resolver.go`.
   - Implement Item 4 (`RolloverKeepBlocked` + `BlockerReason` preservation in `ritual_service.go`).
   - Implement Item 1 (`PullDayTask` past-date guard).
   - Implement Item 5 (`DaySessionRepository.ListFromDate` + `errgroup` filtering in `taskService.ListBacklog` and `GetMorningCheckInContext` + `?today=` query param).
2. **Slice 2 (Backend Move & Sub-tasks — Items 2 & 6):**
   - Implement Item 2 (`POST /api/tasks/:id/move` with atomic batch/transaction + defensive source ID matching).
   - Implement Item 6 (`Subtask` model, nil-slice normalization across `task_repo.go` & `DayTaskWithDetails`, `UpdateTask` validation caps, one-way parent-to-subtask completion cascade across all completion paths).
   - Run `go test -v ./...`.
3. **Slice 3 (Frontend Board & Wizard Fixes — Items 1, 2, 3, 4, 5):**
   - Wire `?today=` in `useBacklog` and `today_date` in `usePullBacklogTask`.
   - Update `DailyBoard.tsx`, `BacklogRow.tsx`, `TaskCard.tsx` for Item 1 (`disablePull`, `P` shortcut, Backlog reorder enabled on past dates).
   - Update `EditTaskModal.tsx` & `DailyBoard.tsx` for Item 2 (future-date move picker + `useMoveTaskToDate`).
   - Update `Step2RolloverTriage.tsx` & `MorningCheckInModal.tsx` for Item 4 (`KEEP_BLOCKED` default, amber styling, blocker reason box, Step 4 omission).
4. **Slice 4 (Frontend Inline Sub-tasks & Standup Export — Item 6):**
   - Build `SubtaskList.tsx`, integrate into `TaskCard.tsx`, `DailyBoard.tsx`, and `useBoard.ts` (optimistic subtask mutations + parent completion cascade).
   - Update `standupGenerator.ts` to emit indented sub-task bullets.
   - Add/update Vitest unit tests, run `npm test -- --run`, `npm run build`, and `go build -o bin/dailycheckin ./cmd/server`.

---

## 6. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Past-Day Backlog Pull Disabled While Backlog Remains Editable (Item 1)
- **Given** the user navigates to a past date (`2026-11-24` when today is `2026-11-26`) with tasks in the Backlog
- **When** the user views the Backlog row
- **Then** every Backlog card's **Pull** button is disabled with tooltip `"Cannot pull tasks into a past date"`
- **And** pressing `P` does not trigger a pull request and the `P` shortcut hint is visually muted
- **And** the user can still add, edit, reorder, and delete Backlog tasks on that past date
- **And** sending `POST /api/days/2026-11-24/pull` with `today_date: "2026-11-26"` returns `400 Bad Request`.

### Scenario 2: Move Today, Blocked, or Backlog Task to a Future Date (Item 2)
- **Given** the user is on today (`2026-11-26`) with a Blocked task (`blocker_reason: "Waiting on API key"`) and a Today task
- **When** the user opens Edit on the Blocked task, selects `2026-11-28`, and clicks **Save & Move**
- **Then** `POST /api/tasks/:id/move` removes the task from `2026-11-26` and creates it in `2026-11-28`'s **Blocked** row with `blocker_reason: "Waiting on API key"`
- **When** the user opens Edit on a Backlog task, selects `2026-11-28`, and clicks **Save & Move**
- **Then** the task is scheduled onto `2026-11-28`'s **Today** row and disappears from the Global Backlog
- **When** a user attempts to move a task to today or a past date
- **Then** inline validation blocks submission and the backend returns `400 Bad Request`.

### Scenario 3: Deleted (Archived) Tasks Excluded from Morning Check-In (Item 3 — Regression)
- **Given** a task was incomplete (or completed) on the previous active workday (`2026-11-25`) and was subsequently deleted (`is_archived = true`)
- **When** the user requests `GET /api/days/2026-11-26/check-in/context`
- **Then** the deleted task does **not** appear in `rollover_candidates` (Step 2)
- **And** the deleted task does **not** appear in `yesterday_tasks` (Step 1)
- **And** an automated Go regression test verifies this behavior permanently.

### Scenario 4: Blocked Tasks Default to Keep Blocked in Rollover Step 2 (Item 4)
- **Given** the prior active day had Task A (`TODAY`, incomplete) and Task B (`BLOCKED`, `blocker_reason: "Waiting on QA"`)
- **When** the user opens Morning Check-In Step 2
- **Then** Task B displays an amber border, `Blocked` badge, read-only `"Waiting on QA"` reason, and defaults to **Keep Blocked**
- **And** Task A defaults to **Roll Over**
- **When** the user proceeds to Step 4 without changing decisions
- **Then** only Task A appears in Step 4 prioritization (Task B is omitted)
- **When** the user commits the check-in
- **Then** Task B lands in today's **Blocked** row with `blocker_reason: "Waiting on QA"`
- **And** if the user instead selects **Roll Over** on Task B in Step 2, Task B appears in Step 4 and lands in today's **Today** row with no blocker reason.

### Scenario 5: Committed Today & Future Tasks Excluded from Backlog on All Dates (Item 5)
- **Given** Task X is unfinished in Today (`2026-11-26`), Task Y is unfinished on a future date (`2026-11-28`), and Task Z is uncommitted
- **When** the user views `2026-11-28` (future) or `2026-11-24` (past) or calls `GET /api/backlog?today=2026-11-26`
- **Then** the Backlog contains **only** Task Z (neither Task X nor Task Y appears)
- **When** Task X is demoted to Backlog
- **Then** Task X reappears in the Global Backlog across all dates.

### Scenario 6: Inline Sub-tasks Lifecycle, One-Way Cascade & Standup Export (Item 6)
- **Given** a task in Today with no sub-tasks
- **When** the user clicks `+ Add sub-task` on the card and adds `"Write tests"` and `"Update docs"` inline
- **Then** both sub-tasks render expanded on the card with a `0/2` progress badge
- **When** the user checks `"Write tests"` and `"Update docs"` individually
- **Then** the progress badge updates to `2/2` (emerald) while the parent task remains **incomplete**
- **When** a task has 1 checked and 1 unchecked sub-task and the user checks the **parent** task complete
- **Then** both sub-tasks become checked (`2/2`)
- **When** the user unchecks the **parent** task
- **Then** both sub-tasks remain checked
- **When** the user moves the parent task to Blocked, Backlog, or a future date
- **Then** all sub-tasks travel intact with the parent
- **When** the user opens Standup Export
- **Then** sub-tasks render as 2-space indented `- [x]` / `- [ ]` bullets under their parent task
- **And** on past read-only dates (and Yesterday row), sub-tasks render expanded with disabled checkboxes and no add/edit/delete controls.

---

## 7. Definition of Done (DoD) Checklist
- [x] Failing regression test written for Item 3, bug fixed, and test retained permanently (`@developer`)
- [x] Backend changes implemented for Items 1–6 with unit tests, `make([]T, 0)` slice normalization, batch/transaction atomicity, and `errgroup` concurrency (`@developer`)
- [x] Frontend components (`DailyBoard`, `BacklogRow`, `TaskCard`, `SubtaskList`, `EditTaskModal`, `Step2RolloverTriage`, `MorningCheckInModal`, `standupGenerator`) implemented per `@ui-designer` spec (`@developer` / `@ui-designer`)
- [x] Frontend Vitest unit tests added/updated for all 6 items (`@developer`)
- [x] `plans/ROADMAP.md` updated with Milestone / Batch 15 (`@product-owner`)
- [x] `go test -v ./...`, `npm test -- --run`, `npm run build`, and `go build -o bin/dailycheckin ./cmd/server` pass cleanly (`@devops-engineer` / `@tester`)
- [x] Acceptance criteria verified with QA report archived in `test-reports/` (`@tester`)

### Definition of Ready (DoR) Gate
- [x] No ambiguous requirements or open questions (all 6 user decisions confirmed).
- [x] Explicit Gherkin acceptance criteria defined for happy paths, regressions, and edge cases.
- [x] Data models, API contracts, Firestore query strategy, and UI specifications finalized.
