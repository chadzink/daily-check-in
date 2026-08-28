# PLAN: Morning Check-In & End-of-Day Ritual Wizards (Milestone 4)

## 1. Feature Overview & User Story
- **Story:** As a knowledge worker, I want guided Morning Check-In and Evening Check-Out ritual wizards so that I can start my workday with intentional focus through automated task rollover and backlog triage, and end my day with clean reflection and state closure.
- **Scope:**
  - **In-Scope:**
    - Morning Check-In Wizard (Multi-Step Flow):
      - Auto-detection of un-checked-in workday.
      - Previous workday analysis: Completed tasks placed in *Yesterday*; incomplete tasks triaged for rollover to *Today*, demotion to *Backlog*, or late completion.
      - Backlog triage: Select items from Global Backlog to pull into *Today*.
      - Rank prioritization: Reorder today's commitments (1..N).
      - Atomic check-in transaction stamping `check_in_at = now()`.
    - End-of-Day Check-Out Wizard (Multi-Step Flow):
      - Accomplishment review of completed tasks.
      - Incomplete task triage: Leave in *Today* for next day's rollover vs. demote to Backlog.
      - Daily reflection notes input.
      - Atomic check-out transaction stamping `check_out_at = now()`.
    - Backend Ritual Service Layer (`internal/service/ritual.go`):
      - Previous active workday lookup algorithm (traversing backward across weekends, holidays, or vacations).
      - Firestore multi-document transaction handling rollover and session stamping.
    - Wizard UI Components in `frontend/src/components/wizards/`.
  - **Out-of-Scope:**
    - Standup Markdown generation & Month-view calendar (handled in Milestone 5 / PLAN-005).

---

## 2. Architecture & Data Model Impacts
- **Backend Service Layer (`internal/service/`):**
  - `RitualService`:
    - `GetMorningCheckInContext(ctx, userId, date)`: Searches backward up to 30 days to locate the most recent active `DaySession` with `check_in_at != nil`. Compiles yesterday's completed tasks, incomplete rollover candidates, and unassigned backlog tasks.
    - `ExecuteMorningCheckIn(ctx, userId, date, req)`: Firestore atomic transaction creating `DaySession`, writing `DayTask` entries for Yesterday, Today, and Blocked, and stamping `check_in_at`.
    - `ExecuteCheckOut(ctx, userId, date, req)`: Updates incomplete tasks (demoting selected tasks to backlog), saves reflection notes, and stamps `check_out_at`.
- **Frontend Wizard Components (`frontend/src/components/wizards/`):**
  ```text
  frontend/src/components/wizards/
  ├── MorningCheckInModal.tsx       # Multi-step container modal
  ├── StepYesterdayAccomplish.tsx   # Step 1: Review yesterday's completed accomplishments
  ├── StepRolloverTriage.tsx        # Step 2: Triage incomplete tasks (rollover vs. demote)
  ├── StepBacklogPull.tsx           # Step 3: Select tasks from Global Backlog
  ├── StepFinalizePriorities.tsx    # Step 4: Final 1..N order and check-in confirmation
  ├── CheckOutModal.tsx             # Multi-step evening reflection modal
  ├── StepCheckOutReview.tsx        # Review accomplishments & triage unfinished
  └── StepReflectionNotes.tsx       # Daily reflection and checkout confirmation
  ```

---

## 3. API Contracts & Endpoints (Aligned with SPECIFICATION.md)

### 3.1 Morning Check-In APIs
- **`GET /api/days/:date/check-in/context`**
  - **Response `200 OK`:**
    ```json
    {
      "previous_date": "2026-08-27",
      "yesterday_tasks": [
        { "task_id": "t-1", "title": "Review PR #104", "completed_at": "2026-08-27T16:30:00Z" }
      ],
      "rollover_candidates": [
        { "task_id": "t-2", "title": "Implement calendar UI", "priority_order": 1 }
      ],
      "backlog_tasks": [
        { "id": "t-5", "title": "Add dark mode support", "backlog_order": 1 }
      ]
    }
    ```
