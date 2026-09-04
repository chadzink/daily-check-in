Initiate Sprint Milestone Kickoff and Feature Swarming for [PLAN-005-interactive-calendar-and-standup-export.md](../PLAN-005-interactive-calendar-and-standup-export.md) on branch `PLAN-005-interactive-calendar-and-standup-export`.

Coordinate the squad (@product-owner, @devops-engineer, @developer, @ui-designer, @tester) according to `.agents/skills/scrum-milestone-kickoff/SKILL.md` and `.agents/skills/scrum-feature-swarming/SKILL.md`:

1. **Infrastructure & Emulator Health (@devops-engineer):**
   - Verify Firebase Local Emulators (Firestore :8085, Auth :9099, UI :4000) are running and responsive.
   - Confirm query index compatibility for `ListByDateRange` on `day_sessions` (automatic single-field indexing in Firestore).

2. **Backend Domain Models & Service Layer (@developer):**
   - Add DTOs in `internal/model/domain.go`:
     - `DaySummary` (`date`, `has_session`, `has_check_in`, `has_check_out`, `completed_task_count`, `total_task_count`)
     - `CalendarSummaryResponse` (`month`, `days`)
   - Implement `CalendarService` in `internal/service/calendar_service.go`:
     - `GetMonthSummary(ctx, userID, month)`: Validates format `YYYY-MM`, calculates calendar month boundaries, invokes `DaySessionRepository.ListByDateRange`, tabulates task counts per active day session, and guarantees empty slice initialization (`make([]DaySummary, 0)`).
   - Register endpoint in `internal/api/calendar.go`:
     - `GET /api/calendar/summary?month=YYYY-MM`
   - Table-driven unit tests in `internal/service/calendar_test.go` and `internal/api/calendar_test.go`.

3. **Frontend Implementation (@ui-designer & @developer):**
   - Add domain interfaces in `frontend/src/types/domain.ts`:
     - `DaySummary`, `CalendarSummaryResponse`, `StandupExportOptions`.
   - Add API helpers in `frontend/src/api/calendar.ts`.
   - Implement TanStack Query hook in `frontend/src/hooks/useCalendar.ts` (`useCalendarSummary`).
   - Implement `DateContext` in `frontend/src/context/DateContext.tsx`:
     - Provides `selectedDate`, `today`, `isToday`, `isHistorical`, `selectDate`, and `jumpToToday`.
   - Implement calendar UI components in `frontend/src/components/calendar/`:
     - `CalendarWidget.tsx` (Interactive month-view popover / panel)
     - `MonthNavigation.tsx` (Prev/next controls, month label, Jump to Today)
     - `CalendarDayCell.tsx` (Day number, status dots, today indicator, selection ring)
     - `CalendarStatusLegend.tsx` (Dot color key)
   - Implement historical banner & board read-only mode:
     - `frontend/src/components/navigation/HistoricalDateBanner.tsx`
     - Update `DailyBoard.tsx` to consume `DateContext` and enforce `isReadOnly` (disabling drag-and-drop, checkboxes, and task creation for past dates, suppressing auto-check-in).
   - Implement standup export in `frontend/src/components/standup/`:
     - `frontend/src/utils/standupGenerator.ts`
     - `StandupExportModal.tsx` & `CopyButton.tsx` (formatted preview, markdown source, animated copy confirmation).
   - Wire into `App.tsx` navigation and header.

4. **QA Acceptance & Sign-Off (@tester):**
   - Run backend integration tests and frontend Vitest suites with sanitized logs in `test-results/`.
   - Execute headless browser journeys (`/browser`) validating Calendar Month Navigation, Historical Read-Only Mode, and Standup Export Copying with screenshots in `test-results/screenshots/`.
   - Sanitize all outputs with `scripts/sanitize-test-output.sh`.
   - Archive QA Acceptance report in `test-reports/QA-REPORT-005-calendar-and-standup-<YYYY-MM-DD>.md`.
