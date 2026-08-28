# PLAN: 4-Row Execution Board & Global Backlog CRUD (Milestone 3)

## 1. Feature Overview & User Story
- **Story:** As a daily planner, I want an interactive, responsive 4-row execution board (**Yesterday**, **Today**, **Blocked**, **Backlog**) with smooth drag-and-drop mechanics, instant completion checkboxes, and optimistic UI updates so that I can organize and execute my daily tasks with minimal cognitive friction.
- **Scope:**
  - **In-Scope:**
    - UI Layout & Board Component Hierarchy: `DailyBoard`, `ExecutionRow`, `TaskCard`, `BlockerReasonModal`, `TaskDetailModal`, and `QuickAddInput`.
    - 4 Execution Rows:
      - **Yesterday:** Read-only cards completed on the previous active workday.
      - **Today:** Actively prioritized list with rank indicators (1..N) and instant completion checkboxes.
      - **Blocked:** Blocked items with visible blocker reason chip and unblock trigger.
      - **Backlog:** Global pool of unassigned master tasks with priority reordering and 1-click "Pull into Today" action.
    - Drag-and-drop reordering and inter-row movements using `@hello-pangea/dnd`.
    - TanStack Query cache synchronization with optimistic updates for task completion, status change, and reordering.
    - DayTask & Backlog Backend APIs conforming to `SPECIFICATION.md`:
      - `PATCH /api/day-tasks/:id`
      - `PUT /api/day-tasks/reorder`
      - `POST /api/days/:date/pull`
      - `POST /api/days/:date/tasks/:dayTaskId/demote`
      - `PUT /api/backlog/reorder`
  - **Out-of-Scope:**
    - Morning Check-In & Evening Reflection multi-step wizard modals (handled in Milestone 4 / PLAN-004).
    - Top-left calendar date picker and standup markdown generation (handled in Milestone 5 / PLAN-005).

---

## 2. Architecture & Data Model Impacts
- **Frontend Component Structure (`frontend/src/components/board/`):**
  ```text
  frontend/src/components/board/
  ├── DailyBoard.tsx              # DragDropContext container for all 4 rows
  ├── ExecutionRow.tsx            # Generic droppable row component (Yesterday/Today/Blocked/Backlog)
  ├── TaskCard.tsx                # Draggable task item with completion checkbox & grab handle
  ├── YesterdayRow.tsx            # Read-only accomplishment section
  ├── TodayRow.tsx                # Prioritized 1..N active row with quick-add input
  ├── BlockedRow.tsx              # Blocked section with blocker badges
  ├── BacklogRow.tsx              # Persistent master backlog with pull actions
  ├── BlockerReasonModal.tsx      # Modal dialog when marking a task BLOCKED
  └── QuickAddInput.tsx           # Inline task creation input with keyboard shortcuts (Enter)
  ```
- **TanStack Query Hooks & Optimistic Cache Updates (`frontend/src/hooks/`):**
  - `useDaySession(date)`: Queries `DaySessionWithTasks` (`['daySession', date]`).
  - `useBacklogTasks()`: Queries global master tasks in the backlog (`['backlog']`).
  - `useToggleTaskCompletion()`:
    - Optimistically updates `tasks.today` or `tasks.blocked` in cache.
    - Issues `PATCH /api/day-tasks/:id` (`{ "is_completed": boolean }`).
  - `useReorderDayTasks()`:
    - Optimistically rearranges card order in `tasks.today` or `tasks.blocked`.
    - Issues `PUT /api/day-tasks/reorder` (`{ "day_session_date": date, "status": status, "ordered_day_task_ids": [...] }`).
  - `usePullBacklogTask()`:
    - Optimistically removes task from `['backlog']` and appends to `tasks.today`.
    - Issues `POST /api/days/:date/pull` (`{ "task_id": string, "status": "TODAY", "priority_order": number }`).
  - `useDemoteDayTask()`:
    - Optimistically removes task from `tasks.today` and adds to `['backlog']`.
    - Issues `POST /api/days/:date/tasks/:dayTaskId/demote`.

---

## 3. API Contracts & Endpoints (Aligned with SPECIFICATION.md)

### 3.1 Day Task Mutations
- **`PATCH /api/day-tasks/:id`**
  - Request: `{ "is_completed"?: bool, "status"?: "TODAY"|"BLOCKED", "blocker_reason"?: string }`
  - Response `200 OK`: Updated `DayTask`.
