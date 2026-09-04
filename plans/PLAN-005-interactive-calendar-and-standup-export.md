# PLAN-005: Interactive Calendar & Standup Markdown Export (Milestone 5)

- **Milestone:** Milestone 5 — Interactive Calendar & Standup Markdown Export
- **Document Reference:** `plans/PLAN-005-interactive-calendar-and-standup-export.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@ui-designer`, `@devops-engineer`
- **Ceremony:** Backlog Refinement & Story Scoping (Workflow 01)
- **Status:** **Definition of Ready (DoR) APPROVED**

---

## 1. Feature Overview & User Stories

### 1.1 User Stories
- **Interactive Calendar & Month Overview:**
  *As a daily planner, I want a top-navigation interactive month-view calendar with daily check-in and task completion status indicators, so that I can see my historical consistency at a glance and jump across days effortlessly.*
- **Historical Day Inspection & Read-Only Safety:**
  *As a knowledge worker, I want clicking a past date to display that day's session and tasks in an explicit read-only snapshot mode with a "Return to Today" action, so that I can audit past accomplishments without accidentally mutating or corrupting historical records.*
- **1-Click Standup Markdown Export:**
  *As an agile team member, I want a 1-click standup export tool that formats my active workday's tasks (Yesterday, Today, Blocked) into standardized Markdown with live preview and clipboard copy feedback, so that I can post my daily standup in Slack, Teams, or email in seconds.*

### 1.2 Scope Boundaries
- **In-Scope:**
  1. **Calendar Summary API (`GET /api/calendar/summary?month=YYYY-MM`):**
     - Aggregates day session statuses (`has_session`, `has_check_in`, `has_check_out`, `completed_task_count`, `total_task_count`) across the requested month.
     - Validates `month` parameter (`YYYY-MM`) with bounds checking.
     - Returns serialized empty slices (`[]`) instead of `null` per project rules.
  2. **Top Navigation Calendar Widget (`frontend/src/components/calendar/`):**
     - `CalendarWidget`: Compact popover or header widget displaying the monthly calendar grid.
     - `MonthNavigation`: Next/previous month controls, month-year selector, and "Jump to Today" shortcut.
     - `CalendarDayCell`: Date number, today highlight, active selection ring, and subtle status dots (Green = Checked In & Completed, Blue = Checked Out with Reflection, Amber = Checked In / In Progress, Slate = Incomplete).
     - Tooltip indicators on hover detailing session status and task completion ratios (e.g., *"4/5 tasks completed • Checked out"*).
  3. **Temporal Navigation & `DateContext` (`frontend/src/context/DateContext.tsx`):**
     - Centralized date state management (`selectedDate`, `today`, `isToday`, `isHistorical`).
     - Actions: `selectDate(dateStr)` and `jumpToToday()`.
  4. **Historical Read-Only Board Enforcement:**
     - When `isHistorical` is active (`selectedDate < today`):
       - Sticky top banner: *"Viewing Historical Session: [Date] (Read-Only) — [Return to Today]"*.
       - Board controls disabled: task checkbox toggling disabled, task drag-and-drop handles disabled (`isDragDisabled = true`), inline `+ Add Task` forms hidden, task demotion/deletion actions disabled.
       - Day session action bar displays historical status timestamp badges with action buttons disabled.
       - Morning Check-In auto-prompt modal suppressed for past days.
  5. **1-Click Standup Markdown Export Modal (`frontend/src/components/standup/`):**
     - Header/action bar trigger button: `[Export Standup]`.
     - Standup modal displaying formatted Markdown preview and raw source.
     - Formats active day data into standard sections:
       - `**Yesterday:**` (tasks completed on prior active workday).
       - `**Today:**` (tasks planned or completed today with priority order numbers).
       - `**Blocked:**` (tasks currently blocked with explicit blocker reasons).
     - Customization toggles: Include completed tasks, include blocker reason notes, bullet format.
     - 1-Click "Copy Markdown" button with animated checkmark feedback and clipboard toast confirmation.
- **Out-of-Scope:**
  - Single-binary production Docker builds and Google Cloud Run deployment packaging (deferred to Milestone 6 / PLAN-006).
  - External webhook integrations (Slack App / Microsoft Teams bot direct push) — client clipboard export fulfills requirements per specification.

---

## 2. Architecture & Data Model Impacts

### 2.1 Backend Domain Models & DTOs (`internal/model/domain.go`)
No database schema migrations required. New request/response DTOs for calendar summary:

