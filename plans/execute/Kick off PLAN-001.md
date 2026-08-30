Initiate Sprint Milestone Kickoff and Feature Swarming for [PLAN-001-project-scaffolding.md](plans/PLAN-001-project-scaffolding.md) on branch `PLAN-001-project-scaffolding`.

Please coordinate the squad (@product-owner, @devops-engineer, @developer, @ui-designer, @tester) and execute according to `.agents/skills/scrum-milestone-kickoff/SKILL.md` and `.agents/skills/scrum-feature-swarming/SKILL.md`:

1. **Infrastructure Setup (@devops-engineer):**
   - Configure `docker-compose.yml`, `firebase.json`, `firestore.rules`, and `firestore.indexes.json` for Firestore (:8085), Auth (:9099), and Emulator UI (:4000).
   - Verify emulator health.

2. **Backend Scaffolding (@developer):**
   - Initialize Go 1.23+ module and Echo v4 web server in `cmd/server/main.go`.
   - Implement middleware (CORS, structured request logger, recover, request ID).
   - Implement `GET /api/health` with unit test `internal/api/health_test.go`.
   - Setup `go:embed` asset routing to serve `frontend/dist`.

3. **Frontend Scaffolding (@developer & @ui-designer):**
   - Scaffold Vite + React 18+ + TypeScript + Tailwind CSS in `frontend/`.
   - Configure Vitest + JSDOM test runner in `frontend/vitest.config.ts`.
   - Setup TanStack Query and dev proxy to `localhost:8080`.
   - Build initial app shell in `frontend/src/App.tsx` displaying backend connectivity status badge (`/api/health`).

4. **Pre-flight & Quality Gate (@tester):**
   - Execute Go backend tests (`go test -v ./...`) and frontend tests (`npm test`).
   - Produce initial test verification evidence targeting `test-reports/`.
