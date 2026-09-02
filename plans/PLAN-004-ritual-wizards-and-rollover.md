# PLAN-004: Morning Check-In & End-of-Day Ritual Wizards (Milestone 4)

- **Milestone:** Milestone 4 — Morning Check-In & End-of-Day Ritual Wizards
- **Document Reference:** `plans/PLAN-004-ritual-wizards-and-rollover.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@ui-designer`, `@devops-engineer`
- **Ceremony:** Backlog Refinement & Story Scoping (Workflow 01)
- **Status:** **Definition of Ready (DoR) APPROVED**

---

## 1. Feature Overview & User Stories

### 1.1 User Stories
- **Morning Check-In:**
  *As a knowledge worker starting my workday, I want a structured Morning Check-In wizard that reviews yesterday's accomplishments, triages incomplete tasks for rollover, and lets me pull and prioritize backlog items into Today, so that I can establish focus with zero morning friction.*
- **End-of-Day Check-Out:**
  *As a knowledge worker finishing my workday, I want a guided End-of-Day Check-Out wizard to review what got done, clean up unfinished tasks, and record daily reflections, so that I experience psychological closure and leave a clean state for tomorrow.*

### 1.2 Scope Boundaries
- **In-Scope:**
  1. **Morning Check-In Flow (4 Steps):**
     - Auto-detection: If today's `DaySession` has `check_in_at == nil`, prompt user via welcoming banner / modal.
     - Step 1 (Accomplishments): Review tasks completed on the previous active workday (`status = YESTERDAY`).
     - Step 2 (Rollover Triage): Triage incomplete tasks from the previous active workday (Action options: *Roll over to Today*, *Demote to Backlog*, or *Mark Completed Late*).
     - Step 3 (Backlog Pull): Select items from the Global Backlog to commit to Today.
     - Step 4 (Prioritize Commitments): Final 1..N priority order confirmation, optional morning notes, and atomic submission.
  2. **End-of-Day Check-Out Flow (2 Steps):**
     - Step 1 (Accomplishment Review & Incomplete Triage): Review tasks completed today; triage any remaining incomplete tasks (*Leave in Today for Rollover* vs. *Demote to Backlog* vs. *Mark Completed*).
     - Step 2 (Daily Reflection & Sign-off): Optional daily notes/reflections and commit `check_out_at = now()`.
  3. **Backend Service & Repository Layer:**
     - Dedicated `RitualService` (`internal/service/ritual_service.go`).
     - Previous active workday lookup algorithm: Traversing backward up to 30 calendar days to locate the most recent `DaySession` with `check_in_at != nil`.
     - Atomic Firestore transactions for check-in creation, `DayTask` creation, and session timestamping.
     - Anti-conflict validation: `409 Conflict` if session already checked in.
  4. **Frontend Components & UX (`frontend/src/components/wizards/`):**
     - `MorningCheckInModal` with 4-step stepper, animated transitions, card triage selectors, and confetti celebration.
     - `CheckOutModal` with 2-step review and reflection input.
     - Top action bar integration: "Start Morning Check-In" / "Check-Out" action buttons and check-in / check-out timestamp badges.
     - Dismissable "Ready to start your day?" banner if modal is closed prior to submission.
- **Out-of-Scope:**
  - Interactive month-view calendar widget and Standup Markdown export (scheduled for Milestone 5 / PLAN-005).
  - Multi-user team workspace / org management (single-user focus per specification).

---

## 2. Architecture & Data Model Impacts

### 2.1 Domain Models (`internal/model/domain.go`)
No breaking changes to database schemas; uses existing Firestore collections:
- `users/{uid}/day_sessions/{date}`
- `users/{uid}/day_sessions/{date}/day_tasks/{dayTaskId}`
- `users/{uid}/tasks/{taskId}`