- **`PUT /api/day-tasks/reorder`**
  - Request: `{ "day_session_date": "2026-08-28", "status": "TODAY", "ordered_day_task_ids": ["dt-1", "dt-2"] }`
  - Response `200 OK`: `{ "success": true }`.
- **`POST /api/days/:date/pull`**
  - Request: `{ "task_id": "t-4", "status": "TODAY", "priority_order": 2 }`
  - Response `201 Created`: Created `DayTask`.
- **`POST /api/days/:date/tasks/:dayTaskId/demote`**
  - Response `200 OK`: `{ "success": true }`.

### 3.2 Global Backlog Mutations
- **`POST /api/backlog/tasks`**
  - Request: `{ "title": string, "description"?: string }`
  - Response `201 Created`: Created `Task`.
- **`PUT /api/backlog/reorder`**
  - Request: `{ "ordered_task_ids": ["t-5", "t-4"] }`
  - Response `200 OK`: `{ "success": true }`.

---

## 4. UI / UX & Interaction Flow (Collaborate with @ui-designer)
- **Tailwind Design System Tokens:**
  - Yesterday: `emerald-500` checkmark icon, `emerald-500/10` soft background pill.
  - Today: `sky-500` priority badge, `sky-500/10` focus borders.
  - Blocked: `amber-500` warning icon, `amber-500/20` blocker chip badge with red accent text.
  - Backlog: `violet-500` stack icon, `violet-500/10` subtle hover highlight.
- **Drag & Drop Ergonomics (`@hello-pangea/dnd`):**
  - 6-dot grab handle (`::`) on the left of each draggable card.
  - While dragging: 2-degree card rotation, elevated drop shadow, visible blue drop indicator line.
  - Dropping into *Blocked*: Triggers `BlockerReasonModal`. If user cancels, the card returns to its original position without persisting.
- **Keyboard Shortcuts:**
  - `N`: Focus quick-add input for Today.
  - `B`: Focus quick-add input for Backlog.
  - `P`: Pull top Backlog item into Today.
  - `Esc`: Dismiss open modal dialogs.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Instant Task Completion Toggle with Optimistic Feedback
- **Given:** A task exists in the *Today* row with `is_completed = false`.
- **When:** The user clicks the task completion checkbox.
- **Then:** The UI immediately renders the task as completed with strikethrough and timestamp without waiting for network response.
- **And:** A `PATCH /api/day-tasks/:id` request updates both `day_tasks` and master `tasks` records with `is_completed = true`.
- **When:** The network request fails.
- **Then:** The UI rolls back the optimistic state and displays a retry toast notification.

### Scenario 2: Drag and Drop Reordering in Today List
- **Given:** Three tasks exist in *Today* with priority ranks 1, 2, 3.
- **When:** The user drags task #3 to the #1 position.
- **Then:** The UI updates ranks to 1, 2, 3 instantly and dispatches `PUT /api/day-tasks/reorder`.
- **And:** Reloading the page preserves the new order.

### Scenario 3: Moving Task to Blocked Row with Blocker Note
- **Given:** An active task in *Today*.
- **When:** The user drags the task into the *Blocked* row.
- **Then:** The `BlockerReasonModal` opens requesting a blocker reason.
- **When:** The user submits `"Waiting on staging database access"`.
- **Then:** `PATCH /api/day-tasks/:id` updates status to `BLOCKED` with the reason stored and rendered on the card.

### Scenario 4: Pulling from Global Backlog into Today
- **Given:** A master task in the *Backlog* row.
- **When:** The user clicks "Pull into Today" or drags it into the *Today* row.
- **Then:** A `POST /api/days/:date/pull` request creates a `DayTask` for the current session.
- **And:** The item disappears from the unassigned backlog view and appears in Today with priority rank assigned.

---

## 6. Definition of Done Checklist
- [ ] Backend handlers for `PATCH /api/day-tasks/:id`, `PUT /api/day-tasks/reorder`, and `POST /api/days/:date/pull` implemented with unit tests (`@developer`)
- [ ] 4-Row board layout with `@hello-pangea/dnd` and optimistic updates implemented (`@developer` / `@ui-designer`)
- [ ] UI themes, drag previews, and empty states polished to `@ui-designer` design specs (`@ui-designer`)
- [ ] Vitest component and hook tests passing with logs in `test-results/board-frontend.log` (`@developer`)
- [ ] Headless browser `/browser` validation verifying drag-and-drop and completion toggles (`@tester`)
- [ ] Acceptance criteria verified with saved QA report in `test-reports/QA-REPORT-003-execution-board-<YYYY-MM-DD>.md` (`@tester`)
