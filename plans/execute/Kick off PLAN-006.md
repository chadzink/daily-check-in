Initiate Sprint Milestone Kickoff and Feature Swarming for [PLAN-006-packaging-and-production-readiness.md](../PLAN-006-packaging-and-production-readiness.md) on branch `feat/PLAN-006-packaging-and-production-readiness`.

Coordinate the squad (@product-owner, @devops-engineer, @developer, @ui-designer, @tester) according to `.agents/skills/scrum-milestone-kickoff/SKILL.md` and `.agents/skills/scrum-feature-swarming/SKILL.md`:

1. **Infrastructure & Container Security (@devops-engineer):**
   - Verify Firebase Local Emulators (Firestore :8085, Auth :9099, UI :4000) are running and responsive.
   - Harden multi-stage `Dockerfile`:
     - Pin Go builder to `golang:1.23-alpine`.
     - Configure container `HEALTHCHECK` with `wget --spider -q http://localhost:8080/api/health || exit 1`.
     - Verify non-root user `nobody:nobody` execution and minimal Alpine runtime footprint (<45MB).
   - Configure GitHub Actions CI/CD pipeline in `.github/workflows/ci-cd.yml` with lint, emulator tests, docker build, and Google Cloud Run deployment.
   - Validate `Makefile` build targets.

2. **Static Asset Routing & Server Production Configuration (@developer):**
   - Configure HTTP response compression via `middleware.GzipWithConfig` in `internal/middleware/middleware.go`.
   - Enhance static asset routing in `cmd/server/main.go`:
     - Cache-Control header `public, max-age=31536000, immutable` for `/assets/*`.
     - Cache-Control header `no-cache` for `index.html` fallback.
     - Strict non-interception guarantee for `/api/*` endpoints (returns JSON 404, never falls back to HTML).
   - Author automated tests verifying static routing, caching headers, and SPA fallback in `cmd/server/server_test.go`.

3. **Frontend Production Build Optimization (@ui-designer & @developer):**
   - Verify Vite production bundle (`frontend/dist`) minification and asset content hashing.
   - Ensure clean build without warnings (`tsc && vite build`).

4. **QA Verification & Full System Regression (@tester):**
   - Run full automated test suites (Go backend + Vitest frontend) with sanitized logs in `test-results/`.
   - Verify single-binary standalone build (`bin/dailycheckin`) without external Node.js process.
   - Verify Docker container startup, port mapping, and health check.
   - Execute full browser E2E regression journey covering all 5 prior milestones:
     1. Morning Check-In (rollover, backlog pull, check-in timestamp).
     2. Execution Board (reorder, priority, checkbox completions).
     3. Blocker Workflow (add blocker note, resolve blocker).
     4. Standup Markdown Export (copy formatted text).
     5. Calendar Navigation (historical read-only view, jump to today).
     6. End-of-Day Check-Out (demote/rollover, reflection notes).
   - Capture regression screenshots in `test-results/screenshots/`.
   - Archive final QA Sign-Off report in `test-reports/QA-REPORT-006-final-validation-2026-09-04.md`.
