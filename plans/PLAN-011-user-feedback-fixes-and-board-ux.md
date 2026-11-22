# PLAN-011: User Feedback Batch 1 — Completion Index Fix, Task Edit/Delete & Arrow/Icon Board UX

- **Branch Reference:** `feat/PLAN-011-user-feedback-fixes`
- **Document Reference:** `plans/PLAN-011-user-feedback-fixes-and-board-ux.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@ui-designer`, `@devops-engineer`, `@developer`, `@tester`
- **Status:** **Implemented & Verified (Pending Sprint Review Sign-Off)**

---

## 1. Overview & User Stories

This plan addresses four prioritized items from deployed test-user feedback, grouped into a single cohesive release:

1. **Story 1 (Bug — P0):** *As a user on the deployed site, I want to mark daily tasks as complete without receiving a Firestore `FAILED_PRECONDITION` index error, so that my daily progress is saved reliably.*
2. **Story 2 (Feature — P1):** *As a user, I want to edit (title and description) and delete existing tasks in Today, Blocked, and Backlog, so that I can fix typos, refine details, and remove obsolete items.*
3. **Story 3 (UX — P1):** *As a user, I want to reorder tasks within Today, Blocked, and Backlog using simple Up and Down arrow buttons instead of drag-and-drop, so that reordering is predictable and accessible across desktop and mobile.*
4. **Story 4 (UX — P1):** *As a user, I want a dedicated "Mark as Blocked" icon button on Today tasks instead of dragging tasks to the Blocked row, so that flagging impediments is fast and intuitive.*
5. **Story 5 (UX — P1):** *As a user, I want a wider quick-add bar on the same header line plus a "Details" popup modal (title + description) for adding tasks in Today, Blocked, and Backlog, so I can quickly enter titles or provide full context when needed.*

---

## 2. Architecture, Data Model & Infrastructure Impacts

### 2.1 Story 1: Firestore `day_tasks` Collection Group Index & Date-Scoped Endpoint
- **Root Cause:** `useToggleTaskCompletion` (and `useMoveTaskToBlocked`, `useUnblockTask`) calls `PATCH /api/day-tasks/:id`, which invokes `firestoreDayTaskRepository.FindByID` (`internal/repository/day_task_repo.go:89`):
  ```go
  r.client.CollectionGroup("day_tasks").Where("id", "==", dayTaskID).Documents(ctx)
  ```
  Firestore creates automatic single-field indexes for `COLLECTION` scope only, not `COLLECTION_GROUP` scope. In production Firestore, this fails with `FailedPrecondition: The query requires a COLLECTION_GROUP_ASC index for collection day_tasks and field id`.
- **Fix (Defense-in-Depth):**
  1. **`firestore.indexes.json` (`@devops-engineer`):** Add a `fieldOverrides` entry enabling `COLLECTION_GROUP` `ASCENDING` indexing on `day_tasks.id`:
     ```json
     "fieldOverrides": [
       {
         "collectionGroup": "day_tasks",
         "fieldPath": "id",
         "indexes": [
           { "order": "ASCENDING", "queryScope": "COLLECTION" },
           { "order": "ASCENDING", "queryScope": "COLLECTION_GROUP" }
         ]
       }
     ]
     ```
     Ensure CI/CD or manual deploy runs `firebase deploy --only firestore:indexes` so the production database receives the override.
  2. **Frontend API Alignment (`@developer`):** Since `useToggleTaskCompletion(date)`, `useMoveTaskToBlocked(date)`, and `useUnblockTask(date)` already have `date` in scope, update them to call `PATCH /api/days/:date/tasks/:id` (`updateDayTask(date, dayTaskId, payload)`) instead of `PATCH /api/day-tasks/:id`. The date-scoped endpoint uses `GetByID(ctx, userID, date, dayTaskID)` (direct document lookup, 0 collection-group queries, lower latency). Keep `PATCH /api/day-tasks/:id` working with the new `fieldOverrides` index for backwards compatibility.

### 2.2 Story 2: Task Editing & Deleting (Archiving)
- **Backend (`internal/service/task_service.go`, `internal/service/day_session_service.go`):**
  - `PATCH /api/tasks/:id` (`UpdateTask`) and `DELETE /api/tasks/:id` (`ArchiveTask`) already exist and support updating `title`/`description` and setting `is_archived = true`.
  - **Gap to Close:** In `daySessionService.GetDaySession` (`internal/service/day_session_service.go`), when joining `DayTask` with `masterTask`, if `masterTask.IsArchived` is `true`, skip adding the task to `TODAY` and `BLOCKED` (while preserving `YESTERDAY` historical accomplishments if already completed).