- **`POST /api/days/:date/check-in`**
  - **Request Payload:**
    ```json
    {
      "today_task_ids": ["t-2", "t-5"],
      "blocked_tasks": [
        { "task_id": "t-3", "blocker_reason": "Waiting on PR review" }
      ],
      "priority_order": ["t-2", "t-5"]
    }
    ```
  - **Response `200 OK`:** Full `DaySessionWithTasks` with `check_in_at` timestamp.
  - **Errors:** `409 Conflict` if session is already checked in.

### 3.2 End-of-Day Check-Out APIs
- **`POST /api/days/:date/check-out`**
  - **Request Payload:**
    ```json
    {
      "notes": "Finished calendar UI ahead of schedule.",
      "demote_to_backlog_task_ids": ["t-6"]
    }
    ```
  - **Response `200 OK`:** Updated `DaySessionWithTasks` with `check_out_at` timestamp.
  - **Errors:** `400 Bad Request` if session was never checked in.

---

## 4. UI / UX & Interaction Flow (Collaborate with @ui-designer)
- **Wizard Stepper Design:**
  - Progress Indicator: Stepper header showing Step 1 of 4 with smooth slide animations.
  - Rollover Action Cards: Clear toggle buttons (`Roll Over to Today` / `Demote to Backlog` / `Mark Completed`).
  - Backlog Selection: Multi-select checklist with search filter to quickly pull items into today.
  - Confetti / Completion Celebration: Subtle micro-animation when completing morning check-in and landing on the active board.
  - Non-Intrusive Prompt Banner: If the user dismisses the initial check-in modal, an un-checked-in banner stays at the top of the board allowing them to launch the wizard at any time.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Multi-Day Rollover Across Weekend or Vacation
- **Given:** Friday (`2026-08-21`) has 2 completed tasks and 2 incomplete tasks, with no activity over the weekend.
- **When:** The user opens the app on Monday (`2026-08-24`) and queries check-in context.
- **Then:** The algorithm correctly skips Saturday and Sunday, identifying `2026-08-21` as `previous_date`.
- **And:** The 2 completed tasks appear in `yesterday_tasks`.
- **And:** The 2 incomplete tasks appear in `rollover_candidates`.

### Scenario 2: Atomic Check-In Execution & Conflict Guard
- **Given:** The user completes all steps of the Morning Check-In wizard and submits.
- **When:** `POST /api/days/:date/check-in` executes.
- **Then:** In a single Firestore transaction:
  - `DaySession` is created with `check_in_at = now()`.
  - `DayTask` entries for Today, Blocked, and Yesterday are committed.
- **When:** A client attempts to check in again for the same date.
- **Then:** The backend responds with `409 Conflict` (`"Session already checked in"`).

### Scenario 3: End-of-Day Check-Out and Demotion
- **Given:** An active workday with 1 incomplete task in *Today*.
- **When:** The user starts Check-Out, marks the incomplete task for demotion, adds reflection notes, and submits.
- **Then:** The `DayTask` commitment is removed, returning the task to the unassigned backlog.
- **And:** `check_out_at` is stamped and reflection notes are persisted.
- **And:** The board switches to checked-out read-only view.

---

## 6. Definition of Done Checklist
- [ ] Backend `RitualService` with Firestore transaction logic and table-driven unit tests (`@developer`)
- [ ] Check-in and check-out wizard modals and stepper UX implemented (`@developer` / `@ui-designer`)
- [ ] Multi-day skip rollover algorithm tested with emulator scenarios (`@developer` / `@tester`)
- [ ] Headless browser `/browser` verification of the complete morning and evening user flows (`@tester`)
- [ ] Acceptance criteria verified with saved QA report in `test-reports/QA-REPORT-004-ritual-wizards-<YYYY-MM-DD>.md` (`@tester`)
