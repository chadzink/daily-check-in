# PLAN-006: Single-Binary Packaging, Containerization & Production Readiness (Milestone 6)

- **Milestone:** Milestone 6 — Single-Binary Packaging & E2E Validation
- **Document Reference:** `plans/PLAN-006-packaging-and-production-readiness.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@devops-engineer`, `@developer`, `@ui-designer`, `@tester`
- **Ceremony:** Backlog Refinement & Story Scoping (Workflow 01)
- **Status:** **Definition of Ready (DoR) APPROVED**

---

## 1. Feature Overview & User Stories

### 1.1 User Stories
- **Single-Binary Standalone Execution:**
  *As a DevOps engineer and operator, I want the compiled Go server binary to embed the production React SPA bundle and serve both REST API endpoints and static assets without requiring external Node.js runtimes or reverse proxies, so that DailyCheckIn can run as a zero-dependency standalone binary anywhere.*
- **Hardened Multi-Stage Container Packaging:**
  *As a cloud platform engineer, I want a multi-stage Docker build producing a minimal, secure Alpine/Scratch container (<45MB) executed under a non-root user with active container health checking, so that DailyCheckIn meets enterprise container security baselines for deployment to Google Cloud Run.*
- **Automated CI/CD Pipeline:**
  *As a software engineer, I want automated GitHub Actions workflows running linting, unit tests with Firebase emulators, multi-stage container builds, and deployment verification, so that any regressions are caught before reaching production.*
- **End-to-End System Regression Validation:**
  *As a product owner and QA engineer, I want the entire user journey (Morning Check-In, Board Reordering, Blocker Triage, Standup Markdown Export, Month-View Calendar, and End-of-Day Check-Out) validated against the production package, so that we have complete confidence in production readiness.*

### 1.2 Scope Boundaries
- **In-Scope:**
  1. **Static Asset Embedding & Routing (`cmd/server/main.go`, `embed.go`):**
     - Embed production Vite SPA bundle from `frontend/dist` using Go `embed.FS`.
     - Implement SPA fallback routing (serving `index.html` with `Cache-Control: no-cache` for client-side navigation routes).
     - Static asset caching headers: `Cache-Control: public, max-age=31536000, immutable` for versioned/hashed files in `/assets/*`.
     - Non-interception guarantee: Ensure all `/api/*` endpoints strictly return JSON responses and 404s without falling back to HTML.
     - HTTP response compression: Configure `middleware.Gzip()` for text and SPA assets.
  2. **Multi-Stage Production `Dockerfile` & Packaging:**
     - Stage 1: `node:20-alpine` compiling React SPA to `frontend/dist`.
     - Stage 2: `golang:1.23-alpine` building stripped, statically linked binary (`-ldflags="-s -w"`).
     - Stage 3: `alpine:3.21` runtime with `ca-certificates`, `tzdata`, non-root user `nobody:nobody`, and built-in `HEALTHCHECK`.
     - Output image footprint target: `<45MB` total compressed size.
  3. **Automated CI/CD Workflow (`.github/workflows/ci-cd.yml`):**
     - Automated code quality: `go vet` and TypeScript compile check (`tsc`).
     - Automated test execution with Firebase emulator service container.
     - Docker multi-stage build and image size audit.
     - Google Cloud Run deployment workflow template.
  4. **Production Build Tooling (`Makefile`):**
     - `make build`, `make docker-build`, `make test` targets optimized.
  5. **Comprehensive E2E Regression Suite & Final Sign-Off:**
     - Full automated test suite verification.
     - End-to-end browser regression journey validating all 5 prior milestones.
     - Zero path leak and PII audit.
     - Archived QA sign-off report in `test-reports/QA-REPORT-006-final-validation-2026-09-04.md`.
- **Out-of-Scope:**
  - Multi-tenant organizational teams and billing tiers (reserved for Post-MVP).
  - Native mobile application builds (iOS / Android wrappers).

---

## 2. Architecture & Data Model Impacts

### 2.1 Packaging & Delivery Pipeline
```text
[React TypeScript Source]
       │ (npm run build)
       ▼
[frontend/dist (Vite Bundle)]
       │ (go:embed all:frontend/dist)
       ▼
[Go Echo Server Binary] ──> [Hardened Alpine Image <45MB] ──> [Google Cloud Run]
```

### 2.2 Routing & Middleware Stack
```text
HTTP Request
     │
     ├──> [RequestID & Logger Middleware]
     ├──> [Recover Middleware]
     ├──> [Gzip Compression Middleware]
     ├──> [CORS Middleware]
     │
     ├── If prefix is "/api":
     │      ├── /api/health -> HealthCheckHandler (200 JSON)
     │      └── /api/* -> AuthMiddleware -> Domain Handlers (Tasks, Days, Rituals, Calendar)
     │
     └── If prefix is NOT "/api":
            ├── /assets/* -> FileServer with "Cache-Control: public, max-age=31536000, immutable"
            ├── Existing static file -> FileServer
            └── Any other path -> Fallback to index.html with "Cache-Control: no-cache"
```

---