- **Frontend (`frontend/src/api/tasks.ts`, `frontend/src/hooks/useBoard.ts`):**
  - Add `useUpdateTask(date)` and `useArchiveTask(date)` TanStack Query mutations calling existing `updateTask(taskId, payload)` and `archiveTask(taskId)`, invalidating both `boardKeys.daySession(date)` and `boardKeys.backlog()`.

### 2.3 Story 3 & Story 4: Removing `@hello-pangea/dnd` & Adding Arrow/Block Controls
- Remove `DragDropContext`, `Droppable`, `Draggable`, and `@hello-pangea/dnd` usage from `DailyBoard.tsx`, `ExecutionRow.tsx`, `TodayRow.tsx`, `BlockedRow.tsx`, `BacklogRow.tsx`, `YesterdayRow.tsx`, and `TaskCard.tsx` (and remove `@hello-pangea/dnd` from `frontend/package.json` if unused elsewhere).
- Intra-section reordering uses existing `useReorderDayTasks(date)` (`TODAY`, `BLOCKED`) and `useReorderBacklog()` (`BACKLOG`) by swapping adjacent items at `index` and `index - 1` (Move Up) or `index + 1` (Move Down).
- Blocking a task uses existing `BlockerReasonModal` and `useMoveTaskToBlocked(date)` triggered directly from a button on `TODAY` `TaskCard`s.

---

## 3. API Contracts & Endpoints

No new backend endpoints are required; existing contracts are reused:
- `PATCH /api/days/:date/tasks/:id` — Body: `UpdateDayTaskRequest` (`is_completed`, `status`, `blocker_reason`, `priority_order`).
- `PATCH /api/day-tasks/:id` — Body: `UpdateDayTaskRequest` (backed by `day_tasks.id` `COLLECTION_GROUP` index override).
- `PATCH /api/tasks/:id` — Body: `UpdateTaskRequest` (`title`, `description`).
- `DELETE /api/tasks/:id` — Soft-deletes master task (`is_archived = true`).
- `POST /api/days/:date/reorder` & `POST /api/backlog/reorder` — Persist updated ordered IDs.

---

## 4. UI/UX & Interaction Flows (`@ui-designer`)

### 4.1 `TaskCard.tsx` Action Controls
- **Remove:** `GripVertical` drag handle and `Draggable` wrapper.
- **Reorder Arrows (`TODAY`, `BLOCKED`, `BACKLOG` when `!isReadOnly`):**
  - Compact `ChevronUp` and `ChevronDown` buttons (`p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-25 disabled:pointer-events-none`).
  - `Move Up` disabled when `index === 0`; `Move Down` disabled when `index === totalCount - 1`.
  - Accessible `aria-label` and `title`: `"Move task up"` / `"Move task down"`.
- **Mark as Blocked (`TODAY` only, when `!isReadOnly`):**
  - Icon button (`ShieldAlert` or `AlertTriangle` in `text-slate-400 hover:text-amber-400 hover:bg-amber-500/10`) with `title="Mark as blocked"` and `aria-label="Mark task as blocked"`.
  - Clicking opens `BlockerReasonModal` for that `dayTaskId` and `title`.
- **Edit & Delete (`TODAY`, `BLOCKED`, `BACKLOG` when `!isReadOnly`; never on `YESTERDAY`):**
  - **Edit button (`Pencil`):** Opens `EditTaskModal` pre-populated with `task.title` and `task.description`.
  - **Delete button (`Trash2`):** Opens a lightweight confirmation state (either inline confirm or `ConfirmDeleteModal` / `window`-free accessible modal) before calling `useArchiveTask`.

### 4.2 `EditTaskModal.tsx` (New Component)
- Matches `BlockerReasonModal.tsx` dark/light Tailwind styling, focus management, and keyboard shortcuts (`Escape` to cancel, `Enter` on title or Save button to submit).
- Validates non-empty trimmed `title` (disables Save with inline validation hint if blank).
- Allows editing optional `description` (`textarea`).

### 4.3 Empty-State Copy Update (`BlockedRow.tsx`)
- Update empty message from `"No blocked tasks. Drag items here to track impediments."` to `"No blocked tasks. Use the block icon on a Today task to track impediments."`.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Story 1: Complete Daily Task Without Index Error
- **Scenario 1.1: Toggling completion via date-scoped endpoint**
  - **Given** an authenticated user viewing Today's board with an incomplete task in `TODAY`
  - **When** the user clicks the task's completion checkbox
  - **Then** the frontend calls `PATCH /api/days/:date/tasks/:id` with `{ is_completed: true }`
  - **And** the task is marked complete with a `completed_at` timestamp and no `FailedPrecondition` error occurs.
