# PLAN: Interactive Calendar & Standup Markdown Export (Milestone 5)

## 1. Feature Overview & User Story
- **Story:** As a daily planner, I want an interactive month-view calendar with status dots for historical tracking and a 1-click Markdown standup generator so that I can inspect past day sessions in read-only mode and effortlessly share formatted daily updates on Slack, Teams, or email.
- **Scope:**
  - **In-Scope:**
    - Top-Left Month-View Calendar Component (`CalendarWidget.tsx`):
      - Month navigation (prev/next month) and "Jump to Today" action.
      - Daily check-in status dots (e.g., Green = Checked In & Completed, Blue = Checked Out with Reflection, Yellow = Checked In / In-Progress, Ring = Selected Date).
      - Historical read-only inspection mode when clicking past dates (disables checkbox toggles, add task, and drag-and-drop actions).
    - Calendar Summary API (`GET /api/calendar/summary?month=YYYY-MM`):
      - Aggregates day session statuses, task counts, and check-in timestamps across the requested month.
    - 1-Click Standup Markdown Export Modal (`StandupExportModal.tsx`):
      - Formats active day data into standard Markdown with sections for **Yesterday**, **Today**, and **Blocked**.
      - Standup preview rendering, customized copy options, and clipboard API integration with copy confirmation animation.
  - **Out-of-Scope:**
    - Single-binary production Docker builds (handled in Milestone 6 / PLAN-006).

---

## 2. Architecture & Data Model Impacts
- **Frontend Component Structure:**
  ```text
  frontend/src/components/
  ├── calendar/
  │   ├── CalendarWidget.tsx        # Month-view date picker with status markers
  │   ├── CalendarDayCell.tsx       # Individual day cell with status dots & selection rings
  │   └── MonthNavigation.tsx       # Header with month/year selector & 'Jump to Today' button
  ├── standup/
  │   ├── StandupExportModal.tsx    # Standup summary dialog with live preview
  │   └── CopyButton.tsx            # Clipboard copy trigger with animated checkmark feedback
  └── navigation/
      └── DateHeader.tsx            # Current active date banner with historical read-only badge
  ```
- **Context & State Management (`frontend/src/context/`):**
  - `DateContext`: Manages `selectedDate`, `isHistoricalDate` (boolean), `isToday` (boolean), and provides `selectDate(dateStr)` and `jumpToToday()` actions.

---

## 3. API Contracts & Endpoints (Aligned with SPECIFICATION.md)

### 3.1 Monthly Summary Endpoint
- **HTTP Method & Path:** `GET /api/calendar/summary?month=2026-08`
- **Response Payload (`200 OK`):**
  ```json
  {
    "month": "2026-08",
    "days": [
      {
        "date": "2026-08-27",
        "has_session": true,
        "checked_in": true,
        "checked_out": true,
        "completed_task_count": 4,
        "total_task_count": 5
      },
      {
        "date": "2026-08-28",
        "has_session": true,
        "checked_in": true,
        "checked_out": false,
        "completed_task_count": 2,
        "total_task_count": 4
      }
    ]
  }
  ```

### 3.2 Standup Markdown Generation Utility
- Formatted client-side from active `DaySessionWithTasks` state for instant copying without network delay:
  ```markdown
  **Yesterday:**
  - Completed user auth endpoint
  - Reviewed PR #104

  **Today:**
  - [ ] Implement calendar widget UI (Priority 1)
  - [ ] Wire check-in wizard state (Priority 2)

  **Blocked:**
  - Database migration on staging (Waiting on DevOps permissions)
  ```

---

## 4. UI / UX & Interaction Flow (Collaborate with @ui-designer)
- **Calendar Visual Polish:**
  - Compact footprint suitable for top-left sidebar or header.
  - Status Indicators: Subtle colored dots beneath day numbers with hover tooltips (e.g., "4/5 tasks completed").
  - Historical Banner: When viewing a historical date, a distinct top banner indicates *"Viewing Historical Session (Read-Only) — [Return to Today]"*.
- **Standup Export UX:**
  - Quick trigger button in main header: `[Copy Standup]`.
  - Standup modal renders both the raw Markdown text and a formatted rich preview.
  - 1-click `Copy to Clipboard` with clear `"Copied!"` toast feedback.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Month View Status Dot Rendering
- **Given:** A user has recorded check-ins on `2026-08-26`, `2026-08-27`, and `2026-08-28`.
- **When:** The calendar widget renders the month of August 2026.
- **Then:** Status dots appear on the corresponding date cells representing their completion state.

### Scenario 2: Historical Day Inspection (Read-Only Mode)
- **Given:** The user is on the active board for today.
- **When:** The user clicks a past date (e.g., `2026-08-25`) on the calendar.
- **Then:** The board loads that day's session and tasks in read-only mode.
- **And:** Checkbox toggles and drag-and-drop actions are disabled.
- **And:** A "Return to Today" button is visible to quickly restore active editing.

### Scenario 3: 1-Click Standup Markdown Copy
- **Given:** The active workday has 2 completed tasks in Yesterday, 3 prioritized tasks in Today, and 1 task in Blocked.
- **When:** The user opens the Standup Export modal and clicks "Copy Markdown".
- **Then:** The clipboard receives the correctly formatted Markdown string matching the standup structure.
- **And:** An animated confirmation toast confirms the copy action.

---

## 6. Definition of Done Checklist
- [ ] Backend calendar summary endpoint (`GET /api/calendar/summary`) implemented with unit tests (`@developer`)
- [ ] Interactive Calendar widget with month navigation and status markers implemented (`@developer` / `@ui-designer`)
- [ ] Historical read-only enforcement validated across board components (`@developer`)
- [ ] Standup Markdown generator and clipboard export modal verified (`@developer` / `@ui-designer`)
- [ ] Headless browser `/browser` E2E validation verifying date jumping and standup copying (`@tester`)
- [ ] Acceptance criteria verified with saved QA report in `test-reports/QA-REPORT-005-calendar-and-standup-<YYYY-MM-DD>.md` (`@tester`)