```go
// DaySummary represents the daily session and task metrics for a single calendar date
type DaySummary struct {
    Date               string `json:"date"` // Format: YYYY-MM-DD
    HasSession         bool   `json:"has_session"`
    HasCheckIn         bool   `json:"has_check_in"`
    HasCheckOut        bool   `json:"has_check_out"`
    CompletedTaskCount int    `json:"completed_task_count"`
    TotalTaskCount     int    `json:"total_task_count"`
}

// CalendarSummaryResponse wraps month-level day summaries
type CalendarSummaryResponse struct {
    Month string       `json:"month"` // Format: YYYY-MM
    Days  []DaySummary `json:"days"`
}
```

### 2.2 Frontend TypeScript Interfaces (`frontend/src/types/domain.ts`)
```typescript
export interface DaySummary {
  date: string;
  has_session: boolean;
  has_check_in: boolean;
  has_check_out: boolean;
  completed_task_count: number;
  total_task_count: number;
}

export interface CalendarSummaryResponse {
  month: string;
  days: DaySummary[];
}

export interface StandupExportOptions {
  includeCompleted: boolean;
  includeBlockerReasons: boolean;
  bulletStyle: '-' | '*';
}
```

### 2.3 Calendar Aggregation Service (`internal/service/calendar_service.go`)
1. Validates `month` parameter against format `^20\d{2}-(0[1-9]|1[0-2])$`.
2. Computes canonical date range `[YYYY-MM-01, YYYY-MM-{daysInMonth}]`.
3. Calls `DaySessionRepository.ListByDateRange(ctx, userID, startDate, endDate)` to retrieve recorded sessions in that month.
4. Concurrently collects `DayTasks` for active sessions using `errgroup` or bounded goroutines to tabulate `completed_task_count` and `total_task_count`.
5. Maps all days in the month into a contiguous `[]DaySummary` (initializing non-session days with default zero values) and guarantees an empty slice initialized via `make([]DaySummary, 0)` if no days match.

### 2.4 Standup Markdown Generator (`frontend/src/utils/standupGenerator.ts`)
Client-side formatting utility converting `DaySessionWithTasks` into structured Markdown:
```markdown
**Yesterday:**
- Completed user auth endpoint
- Reviewed PR #104

**Today:**
- [ ] Implement calendar widget UI (Priority 1)
- [x] Wire check-in wizard state (Priority 2)

**Blocked:**
- Database migration on staging (Waiting on DevOps permissions)
```

---

## 3. API Contracts & Endpoints

### 3.1 Monthly Summary Endpoint
- **HTTP Method & Route:** `GET /api/calendar/summary?month=YYYY-MM`
- **Query Parameters:**
  - `month` (string, required): Format `YYYY-MM` (e.g. `2026-09`).
- **Success Response (`200 OK`):**
  ```json
  {
    "month": "2026-09",
    "days": [
      {
        "date": "2026-09-01",
        "has_session": true,
        "has_check_in": true,
        "has_check_out": true,
        "completed_task_count": 4,
        "total_task_count": 5
      },
      {
        "date": "2026-09-02",
        "has_session": true,
        "has_check_in": true,
        "has_check_out": false,
        "completed_task_count": 2,
        "total_task_count": 3
      },
      {
        "date": "2026-09-03",
        "has_session": false,
        "has_check_in": false,
        "has_check_out": false,
        "completed_task_count": 0,
        "total_task_count": 0
      }
    ]
  }
  ```
- **Error Responses:**
  - `400 Bad Request`: `{ "error": "invalid month format, expected YYYY-MM" }`
  - `401 Unauthorized`: `{ "error": "unauthorized" }`

---

## 4. UI / UX & Interaction Flow (Collaborate with `@ui-designer`)

### 4.1 Component Hierarchy
```text
frontend/src/
├── context/
│   └── DateContext.tsx                # Centralized temporal state (selectedDate, isToday, isHistorical)
├── components/
│   ├── calendar/
│   │   ├── CalendarWidget.tsx          # Interactive month-view calendar with popover panel
│   │   ├── MonthNavigation.tsx         # Month selector, prev/next arrows & Jump to Today
│   │   ├── CalendarDayCell.tsx         # Day cell with status indicators & selection rings
│   │   └── CalendarStatusLegend.tsx    # Compact legend explaining status dot meanings
│   ├── standup/
│   │   ├── StandupExportModal.tsx      # Standup export dialog with options & live preview
│   │   ├── StandupPreview.tsx          # Dual view: formatted rich text & raw markdown
│   │   └── CopyButton.tsx              # Animated copy button with checkmark transition
│   ├── navigation/
│   │   └── HistoricalDateBanner.tsx    # Prominent banner indicating read-only inspection mode
│   └── board/
│       ├── DailyBoard.tsx              # Updated to consume DateContext & enforce read-only
│       └── DaySessionActionBar.tsx     # Enhanced with Standup Export button trigger
```