- **Scenario 1.2: `COLLECTION_GROUP` query by `day_tasks.id` succeeds**
  - **Given** `firestore.indexes.json` includes the `COLLECTION_GROUP` `ASCENDING` field override for `day_tasks.id`
  - **When** `PATCH /api/day-tasks/:id` is invoked against Firestore
  - **Then** `FindByID` resolves the `DayTask` without a missing-index error.

### Story 2: Edit & Delete Existing Tasks
- **Scenario 2.1: Edit task title and description**
  - **Given** a task exists in `TODAY`, `BLOCKED`, or `BACKLOG`
  - **When** the user clicks the Edit (`Pencil`) icon, updates the title and description in `EditTaskModal`, and saves
  - **Then** `PATCH /api/tasks/:id` is called and the updated title and description appear immediately on the board.
- **Scenario 2.2: Blank title validation on edit**
  - **Given** `EditTaskModal` is open
  - **When** the user clears the title to whitespace only
  - **Then** the Save button is disabled and no API request is sent.
- **Scenario 2.3: Delete (archive) a task**
  - **Given** a task exists in `TODAY`, `BLOCKED`, or `BACKLOG`
  - **When** the user clicks Delete (`Trash2`) and confirms deletion
  - **Then** `DELETE /api/tasks/:id` is called, the task disappears from the current row, and subsequent `GET /api/days/:date` responses do not include the archived task in `TODAY` or `BLOCKED`.
- **Scenario 2.4: Read-only / Yesterday protection**
  - **Given** a task in `YESTERDAY` or the board in historical read-only mode
  - **Then** Edit and Delete buttons are not rendered.

### Story 3: Up/Down Arrow Reordering (No Drag-and-Drop)
- **Scenario 3.1: Move task up and down within Today, Blocked, or Backlog**
  - **Given** a section (`TODAY`, `BLOCKED`, or `BACKLOG`) has 3 tasks `[A, B, C]`
  - **When** the user clicks "Move down" on `A`
  - **Then** the order becomes `[B, A, C]` and the corresponding reorder API (`POST /api/days/:date/reorder` or `POST /api/backlog/reorder`) is called.
- **Scenario 3.2: Boundary button states**
  - **Given** a section has tasks `[A, B]`
  - **Then** `A`'s "Move up" button is disabled and `B`'s "Move down" button is disabled.
- **Scenario 3.3: Drag-and-drop removed**
  - **Given** the board is rendered
  - **Then** no drag handles (`GripVertical`) or `@hello-pangea/dnd` draggable attributes are present.

### Story 4: Block Task via Icon Button
- **Scenario 4.1: Mark a Today task as blocked**
  - **Given** an active task in `TODAY`
  - **When** the user clicks the "Mark as blocked" icon on that task card
  - **Then** `BlockerReasonModal` opens with the task's title
  - **When** the user enters a blocker reason and confirms
  - **Then** the task moves from `TODAY` to `BLOCKED` with the displayed blocker reason pill.

---

## 6. Definition of Ready (DoR) & Definition of Done (DoD)

### Definition of Ready (DoR)
- [x] User stories and scope boundaries clearly defined across all 4 feedback items.
- [x] Firestore index override (`firestore.indexes.json`) and backend filtering impacts documented.
- [x] API contracts verified against existing Go Echo routes.
- [x] UI/UX interaction flows and accessibility requirements specified.
- [x] Explicit Gherkin acceptance criteria written for happy paths and edge cases.

### Definition of Done (DoD)
- [x] `firestore.indexes.json` updated with `day_tasks.id` `COLLECTION_GROUP` override.
- [x] `internal/service/day_session_service.go` skips archived master tasks in `TODAY`/`BLOCKED`.
- [x] Frontend updated to use `PATCH /api/days/:date/tasks/:id`, Edit/Delete modals & hooks, Up/Down arrow reordering, and Block icon button; `@hello-pangea/dnd` removed.
- [x] `go test -v ./...`, `npm test`, `npm run build`, and `go build -o bin/dailycheckin ./cmd/server` all pass.
- [x] QA verification report archived in `test-reports/QA-REPORT-011-user-feedback-fixes-2026-11-22.md`.
