Initiate Sprint Milestone Kickoff and Feature Swarming for [PLAN-003-execution-board-and-backlog.md](../PLAN-003-execution-board-and-backlog.md) on branch `PLAN-003-execution-board-and-backlog`.

Please coordinate the squad (@product-owner, @devops-engineer, @developer, @ui-designer, @tester) and execute according to `.agents/skills/scrum-milestone-kickoff/SKILL.md` and `.agents/skills/scrum-feature-swarming/SKILL.md`:

1. **Infrastructure & Emulator Health (@devops-engineer):**
   - Verify Firebase Local Emulators (Firestore :8085, Auth :9099, UI :4000) are healthy.
   - Verify composite indexes in `firestore.indexes.json`.

2. **Backend Domain Models & Service Layer (@developer):**
   - Update `ReorderDayTasksRequest` and `CreateDayTaskRequest` / `PullDayTaskRequest` in `internal/model/domain.go`.
   - Implement `FindByID` in `internal/repository/day_task_repo.go` to locate day tasks across sessions.
   - Implement `PullDayTask`, `DemoteDayTask`, `PatchDayTask`, and `ReorderDayTasksDirect` in `internal/service/day_session_service.go` with synchronized master task completion state.
   - Register endpoints in `internal/api/days.go` (`POST /api/days/:date/pull`, `POST /api/days/:date/tasks/:id/demote`, `PATCH /api/day-tasks/:id`, `PUT /api/day-tasks/reorder`).

3. **Frontend Implementation (@ui-designer & @developer):**
   - Install `@hello-pangea/dnd` for accessible, fluid drag-and-drop interactions.
   - Update types in `frontend/src/types/domain.ts` and API helpers in `frontend/src/api/tasks.ts`.
   - Implement TanStack Query hooks with optimistic updates in `frontend/src/hooks/useBoard.ts`.
   - Implement 4-row board components: `DailyBoard`, `ExecutionRow`, `YesterdayRow`, `TodayRow`, `BlockedRow`, `BacklogRow`, `TaskCard`, `BlockerReasonModal`, and `QuickAddInput`.
   - Wire `DailyBoard` into `frontend/src/App.tsx`.

4. **QA Acceptance & Sign-Off (@tester):**
   - Run backend integration tests and frontend Vitest suites with sanitized logs in `test-results/`.
   - Execute browser journey testing with screenshots in `test-results/screenshots/`.
   - Sanitize all outputs with `scripts/sanitize-test-output.sh`.
   - Archive QA Acceptance report in `test-reports/QA-REPORT-003-execution-board-2026-08-31.md`.