### 4.2 Tailwind Tokens & Visual Design
- **Status Dot Colors on Calendar Cells:**
  - `bg-emerald-400 shadow-sm shadow-emerald-500/50`: Both morning check-in and evening check-out completed.
  - `bg-amber-400 shadow-sm shadow-amber-500/50`: Checked in, session active / in progress.
  - `bg-sky-400 shadow-sm shadow-sky-500/50`: Checked out with reflection.
  - `bg-slate-600`: Session created but incomplete check-in.
- **Active Selection & Today Indicators:**
  - Selected Cell: `ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900 bg-indigo-500/15 font-semibold text-white`.
  - Today Indicator: Distinct border or badge (`border-b-2 border-indigo-400 font-bold text-indigo-300`).
- **Historical Read-Only Banner:**
  - Styling: `bg-amber-500/10 border border-amber-500/30 text-amber-200 px-4 py-3 rounded-xl flex items-center justify-between shadow-lg`.
  - Content: Lucide `History` icon, message *"Viewing Historical Session: [Date] (Read-Only)"*, and an explicit `[Return to Today]` button (`bg-amber-500/20 hover:bg-amber-500/30 text-amber-100`).
- **Read-Only Board Enforcement:**
  - Checkbox controls in `TodayRow` and `BlockedRow` disabled with `cursor-not-allowed opacity-75`.
  - Drag-and-drop handles disabled (`isDragDisabled = true`).
  - Inline `+ Add Task` forms hidden.
  - "Start Check-In" and "Check-Out" wizard triggers in `DaySessionActionBar` disabled or hidden.
- **Standup Export Modal:**
  - Backdrop blur modal (`glass-panel bg-slate-900/90 border-slate-700`).
  - Dual tabs: "Rich Preview" and "Markdown Code".
  - One-click copy with animated icon transformation (`Copy` $\rightarrow$ `CheckCircle2` with green highlight) and 2.5s auto-reset.

---

## 5. DevOps & Infrastructure Considerations (Collaborate with `@devops-engineer`)

### 5.1 Firestore Query Patterns & Composite Indexes
- Audit of `DaySessionRepository.ListByDateRange`:
  - Query: `Where("date", ">=", startDate).Where("date", "<=", endDate).OrderBy("date", Asc)`.
  - Targets single subcollection `users/{uid}/day_sessions`.
  - Single-field range filters with ordering on the same field are automatically indexed by Firestore.
  - **Result:** No additions to `firestore.indexes.json` are required.
- Task counts query pattern:
  - Fetches `day_tasks` subcollections for matched dates in the month.
  - Number of active workdays per month is $\le 23$. Bounded parallel execution executes in $< 50\text{ms}$ on the local Firestore emulator (`localhost:8085`).

### 5.2 Environment & Build Integrity
- Backend Go server runs on `:8080`, Firestore emulator on `:8085`, Auth emulator on `:9099`.
- Frontend dev server proxies `/api` to Go backend via Vite configuration.
- Strict slice initialization rule enforced: `Days` slice initialized as `make([]DaySummary, 0)` so JSON serialization produces `[]` rather than `null`.

---

## 6. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Month View Status Dot Rendering (Happy Path)
- **Given:** A user has recorded sessions in September 2026:
  - `2026-09-01` with check-in and check-out (4/5 completed tasks).
  - `2026-09-02` with check-in only (2/3 completed tasks).
- **When:** The calendar widget renders the month of September 2026.
- **Then:** Date cell `2026-09-01` renders a green status dot indicating full completion.
- **And:** Date cell `2026-09-02` renders an amber status dot indicating active/in-progress.
- **And:** Date cell `2026-09-03` renders no status dot.

### Scenario 2: Historical Day Navigation & Read-Only Board Enforcement (State Transition)
- **Given:** The user is viewing today's active execution board (`2026-09-04`).
- **When:** The user selects a past date (`2026-09-01`) on the calendar.
- **Then:** The board transitions to `2026-09-01` and displays the `HistoricalDateBanner`.
- **And:** Task checkboxes are disabled and drag-and-drop handles cannot be dragged.
- **And:** The "+ Add Task" inputs are hidden.
- **And:** The Morning Check-In modal is not automatically triggered.

### Scenario 3: Date Navigation & Return to Today (State Transition)
- **Given:** The user is currently inspecting a historical date (`2026-09-01`).
- **When:** The user clicks the "Return to Today" button on the banner or calendar widget.
- **Then:** The board returns to today's date (`2026-09-04`).
- **And:** Full interactive board controls (checkboxes, drag-and-drop, add task) are re-enabled.

