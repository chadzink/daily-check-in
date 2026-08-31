# Sprint Retrospective: Milestone 2 (PLAN-002 Core Domain Models & Firestore Repositories)

- **Milestone:** Milestone 2 — Core Domain Models & Firestore Repositories
- **Plan Reference:** [PLAN-002-domain-models-and-repositories.md](../../plans/PLAN-002-domain-models-and-repositories.md)
- **Branch:** `PLAN-002-domain-models-and-repositories`
- **Execution Date:** 2026-08-31
- **Participants:** Full Squad (`@product-owner`, `@devops-engineer`, `@developer`, `@ui-designer`, `@tester`, User)
- **Status:** **COMPLETE**

---

## 1. Milestone Delivery & Metrics

The squad implemented and validated the Go domain entities, multi-tenant Firestore repositories with batch resolution, batched join service logic, Firebase auth extraction middleware, Echo HTTP API endpoints, frontend TypeScript types and fixtures, and local emulator integration testing.

| Metric | Target | Actual | Assessment |
| :--- | :--- | :--- | :--- |
| **Gherkin Acceptance Criteria** | 3 / 3 (100%) | **3 / 3 Passed** | Met |
| **Repository Integration Tests** | 100% pass | **3 / 3 Passed (0.385s)** | Met |
| **Backend Test Suite Execution** | < 5s | **~1.5s** | Exceeded |
| **Frontend Tests (`App.test.tsx`)** | All passing | **3 / 3 (100%)** | Met |
| **Vite Bundle Build Duration** | < 10s | **2.11s** | Exceeded |
| **Single-Binary Artifact** | Self-contained SPA | **`bin/dailycheckin`** | Met |
| **Firestore Query N+1 Overhead** | 0 N+1 reads | **0 (Batched `GetAll`)** | Met |
| **Path & Log Privacy Hygiene** | 100% project-relative | **100% Sanitized** | Met |

---

## 2. Squad Role Perspectives

### `@product-owner` (Scope & Business Value)
- **Delivered Value:** The core dual-task model (`Task` + `DayTask`) and session lifecycle (`DaySession`) are now fully backed by persistent data storage. APIs for Backlog (`/api/backlog`), Tasks (`/api/tasks`), and Day Sessions (`/api/days`) deliver all data contracts needed for Milestone 3 (Execution Board & Backlog UI).
- **Scope Discipline:** Successfully held ritual wizard automation (rollover logic, evening reflection) out-of-scope for Milestone 4, keeping this milestone focused on clean data modeling and repositories.

### `@devops-engineer` (Infrastructure & Environments)
- **Local Emulators:** The Docker Compose Firebase emulator suite (:8085 Firestore, :9099 Auth, :4000 UI) operated with 100% stability throughout testing.
- **Index Management:** Proactively added the composite index (`tasks`: `is_archived` ASC + `backlog_order` ASC) to `firestore.indexes.json` to prevent runtime index missing errors.

### `@developer` (Architecture & Implementation)
- **Zero N+1 Batched Reads:** Using `client.GetAll(ctx, docRefs)` in `TaskRepository.GetByIDs` allowed `DaySessionService` to retrieve all task metadata in a single logical round-trip, completely avoiding N+1 query patterns.
- **Subcollection Tenant Isolation:** Placing tasks under `/users/{userId}/tasks/` and day tasks under `/users/{userId}/day_sessions/{date}/day_tasks/` ensured airtight user data isolation naturally (verified by Gherkin Scenario 3).
- **JSON Slice Marshaling:** Initialized array fields as `make([]model.DayTaskWithDetails, 0)` so empty states marshal cleanly as `[]` rather than `null`.

### `@ui-designer` (Frontend Types & Fixtures)
- **Domain Alignment:** Created strongly-typed TypeScript domain definitions in `frontend/src/types/domain.ts` and comprehensive mock fixtures in `frontend/src/test/fixtures/daySession.fixture.ts` covering yesterday, today, and blocked execution rows.
- **API Client:** Provided typed API client helper methods in `frontend/src/api/tasks.ts` to accelerate Milestone 3 execution board component development.