### 2.2 New Request & Response DTOs
```go
// CheckInContextResponse provides pre-flight data to populate Morning Check-In wizard
type CheckInContextResponse struct {
    TargetDate         string               `json:"target_date"`
    PreviousDate       string               `json:"previous_date,omitempty"`
    YesterdayTasks     []DayTaskWithDetails `json:"yesterday_tasks"`
    RolloverCandidates []DayTaskWithDetails `json:"rollover_candidates"`
    BacklogTasks       []*Task              `json:"backlog_tasks"`
    IsAlreadyCheckedIn bool                 `json:"is_already_checked_in"`
}

// RolloverAction represents triage decision for an incomplete task
type RolloverAction string
const (
    RolloverToToday   RolloverAction = "ROLLOVER"
    RolloverDemote    RolloverAction = "DEMOTE"
    RolloverCompleted RolloverAction = "COMPLETE"
)

type RolloverDecision struct {
    DayTaskID string         `json:"day_task_id"`
    TaskID    string         `json:"task_id"`
    Action    RolloverAction `json:"action"`
}

// ExecuteCheckInRequest defines payload submitted from Morning Check-In wizard
type ExecuteCheckInRequest struct {
    RolloverDecisions []RolloverDecision `json:"rollover_decisions"`
    PullTaskIDs       []string           `json:"pull_task_ids"`
    TodayTaskIDs      []string           `json:"today_task_ids"` // Final 1..N order
    BlockedTaskIDs    []string           `json:"blocked_task_ids,omitempty"`
    Notes             string             `json:"notes,omitempty"`
}

// ExecuteCheckOutRequest defines payload submitted from Evening Check-Out wizard
type ExecuteCheckOutRequest struct {
    DemoteTaskIDs    []string `json:"demote_task_ids"`
    CompleteTaskIDs  []string `json:"complete_task_ids"`
    Notes            string   `json:"notes,omitempty"`
}
```

### 2.3 Previous Active Workday Lookup Algorithm
```text
Algorithm FindPreviousActiveDate(userID, targetDate):
1. Parse targetDate (YYYY-MM-DD).
2. Query user's day_sessions collection:
   - Filter: date < targetDate
   - Order: date DESC
   - Limit: 30 days
3. Iterate returned sessions:
   - If session.CheckInAt != nil, return session.Date.
4. If no prior checked-in session found, return "" (first day user).
```
- **DevOps / Indexing Note (`@devops-engineer`):**
  - Querying `users/{uid}/day_sessions` with `date < targetDate` ordered by `date DESC` uses Firestore single-field automatic ordering on the document key / `date` property.
  - In-memory inspection of `CheckInAt != nil` across $\le 30$ documents avoids complex composite inequalities and index overhead.

---

## 3. API Contracts & Endpoints

### 3.1 Morning Check-In APIs
- **`GET /api/days/:date/check-in/context`**
  - **Description:** Prepares the data required to initialize the Morning Check-In wizard.
  - **Response `200 OK`:**
    ```json
    {
      "target_date": "2026-09-01",
      "previous_date": "2026-08-31",
      "yesterday_tasks": [
        { "day_task_id": "dt-1", "task_id": "t-1", "title": "Wire task service", "status": "YESTERDAY", "is_completed": true, "completed_at": "2026-08-31T17:00:00Z" }
      ],
      "rollover_candidates": [
        { "day_task_id": "dt-2", "task_id": "t-2", "title": "Draft release notes", "status": "TODAY", "is_completed": false, "priority_order": 1 }
      ],
      "backlog_tasks": [
        { "id": "t-5", "title": "Refactor router logging", "backlog_order": 1, "is_completed": false }
      ],
      "is_already_checked_in": false
    }
    ```
- **`POST /api/days/:date/check-in`**
  - **Description:** Commits morning check-in state in a single atomic Firestore transaction.
  - **Request Payload:**
    ```json
    {
      "rollover_decisions": [
        { "day_task_id": "dt-2", "task_id": "t-2", "action": "ROLLOVER" }
      ],
      "pull_task_ids": ["t-5"],
      "today_task_ids": ["t-2", "t-5"],
      "blocked_task_ids": [],
      "notes": "Focused morning sprint."
    }
    ```
  - **Response `200 OK`:** Full `DaySessionWithTasks` object with `session.check_in_at` stamped.
  - **Errors:**
    - `409 Conflict`: `{"error": "Conflict", "message": "Session already checked in"}`

