Initiate Sprint Milestone Kickoff and Feature Swarming for [PLAN-002-domain-models-and-repositories.md](plans/PLAN-002-domain-models-and-repositories.md) on branch `PLAN-002-domain-models-and-repositories`.

Please coordinate the squad (@product-owner, @devops-engineer, @developer, @ui-designer, @tester) and execute according to `.agents/skills/scrum-milestone-kickoff/SKILL.md` and `.agents/skills/scrum-feature-swarming/SKILL.md`:

1. **Infrastructure & Emulator Health (@devops-engineer):**
   - Verify Firebase Local Emulators (Firestore :8085, Auth :9099, UI :4000) are healthy.
   - Configure Firestore Go client factory with emulator support in `internal/repository/firestore.go`.

2. **Domain Models & DTOs (@developer):**
   - Implement `DayStatus`, `DaySession`, `Task`, `DayTask`, `DayTaskWithDetails`, and `DaySessionWithTasks` in `internal/model/domain.go`.
   - Implement request and response DTOs for Backlog, Tasks, and DaySessions.

3. **Firestore Repositories & Service Layer (@developer):**
   - Implement `TaskRepository` with batch fetching (`GetByIDs`) and backlog reordering.
   - Implement `DaySessionRepository` and `DayTaskRepository`.
   - Implement `DaySessionService` assembling `DaySessionWithTasks` in a single round-trip without N+1 queries.
   - Implement `TaskService` handling backlog management and task lifecycle.

4. **Auth Middleware & API Handlers (@developer):**
   - Implement auth middleware in `internal/middleware/auth.go` extracting UID with emulator header fallback.
   - Implement handlers in `internal/api/` for `/api/backlog`, `/api/tasks`, and `/api/days`.
   - Wire dependencies in `cmd/server/main.go`.

5. **Frontend Types & Fixtures (@ui-designer & @developer):**
   - Create TypeScript domain interfaces in `frontend/src/types/domain.ts`.
   - Create test fixtures in `frontend/src/test/fixtures/daySession.fixture.ts`.
   - Create API client helpers in `frontend/src/api/tasks.ts`.

6. **QA Acceptance & Sign-Off (@tester):**
   - Run integration tests against local Firestore emulator verifying Scenarios 1, 2, and 3.
   - Sanitize test logs with `scripts/sanitize-test-output.sh`.
   - Archive QA Acceptance report in `test-reports/QA-REPORT-002-domain-models-2026-08-31.md`.
