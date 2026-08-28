# PLAN: Core Domain Models & Firestore Repositories (Milestone 2)

## 1. Feature Overview & User Story
- **Story:** As a developer on DailyCheckIn, I want the core Go domain models, DTOs, and Firestore data repositories (`DaySession`, `Task`, `DayTask`) fully implemented and tested against the local Firestore emulator so that business services and HTTP APIs can reliably persist, join, and query user state without N+1 query bottlenecks.
- **Scope:**
  - **In-Scope:**
    - Go domain structs, tags, and JSON/Firestore DTOs in `internal/model/` (`DaySession`, `Task`, `DayTask`, `DaySessionResponse`, `DayTaskWithDetails`, `StandardErrorResponse`).
    - Repository interfaces and Firestore SDK implementations in `internal/repository/`:
      - `TaskRepository`: CRUD operations for master tasks, global backlog listing (`is_archived = false` ordered by `backlog_order`), batch fetching by IDs, and task archiving.
      - `DaySessionRepository`: Get or initialize `DaySession` by date (`YYYY-MM-DD`), update session timestamps (`check_in_at`, `check_out_at`, `notes`), and fetch user session history within date ranges.
      - `DayTaskRepository`: Create, update, delete, reorder (`priority_order`), and query day tasks committed to a `DaySession`.
    - Batched join logic in service layer to assemble `DaySessionWithTasks` (`yesterday`, `today`, `blocked`) in a single round-trip without N+1 Firestore queries.
    - Firebase Auth middleware integration in `internal/middleware/auth.go` extracting `uid` from Firebase ID tokens and attaching to `context.Context`.
    - Firestore composite indexes configuration in `firestore.indexes.json` (e.g., querying tasks by `user_id` + `is_archived` + `backlog_order`).
    - Comprehensive unit and integration test suite executing against the local Firestore emulator (`localhost:8085`).
  - **Out-of-Scope:**
    - Full ritual wizard business workflows (handled in Milestone 4 / PLAN-004).
    - Frontend interactive board UI and drag-and-drop board components (handled in Milestone 3 / PLAN-003).

---

## 2. Architecture & Data Model Impacts

### 2.1 Domain Structs & Joined DTOs (`internal/model/`)
```go
package model

import "time"

type DayStatus string

const (
    StatusYesterday DayStatus = "YESTERDAY"
    StatusToday     DayStatus = "TODAY"
    StatusBlocked   DayStatus = "BLOCKED"
)

type DaySession struct {
    ID         string     `firestore:"id" json:"id"`
    UserID     string     `firestore:"user_id" json:"user_id"`
    Date       string     `firestore:"date" json:"date"` // YYYY-MM-DD
    CheckInAt  *time.Time `firestore:"check_in_at" json:"check_in_at"`
    CheckOutAt *time.Time `firestore:"check_out_at" json:"check_out_at"`
    Notes      string     `firestore:"notes" json:"notes"`
    CreatedAt  time.Time  `firestore:"created_at" json:"created_at"`
    UpdatedAt  time.Time  `firestore:"updated_at" json:"updated_at"`
}

type Task struct {
    ID           string     `firestore:"id" json:"id"`
    UserID       string     `firestore:"user_id" json:"user_id"`
    Title        string     `firestore:"title" json:"title"`
    Description  string     `firestore:"description" json:"description"`
    IsCompleted  bool       `firestore:"is_completed" json:"is_completed"`
    CompletedAt  *time.Time `firestore:"completed_at" json:"completed_at"`
    IsArchived   bool       `firestore:"is_archived" json:"is_archived"`
    BacklogOrder int        `firestore:"backlog_order" json:"backlog_order"`
    CreatedAt    time.Time  `firestore:"created_at" json:"created_at"`
    UpdatedAt    time.Time  `firestore:"updated_at" json:"updated_at"`
}

type DayTask struct {
    ID            string     `firestore:"id" json:"id"`
    DaySessionID  string     `firestore:"day_session_id" json:"day_session_id"`
    TaskID        string     `firestore:"task_id" json:"task_id"`
    Status        DayStatus  `firestore:"status" json:"status"`
    IsCompleted   bool       `firestore:"is_completed" json:"is_completed"`
    CompletedAt   *time.Time `firestore:"completed_at" json:"completed_at"`
    PriorityOrder int        `firestore:"priority_order" json:"priority_order"`
    BlockerReason string     `firestore:"blocker_reason,omitempty" json:"blocker_reason,omitempty"`
    CreatedAt     time.Time  `firestore:"created_at" json:"created_at"`
    UpdatedAt     time.Time  `firestore:"updated_at" json:"updated_at"`
}

// DayTaskWithDetails joins DayTask with master Task metadata for single-call client rendering
type DayTaskWithDetails struct {
    DayTaskID     string     `json:"day_task_id"`
    TaskID        string     `json:"task_id"`
    Title         string     `json:"title"`
    Description   string     `json:"description"`
    Status        DayStatus  `json:"status"`
    IsCompleted   bool       `json:"is_completed"`
    CompletedAt   *time.Time `json:"completed_at"`
    PriorityOrder int        `json:"priority_order"`
    BlockerReason *string    `json:"blocker_reason"`
}

type DaySessionWithTasks struct {
    Session DaySession `json:"session"`
    Tasks   struct {
        Yesterday []DayTaskWithDetails `json:"yesterday"`
        Today     []DayTaskWithDetails `json:"today"`
        Blocked   []DayTaskWithDetails `json:"blocked"`
    } `json:"tasks"`
}
```