### 3.2 End-of-Day Check-Out APIs
- **`POST /api/days/:date/check-out`**
  - **Description:** Closes the workday session, processes end-of-day task dispositions, saves reflections, and stamps `check_out_at`.
  - **Request Payload:**
    ```json
    {
      "demote_task_ids": ["dt-7"],
      "complete_task_ids": ["dt-8"],
      "notes": "Delivered all core endpoints on schedule."
    }
    ```
  - **Response `200 OK`:** Full `DaySessionWithTasks` object with `session.check_out_at` stamped.
  - **Errors:**
    - `400 Bad Request`: `{"error": "BadRequest", "message": "Cannot check out a session that has not been checked in"}`

---

## 4. UI / UX & Interaction Specifications (`@ui-designer`)

### 4.1 Component Architecture
```text
frontend/src/components/
├── board/
│   ├── DaySessionActionBar.tsx      # Check-in / Check-out status, timestamps & triggers
│   └── MorningCheckInBanner.tsx     # Un-checked-in reminder alert banner
└── wizards/
    ├── MorningCheckInModal.tsx       # 4-step container modal with progress header
    │   ├── Step1YesterdayReview.tsx  # Review accomplishments from previous active day
    │   ├── Step2RolloverTriage.tsx   # Triage incomplete tasks (Rollover / Demote / Complete)
    │   ├── Step3BacklogPull.tsx      # Multi-select items from Global Backlog
    │   └── Step4PrioritizeCommit.tsx # Reorder today's commitments (1..N) & submit
    └── CheckOutModal.tsx             # 2-step evening closure modal
        ├── Step1CheckOutReview.tsx   # Review completed tasks & triage unfinished
        └── Step2DailyReflection.tsx  # Reflection textarea & sign-off submission
```

### 4.2 Visual Design Tokens & Ergonomics
- **Modal Container:**
  - Backdrop: `bg-slate-950/80 backdrop-blur-md`
  - Panel: `glass-panel max-w-2xl w-full rounded-2xl border border-slate-700/80 shadow-2xl p-6`
  - Stepper Header:
    - Active Step Pill: `bg-indigo-500 text-white font-semibold text-xs px-2.5 py-1 rounded-full`
    - Inactive Step Pill: `bg-slate-800 text-slate-400 font-medium text-xs px-2.5 py-1 rounded-full`
    - Progress Bar: Animated `h-1 bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-300`
- **Triage Action Controls (`Step2RolloverTriage`):**
  - Segmented control / button group for each candidate task:
    - *Rollover to Today*: `bg-sky-500/20 text-sky-300 border border-sky-500/40 hover:bg-sky-500/30`
    - *Demote to Backlog*: `bg-violet-500/20 text-violet-300 border border-violet-500/40 hover:bg-violet-500/30`
    - *Mark Completed*: `bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30`
- **Backlog Selection (`Step3BacklogPull`):**
  - Searchable list of backlog items with checkbox selection and priority chips.
- **Success Micro-Interaction:**
  - On morning check-in completion: Confetti celebration burst or subtle emerald glow transition, closing modal and revealing the active board.
- **Keyboard Navigation:**
  - `Enter` / `Cmd+Enter`: Advance to next step or submit on final step.
  - `Esc`: Close modal (reveals the non-intrusive reminder banner on the board).

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Multi-Day Active Session Lookup Across Weekends or Holidays
- **Given:** A user had an active session on Friday (`2026-08-28`) with 2 completed tasks and 2 incomplete tasks, and no activity over the weekend (`2026-08-29` and `2026-08-30`).
- **When:** The user requests `GET /api/days/2026-08-31/check-in/context`.
- **Then:** The backend returns HTTP `200 OK` with:
  - `previous_date = "2026-08-28"`.
  - `yesterday_tasks` containing the 2 completed tasks from Friday.
  - `rollover_candidates` containing the 2 incomplete tasks from Friday.
  - `is_already_checked_in = false`.