### `@tester` (Quality & Verification Gate)
- **Acceptance Gate:** Validated all 3 Gherkin scenarios against the live Firestore emulator, authoring [QA-REPORT-002-domain-models-2026-08-31.md](../../test-reports/QA-REPORT-002-domain-models-2026-08-31.md).
- **Path Hygiene:** Used `scripts/sanitize-test-output.sh` to ensure all logs in `test-results/` are completely free of absolute filesystem paths or personal credentials.

---

## 3. What Went Well (Practices to Maintain)

1. **Batched Document Fetching (`GetAll`):**
   `TaskRepository.GetByIDs` batching eliminated individual round-trips when rendering joined day sessions. This pattern should be standardized for any future document joins.
2. **Flexible Auth Middleware with Developer Header Fallback:**
   `FirebaseAuthMiddleware` checks for `X-User-ID` in emulator mode, allowing simple curl commands and multi-tenant tests (`user-A` vs `user-B`) without requiring mock token signing.
3. **Single-Binary Runtime Smoke Verification:**
   Testing the compiled `./bin/dailycheckin` artifact against live curls on a separate port (`PORT=8099`) verified that embedded assets, Echo routes, and Firestore connectivity work end-to-end in compiled mode.
4. **Immediate Test Log Sanitization:**
   Piping test commands directly through `./scripts/sanitize-test-output.sh` ensures DoD compliance without manual post-processing.

---

## 4. What Slowed Us Down (Impediments & Blockers Resolved)

1. **Strict TypeScript Compiler Unused Variable Checks (`TS6133`):**
   - *Friction:* `npm run build` failed during initial production bundle build because `MasterTask` was imported into `daySession.fixture.ts` without direct usage.
   - *Resolution:* Removed the unused import. Moving forward, pre-flight checks must run `npm run build` locally before handoff.
2. **Missing Composite Index for Task Backlog Query:**
   - *Friction:* Querying tasks filtered by `is_archived == false` and ordered by `backlog_order ASC` requires a composite index in Firestore.
   - *Resolution:* Updated `firestore.indexes.json` with the required composite index matching PLAN-002 specifications.
3. **Go Nil Slice JSON Marshaling (`null` vs `[]`):**
   - *Friction:* Uninitialized Go slices marshal as `null` in JSON, which can break frontend arrays expecting `.length` or `.map()`.
   - *Resolution:* Explicitly initialized empty slices with `make([]T, 0)` in `DayTasksGrouped` and `BacklogResponse`.

---

## 5. Continuous Improvements & Codified Changes

In accordance with [`.agents/skills/scrum-retrospective/SKILL.md`](../../.agents/skills/scrum-retrospective/SKILL.md), the squad codified the following improvements:

1. **Non-Nil JSON Array Slice Initialization:**
   - Added standard in [`GEMINI.md`](../../GEMINI.md) and [`.agents/agents/agile-developer.md`](../../.agents/agents/agile-developer.md): Go response DTOs containing array fields must always be initialized as empty slices (`make([]T, 0)`) to prevent `null` JSON payloads.
2. **Zero N+1 Document Join Policy:**
   - Codified in [`GEMINI.md`](../../GEMINI.md) and [`.agents/agents/agile-developer.md`](../../.agents/agents/agile-developer.md): Always use Firestore batch operations (`client.GetAll` / `client.Batch`) when reading or updating multiple related documents.
3. **TypeScript Build Verification in Pre-Flight:**
   - Codified in [`.agents/agents/agile-developer.md`](../../.agents/agents/agile-developer.md) and [`.agents/skills/scrum-feature-swarming/SKILL.md`](../../.agents/skills/scrum-feature-swarming/SKILL.md) to ensure `npm run build` runs during developer pre-flight checks to catch strict TS compiler errors early.
4. **Emulator Port Alignment:**
   - Corrected `FIRESTORE_EMULATOR_HOST` references in developer documentation to uniformly reflect `localhost:8085`.

---

## 6. Next Sprint Transition (Milestone 3 Kickoff)

With Milestone 2 accepted and retrospective codified:
- **Target Plan:** [PLAN-003-execution-board-and-backlog.md](../../plans/PLAN-003-execution-board-and-backlog.md)
- **Focus:** 4-row execution board UI (Yesterday, Today, Blocked, Backlog), TanStack Query hooks, drag-and-drop reordering (`@hello-pangea/dnd`), and optimistic completion toggles.
