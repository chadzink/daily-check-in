# PLAN: Single-Binary Packaging & E2E Validation (Milestone 6)

## 1. Feature Overview & User Story
- **Story:** As a DevOps engineer and product owner, I want the entire application (Go backend + React frontend) compiled into an optimized single binary, packaged in a hardened multi-stage Docker container, and validated through a full end-to-end regression test suite so that DailyCheckIn is production-ready for deployment on Google Cloud Run.
- **Scope:**
  - **In-Scope:**
    - Static Asset Embedding (`cmd/server/main.go`):
      - Embed production Vite SPA bundle from `frontend/dist` using Go `embed.FS`.
      - Configure SPA fallback routing (serving `index.html` for client-side routes while retaining `/api/*` endpoints).
    - Production Multi-Stage `Dockerfile`:
      - Stage 1: Node 20+ builder compiling React SPA to `frontend/dist`.
      - Stage 2: Go 1.23+ builder embedding assets and building stripped, statically linked binary (`-ldflags="-s -w"`).
      - Stage 3: Hardened Scratch/Alpine runtime image (<45MB) with CA certificates, non-root user, and container health checks.
    - Full CI/CD Automation (`.github/workflows/ci-cd.yml`):
      - Automated linting (`golangci-lint`, `eslint`).
      - Automated test execution with Firebase emulator service container.
      - Docker image build and Google Cloud Run deployment workflow.
    - End-to-End Regression Test Suite & Final QA Sign-Off:
      - Full walkthrough verification covering all 5 prior milestones.
      - Comprehensive QA sign-off report archived in `test-reports/`.
  - **Out-of-Scope:**
    - Future multi-user team workspaces or billing integration (post-MVP).

---

## 2. Architecture & Data Model Impacts
- **Packaging Pipeline:**
  ```text
  [React TypeScript Source]
         │ (npm run build)
         ▼
  [frontend/dist]
         │ (go:embed)
         ▼
  [Go Echo Server Binary] ──> [Minimal Alpine Container] ──> [Google Cloud Run]
  ```
- **Directory & Configuration Layout:**
  ```text
  Dockerfile                    # Multi-stage production container build
  .dockerignore                 # Excludes local artifacts, node_modules, and .git
  .github/
    workflows/
      ci-cd.yml                 # Automated test, build, and deploy pipeline
  Makefile                      # Development commands (dev, test, build, docker-build)
  test-reports/                 # Final milestone QA sign-off reports
  ```

---

## 3. Deployment & Runtime Contracts

### 3.1 Environment Configuration
- `PORT` — HTTP port for Echo server (default `8080`, managed by Cloud Run).
- `GCP_PROJECT_ID` / `GOOGLE_CLOUD_PROJECT` — Target Google Cloud project.
- `FIRESTORE_EMULATOR_HOST` — Set only during local development/testing; unset in production to use live Firestore.
- `FIREBASE_AUTH_EMULATOR_HOST` — Set only during local development/testing; unset in production.

### 3.2 Health Check & Routing Verification
- `GET /api/health` $\rightarrow$ Returns HTTP `200 OK` JSON status.
- `GET /` $\rightarrow$ Serves embedded SPA `index.html`.
- `GET /calendar` $\rightarrow$ Serves embedded SPA `index.html` (SPA fallback).
- `GET /api/unknown` $\rightarrow$ Returns HTTP `404` JSON error envelope.

---

## 4. UI / UX & Interaction Flow (Collaborate with @ui-designer)
- **Production Asset Optimization:**
  - Verify asset hashing (cache busting) and gzip compression headers.
  - Verify responsive mobile/desktop layout rendering on production build.
  - Verify smooth page load times (<500ms initial paint).

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Standalone Single-Binary Execution
- **Given:** The frontend production bundle is compiled and embedded into the Go executable.
- **When:** The binary is launched without Node.js or separate web server processes.
- **Then:** Accessing `http://localhost:8080/` loads the complete interactive React SPA.
- **And:** API requests to `http://localhost:8080/api/health` return valid JSON.

### Scenario 2: Multi-Stage Docker Image Build
- **Given:** The `Dockerfile` is executed with `docker build -t dailycheckin:latest .`.
- **When:** The build finishes.
- **Then:** The resulting image size is under 50MB.
- **And:** Running the container spins up the server and responds to health checks.

### Scenario 3: Full End-to-End Journey Verification
- **Given:** A fresh user environment running against the production container.
- **When:** A user completes:
  1. Morning Check-In (with task rollover & backlog pull).
  2. Drag-and-drop task prioritization and checkbox completion.
  3. Adding blocker notes and resolving blockers.
  4. Exporting Standup Markdown to clipboard.
  5. Month-view calendar date navigation.
  6. End-of-Day Check-Out with reflection notes.
- **Then:** All user actions succeed, persist accurately, and render without UI regressions or console errors.

---

## 6. Definition of Done Checklist
- [ ] Multi-stage `Dockerfile` tested and optimized (<50MB image) (`@devops-engineer`)
- [ ] Single-binary `go:embed` asset routing and SPA fallback verified (`@developer`)
- [ ] GitHub Actions CI/CD workflow tested with emulator service container (`@devops-engineer`)
- [ ] Full E2E regression test suite executed via `/browser` (`@tester`)
- [ ] Final milestone QA sign-off report archived in `test-reports/QA-REPORT-006-final-validation-<YYYY-MM-DD>.md` (`@tester`)
- [ ] Final squad review and production release approval (`@product-owner`)
