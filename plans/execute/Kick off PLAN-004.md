Initiate Sprint Milestone Kickoff and Feature Swarming for [PLAN-004-ritual-wizards-and-rollover.md](../PLAN-004-ritual-wizards-and-rollover.md) on branch `PLAN-004-ritual-wizards-and-rollover`.

Coordinate the squad (@product-owner, @devops-engineer, @developer, @ui-designer, @tester) according to `.agents/skills/scrum-milestone-kickoff/SKILL.md` and `.agents/skills/scrum-feature-swarming/SKILL.md`:

1. **Infrastructure & Emulator Health (@devops-engineer):**
   - Verify Firebase Local Emulators (Firestore :8085, Auth :9099, UI :4000) are running and responsive.
   - Confirm single-field and composite indexes in `firestore.indexes.json` for session date querying.

2. **Backend Domain Models & Service Layer (@developer):**
   - Add DTOs in `internal/model/domain.go`:
     - `CheckInContextResponse`
     - `RolloverDecision`, `RolloverAction`
     - `ExecuteCheckInRequest`
     - `ExecuteCheckOutRequest`
   - Implement `RitualService` in `internal/service/ritual_service.go`:
     - `GetMorningCheckInContext(ctx, userID, date)`: Reverse date traversal across weekends/holidays (up to 30 days) to find last active session (`check_in_at != nil`), aggregate yesterday's completed tasks, incomplete rollover candidates, and unassigned backlog tasks.
     - `ExecuteMorningCheckIn(ctx, userID, date, req)`: Atomic Firestore transaction checking for 409 conflict, updating `DaySession.check_in_at`, committing `DayTask`s for Today, Yesterday, and Blocked.
     - `ExecuteCheckOut(ctx, userID, date, req)`: Atomic Firestore transaction checking for 400 bad request (if not checked in), demoting requested tasks to backlog, marking completed tasks, updating `DaySession.check_out_at` and `notes`.
   - Register endpoints in `internal/api/ritual.go` / `days.go`:
     - `GET /api/days/:date/check-in/context`
     - `POST /api/days/:date/check-in`
     - `POST /api/days/:date/check-out`
   - Table-driven unit tests in `internal/service/ritual_service_test.go` and `internal/api/api_test.go`.

3. **Frontend Implementation (@ui-designer & @developer):**
   - Add domain interfaces in `frontend/src/types/domain.ts`:
     - `CheckInContextResponse`, `RolloverDecision`, `ExecuteCheckInRequest`, `ExecuteCheckOutRequest`.
   - Add API helpers in `frontend/src/api/rituals.ts`.
   - Implement TanStack Query hooks in `frontend/src/hooks/useRituals.ts` (`useCheckInContext`, `useExecuteCheckIn`, `useExecuteCheckOut`).
   - Implement UI components:
     - `frontend/src/components/board/DaySessionActionBar.tsx` (Status badges for check-in / check-out, action buttons).
     - `frontend/src/components/board/MorningCheckInBanner.tsx` (Persistent dismissable reminder if un-checked-in).
     - `frontend/src/components/wizards/MorningCheckInModal.tsx` (4-step wizard container).
     - `frontend/src/components/wizards/Step1YesterdayReview.tsx` (Step 1: yesterday accomplishments review).
     - `frontend/src/components/wizards/Step2RolloverTriage.tsx` (Step 2: rollover / demote / complete actions).
     - `frontend/src/components/wizards/Step3BacklogPull.tsx` (Step 3: pull from global backlog).
     - `frontend/src/components/wizards/Step4PrioritizeCommit.tsx` (Step 4: priority reorder & commit).
     - `frontend/src/components/wizards/CheckOutModal.tsx` (2-step evening closure modal).
     - `frontend/src/components/wizards/Step1CheckOutReview.tsx` (Review completed & triage unfinished).
     - `frontend/src/components/wizards/Step2DailyReflection.tsx` (Reflection notes & sign-off).
   - Integrate into `frontend/src/App.tsx` and `frontend/src/components/board/DailyBoard.tsx`.

4. **QA Acceptance & Sign-Off (@tester):**
   - Run backend integration tests and frontend Vitest suites with sanitized logs in `test-results/`.
   - Execute headless browser journeys (`/browser`) validating Morning Check-In and Evening Check-Out flows with screenshots in `test-results/screenshots/`.
   - Sanitize all outputs with `scripts/sanitize-test-output.sh`.
   - Archive QA Acceptance report in `test-reports/QA-REPORT-004-ritual-wizards-<YYYY-MM-DD>.md`.