### Scenario 2: Morning Check-In Atomic Submission & Duplicate Conflict Guard
- **Given:** The user is on the final step of the Morning Check-In wizard for date `2026-09-01`.
- **When:** The user submits `POST /api/days/2026-09-01/check-in` with 1 rolled-over task, 1 pulled backlog task, and ordered IDs.
- **Then:** The backend executes an atomic Firestore transaction:
  - Updates `DaySession` with `check_in_at = now()`.
  - Creates `DayTask` entries for Today with ranks 1 and 2.
  - Creates `DayTask` entries with status `YESTERDAY` for prior day's completed tasks.
  - Returns `200 OK` with the populated `DaySessionWithTasks`.
- **When:** A client issues a duplicate `POST /api/days/2026-09-01/check-in`.
- **Then:** The backend responds with HTTP `409 Conflict` and message `"Session already checked in"`.

### Scenario 3: End-of-Day Check-Out, Task Demotion, and Session Closure
- **Given:** An active workday session on `2026-09-01` with `check_in_at != nil`, containing 1 completed task and 1 incomplete task in Today.
- **When:** The user completes the Check-Out wizard, selecting the incomplete task for demotion to backlog, adding reflection notes `"Shipped milestone 4"`, and submitting `POST /api/days/2026-09-01/check-out`.
- **Then:** The backend:
  - Deletes the `DayTask` commitment for the demoted task so it remains solely in the Global Backlog.
  - Stretches `DaySession` with `check_out_at = now()` and `notes = "Shipped milestone 4"`.
  - Returns `200 OK`.
- **And:** The frontend UI renders the board with a checked-out status badge ("Checked out at HH:MM").

### Scenario 4: Non-Intrusive Banner and Modal Re-entry
- **Given:** The user opens the app on a date where `check_in_at == nil`.
- **When:** The initial Morning Check-In modal opens and the user presses `Esc` or the dismiss button.
- **Then:** The modal closes without submitting.
- **And:** A top banner displays: *"Ready to start your workday? [Start Morning Check-In]"*.
- **When:** The user clicks *"Start Morning Check-In"* or the Day Action Bar button.
- **Then:** The Morning Check-In modal re-opens retaining context data.

---

## 6. Definition of Done (DoD) Checklist

- [ ] **Backend Services & Endpoints (`@developer`):**
  - `RitualService` implemented in `internal/service/ritual_service.go` with unit tests for previous-date search and atomic check-in/out.
  - Handlers for `GET /api/days/:date/check-in/context`, `POST /api/days/:date/check-in`, and `POST /api/days/:date/check-out` registered in `internal/api/ritual.go`.
  - Empty slices initialized (`make([]T, 0)`) for all response arrays.
- [ ] **Frontend Components & State (`@developer` / `@ui-designer`):**
  - Wizard modals (`MorningCheckInModal`, `CheckOutModal`) and step sub-components implemented in `frontend/src/components/wizards/`.
  - `DaySessionActionBar` and `MorningCheckInBanner` integrated into `DailyBoard` / `App.tsx`.
  - TanStack Query hooks (`useCheckInContext`, `useExecuteCheckIn`, `useExecuteCheckOut`) implemented.
  - Defensive optional chaining (`data?.field || []`) utilized across all UI components.
- [ ] **Build & Quality Gates (`@devops-engineer` / `@tester`):**
  - `npm run build` passes with zero TypeScript warnings or errors.
  - `go test -v ./...` passes 100%.
  - Production binary `bin/dailycheckin` builds with embedded frontend assets.
  - Headless browser validation (`/browser`) executes full Morning Check-In and Evening Check-Out journeys.
  - QA acceptance report archived in `test-reports/QA-REPORT-004-ritual-wizards-<YYYY-MM-DD>.md`.