## 3. Deployment & Runtime Contracts

### 3.1 Environment Variables
| Variable | Description | Local Dev / Test | Production (Cloud Run) |
| :--- | :--- | :--- | :--- |
| `PORT` | Echo HTTP listening port | `8080` | Managed by Cloud Run (e.g. `8080`) |
| `APP_ENV` | Application environment | `development` | `production` |
| `FIRESTORE_EMULATOR_HOST` | Firestore emulator address | `localhost:8085` | Unset (uses Google Cloud Firestore) |
| `FIREBASE_AUTH_EMULATOR_HOST` | Auth emulator address | `localhost:9099` | Unset (uses Google Cloud Auth) |
| `GCP_PROJECT_ID` | Google Cloud Project ID | `test-project` | Provided by Google Cloud service account |

### 3.2 Health Check & Container Protocol
- **Endpoint:** `GET /api/health`
- **Response:** `HTTP 200 OK` with `{"status":"ok","timestamp":"<rfc3339>"}`
- **Docker Healthcheck:**
  ```dockerfile
  HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/api/health || exit 1
  ```

---

## 4. UI / UX & Production Asset Optimization (Collaborate with @ui-designer)
- **Asset Cache Busting:** Vite generates content-hashed asset filenames (e.g., `index-CtAzfTex.css`, `index-BwG3TMcb.js`).
- **Cache Strategy:**
  - Hashed `/assets/*` cached permanently (`max-age=31536000, immutable`).
  - Entrypoint `index.html` served with `no-cache` to ensure instant client updates when new deployments roll out.
- **Fast First Paint:** Clean Gzip compression reduces JavaScript bundle transfer to ~118KB and CSS to ~7KB.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Standalone Single-Binary Execution & Routing
- **Given:** The frontend production bundle is compiled and embedded into the Go executable via `embed.FS`.
- **When:** The binary `bin/dailycheckin` is executed standalone with `PORT=8080`.
- **Then:** Accessing `GET /` serves `index.html` with `Content-Type: text/html` and `Cache-Control: no-cache`.
- **And:** Accessing client-side routes such as `GET /calendar` serves `index.html` (SPA fallback).
- **And:** Accessing `GET /assets/...` serves the static asset with `Cache-Control: public, max-age=31536000, immutable`.
- **And:** Accessing `GET /api/health` returns HTTP 200 JSON.
- **And:** Accessing an unmapped API route `GET /api/nonexistent` returns HTTP 404 JSON (not HTML).

### Scenario 2: Hardened Multi-Stage Container Packaging
- **Given:** The `Dockerfile` is built with `docker build -t dailycheckin:latest .`.
- **When:** The container image is inspected.
- **Then:** The total image size is under 45MB.
- **And:** The container runtime runs as non-root user `nobody:nobody`.
- **And:** The container includes a working `HEALTHCHECK` directive.
- **And:** Starting the container spins up the Echo server and passes health checks.

### Scenario 3: CI/CD Automation Pipeline
- **Given:** Code is pushed or a PR is opened on GitHub.
- **When:** The `.github/workflows/ci-cd.yml` workflow triggers.
- **Then:** Linting, backend unit tests with emulator, frontend tests, and Docker image build succeed automatically.

### Scenario 4: Full Multi-Milestone E2E Regression Journey
- **Given:** A running production DailyCheckIn instance connected to local emulators.
- **When:** A user executes the full end-to-end workflow:
  1. Opens the app and completes Morning Check-In (rolls over incomplete tasks, pulls from backlog, records check-in).
  2. Prioritizes tasks in the "Today" row and marks a task complete.
  3. Moves a task to "Blocked" with an explicit blocker note, and later unblocks it.
  4. Clicks "Export Standup" and copies formatted Markdown with animated feedback.
  5. Opens the month-view calendar, views historical activity, navigates to a past date in read-only mode, and jumps back to Today.
  6. Completes End-of-Day Check-Out, demoting or rolling over remaining tasks and recording daily reflections.
- **Then:** All actions persist cleanly in Firestore, UI responds smoothly with proper feedback, and zero console errors occur.

---

## 6. Definition of Ready (DoR) Gate Checklist
- [x] User stories and scope boundaries clearly defined.
- [x] Architecture, packaging pipeline, and middleware routing documented.
- [x] Deployment contracts, environment variables, and health checks specified.
- [x] Static asset caching and compression strategies defined.
- [x] Explicit Gherkin acceptance criteria written for all scenarios.

---

## 7. Definition of Done (DoD) Checklist
- [x] Multi-stage `Dockerfile` tested, hardened, and image size <45MB (`@devops-engineer`)
- [x] Single-binary `go:embed` asset routing, compression, and SPA fallback verified (`@developer`)
- [x] GitHub Actions CI/CD workflow created and verified (`@devops-engineer`)
- [x] Full E2E regression test suite executed via `/browser` (`@tester`)
- [x] Final milestone QA sign-off report archived in `test-reports/QA-REPORT-006-final-validation-2026-09-04.md` (`@tester`)
- [ ] Final squad review and production release approval (`@product-owner`)