### 2.2 Composite Indexes (`firestore.indexes.json`)
```json
{
  "indexes": [
    {
      "collectionGroup": "tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "is_archived", "order": "ASCENDING" },
        { "fieldPath": "backlog_order", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "day_tasks",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "priority_order", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

---

## 3. API Contracts & Endpoints

### 3.1 Global Backlog Endpoints
- `GET /api/backlog` — Returns `{ "tasks": [Task, ...] }` ordered by `backlog_order` ascending.
- `POST /api/backlog/tasks` — Create task directly in the backlog pool (`{ "title": string, "description": string }`).
- `PUT /api/backlog/reorder` — Reorder backlog items with `{ "ordered_task_ids": ["id1", "id2", ...] }`.

### 3.2 Master Task Endpoints
- `POST /api/tasks` — Quick-add a task, optionally specifying `target_date` and `status` to immediately commit to an active day.
- `GET /api/tasks/:id` — Retrieve task by ID.
- `PATCH /api/tasks/:id` — Update task title, description, or backlog order.
- `DELETE /api/tasks/:id` — Soft-delete/archive task (`is_archived = true`).

### 3.3 Day Session Endpoints
- `GET /api/days/:date` — Retrieve or initialize `DaySession` and joined `DayTaskWithDetails` grouped into `yesterday`, `today`, and `blocked`.
- `PATCH /api/days/:date` — Update session notes or reflection metadata.

---

## 4. UI / UX & Interaction Flow (Collaborate with @ui-designer)
- Delivers strongly-typed TypeScript interfaces in `frontend/src/types/domain.ts`:
  - `DaySession`, `MasterTask`, `DayTaskWithDetails`, `DaySessionWithTasks`, `BacklogResponse`.
- Creates realistic test fixtures (`frontend/src/test/fixtures/daySession.fixture.ts`) to enable rapid frontend component development in Milestone 3 without needing live network calls.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Master Task CRUD in Firestore Repository
- **Given:** A connected Firestore repository pointing to `localhost:8085`.
- **When:** A user creates a master task with title `"Refactor auth client"` and backlog order `1`.
- **Then:** The task is persisted in `/users/{userId}/tasks/{taskId}` with generated UUID and valid timestamps.
- **When:** Fetching the user's backlog via `GET /api/backlog`.
- **Then:** The newly created task is returned in the list ordered by `backlog_order`.

### Scenario 2: Single-Call DaySession Joined Querying
- **Given:** A valid date string `"2026-08-28"` with 1 Yesterday task, 2 Today tasks, and 1 Blocked task.
- **When:** Calling `GET /api/days/2026-08-28`.
- **Then:** The endpoint returns HTTP `200` with the `DaySessionWithTasks` payload containing:
  - `session.date = "2026-08-28"`
  - `tasks.yesterday` (length 1)
  - `tasks.today` (length 2, ordered by `priority_order` ascending)
  - `tasks.blocked` (length 1, with `blocker_reason` populated)
- **And:** The backend performs a batched get for task metadata, avoiding N+1 individual Firestore document reads.

### Scenario 3: User Data Isolation
- **Given:** Two distinct user IDs `user-A` and `user-B`.
- **When:** `user-A` creates tasks and day sessions.
- **Then:** Queries executed with `user-B` context return 0 records, verifying complete Firestore subcollection tenant isolation.

---

## 6. Definition of Done Checklist
- [ ] Go models, repository interfaces, and Firestore implementations complete with batch get logic (`@developer`)
- [ ] Firestore emulator integration test suite passing with 100% success rate -> output saved to `test-results/repository-integration-test.log` (`@developer`)
- [ ] Composite indexes verified in `firestore.indexes.json` without missing index warnings (`@devops-engineer`)
- [ ] TypeScript domain interfaces and test fixtures created in `frontend/src/types/` (`@ui-designer` / `@developer`)
- [ ] Acceptance criteria verified with saved QA sign-off report in `test-reports/QA-REPORT-002-domain-models-<YYYY-MM-DD>.md` (`@tester`)