### Scenario 4: 1-Click Standup Markdown Copy to Clipboard (Happy Path)
- **Given:** The active day session has:
  - 2 tasks in Yesterday.
  - 2 tasks in Today (1 completed, 1 pending).
  - 1 task in Blocked with reason "Waiting on API keys".
- **When:** The user clicks the "Export Standup" button and clicks "Copy Markdown".
- **Then:** The clipboard receives formatted Markdown matching:
  ```markdown
  **Yesterday:**
  - Task 1
  - Task 2

  **Today:**
  - [ ] Task 3 (Priority 1)
  - [x] Task 4 (Priority 2)

  **Blocked:**
  - Task 5 (Waiting on API keys)
  ```
- **And:** The copy button transforms into a green checkmark indicating "Copied to Clipboard!".

### Scenario 5: Standup Generation with Empty Rows (Edge Case)
- **Given:** A freshly initialized day session with 0 tasks in Yesterday and 0 tasks in Blocked.
- **When:** The user generates the standup summary.
- **Then:** The standup generator gracefully handles empty categories without null pointer or runtime errors.

### Scenario 6: Non-Existent Historical Date Graceful Fallback (Edge Case)
- **Given:** The user navigates to a past date that has no recorded `DaySession`.
- **When:** The board loads that date.
- **Then:** The UI displays an empty historical day state indicating no tasks were recorded for that day, without crashing.

---

## 7. Definition of Done (DoD) Checklist

- [ ] **Backend Calendar Summary:**
  - [ ] `DaySummary` and `CalendarSummaryResponse` models added in `internal/model/domain.go`.
  - [ ] `CalendarService` implemented in `internal/service/calendar_service.go` with month boundary validation and date range queries.
  - [ ] HTTP handler `GET /api/calendar/summary` registered in `internal/api/calendar.go`.
  - [ ] Unit & integration tests in `internal/service/calendar_test.go` and `internal/api/calendar_test.go`.
- [ ] **Frontend Temporal Navigation:**
  - [ ] `DateContext` implemented in `frontend/src/context/DateContext.tsx` and wired into `main.tsx` / `App.tsx`.
  - [ ] `CalendarWidget`, `MonthNavigation`, and `CalendarDayCell` components implemented in `frontend/src/components/calendar/`.
  - [ ] Status dot colors and hover tooltips styled per `@ui-designer` tokens.
- [ ] **Historical Read-Only Board Mode:**
  - [ ] `HistoricalDateBanner` component implemented in `frontend/src/components/navigation/`.
  - [ ] `DailyBoard`, `TodayRow`, `BlockedRow`, and `DaySessionActionBar` updated to enforce `isReadOnly` state.
  - [ ] Auto-open check-in wizard suppressed when viewing historical dates.
- [ ] **Standup Markdown Export:**
  - [ ] Standup Markdown generator utility implemented in `frontend/src/utils/standupGenerator.ts`.
  - [ ] `StandupExportModal` and `CopyButton` components implemented in `frontend/src/components/standup/`.
  - [ ] Clipboard API integration with animated copy confirmation and fallback.
- [ ] **Quality Assurance & Verification:**
  - [ ] Go backend tests pass with sanitized logs (`go test -v ./...`).
  - [ ] Frontend Vitest test suite passes (`npm test`).
  - [ ] Headless browser `/browser` journeys validate calendar month navigation, historical read-only mode, and standup export copying.
  - [ ] QA Acceptance report archived in `test-reports/QA-REPORT-005-calendar-and-standup-<YYYY-MM-DD>.md`.

---

## 8. Definition of Ready (DoR) Sign-off Gate

| Role | Agent | Sign-off Status | Notes |
| :--- | :--- | :--- | :--- |
| **Product Owner** | `@product-owner` | **APPROVED** | User stories, scope boundaries, and Gherkin scenarios defined. |
| **Lead UI/UX Designer** | `@ui-designer` | **APPROVED** | Component structure, status dot palette, historical banners, and copy animations specified. |
| **DevOps & Cloud Engineer** | `@devops-engineer` | **APPROVED** | Query efficiency verified; confirmed no composite index required for date range queries. |

### Definition of Ready (DoR) Audit
- [x] User stories and scope boundaries clearly defined.
- [x] Model impacts and Firestore collection mappings specified.
- [x] API endpoint contracts and DTO schemas defined.
- [x] UI interaction and design token specifications documented.
- [x] Explicit Gherkin scenarios defined for happy and edge cases.
