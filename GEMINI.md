# DailyCheckIn - Project Instructions & Guidelines

## 1. Project Overview
DailyCheckIn is a daily execution and morning/evening ritual tool for tech workers combining Scrum principles (**Yesterday**, **Today**, **Blocked**, **Backlog**) with date-based session tracking and multi-day task persistence.

### Key Architectural Concepts
1. **Days as First-Class Sessions (`DaySession`):**
   - Each workday has explicit lifecycle timestamps: `check_in_at` (morning check-in) and `check_out_at` (evening reflection).
2. **Dual Task Model:**
   - **Master Task (`Task`):** Persistent entity containing title, description, tags, backlog priority rank, archive state, and overall completion state. Unassigned tasks in this pool form the **Global Backlog**.
   - **Day-Task Association (`DayTask`):** Binds a task committed to a specific `DaySession`, capturing row status (`YESTERDAY`, `TODAY`, `BLOCKED`), completion status & timestamp, priority order, and blocker reasons.
3. **The 4 Execution Rows:**
   - **Yesterday:** Read-only accomplishments completed on the prior active workday (`is_completed = true`).
   - **Today:** Actively prioritized list (1..N order) targeted for the current workday with instant completion timestamps.
   - **Blocked:** Tasks waiting on external dependencies with explicit blocker reason notes.
   - **Backlog:** Persistent, cross-day pool of unscheduled master tasks that can be prioritized and pulled into Today.
4. **Ritual Wizards:**
   - **Morning Check-In:** Automated rollover of incomplete tasks, review of yesterday's accomplishments, and backlog pull prioritization.
   - **End-of-Day Check-Out:** Review incomplete tasks, demote unfinished work back to the global backlog or roll over, and record daily reflections.
5. **Interactive Calendar & Standup Export:**
   - Interactive month-view calendar with daily check-in status indicators and historical jump-to-date navigation.
   - 1-click formatted Markdown export for Slack, Teams, or email standups.

---

## 2. Multi-Agent Collaboration Squad & Workflow

When building or updating features, agents in `.agents/agents/` collaborate in a 5-role agile squad:

| Agent | Role | Key Output / Artifact |
| :--- | :--- | :--- |
| **`@product-owner`** | Product Owner & Agile Architect | Authored `/plans/PLAN-<feature-name>.md` with Gherkin acceptance criteria |
| **`@ui-designer`** | Lead UI/UX & Frontend Designer | Tailwind design tokens, component styling, animations, and UX interaction flows |
| **`@developer`** | Lead Software Developer | Full-stack Go Echo backend (`model` $\rightarrow$ `repo` $\rightarrow$ `service` $\rightarrow$ `api`) + React SPA logic |
| **`@devops-engineer`** | DevOps & Cloud Infrastructure | Firebase Emulators, `Dockerfile` multi-stage build, `firestore.indexes.json`, CI/CD |
| **`@tester`** | QA & Test Automation Engineer | Unit, integration & `/browser` E2E validation with saved reports in `test-reports/` |

### Collaboration Lifecycle

```text
1. [@product-owner]    Scopes user stories & acceptance criteria in /plans/
2. [@ui-designer]      Designs Tailwind tokens, component hierarchy & drag-and-drop UX
3. [@devops-engineer]  Validates emulator setup, container build & composite indexes
4. [@developer]        Implements full-stack code and executes local pre-flight checks
5. [@tester]           Runs test suite & browser verification; saves report to test-reports/
```

---

## 3. Tech Stack & Directory Structure

### Backend (Go 1.23+)
- **Framework:** Echo v4
- **Database & Auth:** Google Cloud Firestore & Firebase Authentication (Admin SDK)
- **Static Assets:** `go:embed` embedding production Vite bundle from `frontend/dist`
- **Structure:**
  - `cmd/server/main.go` — Echo server entrypoint, middleware wiring, and graceful shutdown
  - `internal/model/` — Go data structs, DTOs, and API envelopes
  - `internal/repository/` — Firestore repositories and data access logic
  - `internal/service/` — Core business logic (check-in/out wizards, rollover rules, standup generator)
  - `internal/api/` — HTTP handlers and router configuration
  - `internal/middleware/` — Firebase auth validation and structured request logging

### Frontend (React 18+ / TypeScript)
- **Tooling & Libraries:** Vite, Tailwind CSS, TanStack Query (React Query), `@hello-pangea/dnd`, `lucide-react`, `date-fns`
- **Structure:**
  - `frontend/src/api/` — Typed API client with JWT injection
  - `frontend/src/components/` — UI components (Board, Calendar, Wizards, Task items)
  - `frontend/src/context/` — AuthContext and DateContext
  - `frontend/src/hooks/` — TanStack Query data hooks
  - `frontend/src/App.tsx` — Main application layout and routing
  - `frontend/src/main.tsx` — Application entrypoint

---

## 4. Development & Testing Commands

### Prerequisites
- Docker & Docker Compose (for Firebase Local Emulators)
- Go 1.23+
- Node 20+ & `npm` / `pnpm`

### Local Development Setup
```bash
# Start Firebase Local Emulators (Firestore & Auth)
docker-compose up -d

# Run Go Backend (configure emulator host variables)
export FIRESTORE_EMULATOR_HOST="localhost:8080"
export FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
go run ./cmd/server

# Run Frontend Dev Server (Vite dev server proxying /api to Go backend)
cd frontend && npm run dev
```

### Running Tests & Validation
```bash
# Run Go unit and integration tests
go test -v ./...

# Run Frontend tests
cd frontend && npm test

# Validate production build & single-binary packaging
cd frontend && npm run build
go build -o bin/dailycheckin ./cmd/server
```

---

## 5. Definition of Done (DoD) & Standards
- [ ] Idiomatic Go code formatting (`gofmt`, standard error handling with context propagation).
- [ ] Strict separation of concerns (no direct Firestore queries in HTTP handlers; business logic isolated in `internal/service/`).
- [ ] UI adheres to `@ui-designer` Tailwind design system and supports keyboard accessibility and dark/light themes.
- [ ] Firebase emulator and multi-stage Docker builds pass cleanly without warnings.
- [ ] All acceptance criteria defined in `/plans/` are verified with automated tests or browser validation, and saved in `test-reports/`.
- [ ] Production build succeeds and embeds the frontend SPA into the Go binary (`go:embed`).
