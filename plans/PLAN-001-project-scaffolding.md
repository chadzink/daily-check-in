# PLAN: Project Scaffolding & Local Infrastructure

## 1. Feature Overview & User Story
- **Story:** As a developer on DailyCheckIn, I want a complete full-stack project skeleton, local Firebase emulators (Firestore & Auth), test harnesses (Go testing + Vitest), and a working dev environment so that I can rapidly build, test, and verify features against a local stack.
- **Scope:**
  - **In-Scope:**
    - Go 1.23+ module initialization and Echo v4 HTTP server setup (`cmd/server/main.go`).
    - Core middleware (CORS, structured request logging, recover, request ID).
    - Health check endpoint (`GET /api/health`).
    - Single-binary static asset embedding (`go:embed`) to serve the built frontend SPA on non-API routes.
    - Vite + React 18+ + TypeScript + Tailwind CSS initial scaffold in `frontend/`.
    - Frontend testing setup with Vitest, JSDOM, and React Testing Library (`@testing-library/react`, `@testing-library/jest-dom`).
    - TanStack Query client setup and dev server proxy (`/api` $\rightarrow$ `http://localhost:8080`).
    - `docker-compose.yml` & `firebase.json` for Firestore (`:8085`), Firebase Auth (`:9099`), and Emulator UI (`:4000`).
    - Base `.gitignore` updates and smoke test verification.
  - **Out-of-Scope:**
    - Business domain models (`DaySession`, `DayTask`) and database write logic (handled in Milestone 2 / PLAN-002).
    - Final UI components and drag-and-drop board interactions (handled in Milestone 3 / PLAN-003).

---

## 2. Architecture & Data Model Impacts
- **Directory Layout:**
  ```text
  cmd/
    server/
      main.go               # Echo entrypoint, middleware, go:embed static router
  internal/
    api/                    # HTTP handlers & routing
      health.go             # Health check handler
      health_test.go        # Health check unit test
    middleware/             # Logging, CORS, Request ID
    model/                  # Domain types & DTOs
    repository/             # Firestore repositories
    service/                # Business logic
  frontend/                 # React 18 + TS + Tailwind SPA
    src/
      api/                  # API client & health check fetcher
      components/           # UI components
      context/              # Auth & Date contexts
      App.tsx               # App shell with backend health status badge
      App.test.tsx          # Component & mock network unit tests
      main.tsx
      setupTests.ts         # Vitest setup
    vitest.config.ts        # Vitest configuration
    tailwind.config.js
    vite.config.ts
  docker-compose.yml        # Firebase Local Emulators (Firestore :8085, Auth :9099, UI :4000)
  firebase.json             # Firebase emulator ports & configuration
  firestore.indexes.json    # Composite indexes (empty initial configuration)
  firestore.rules           # Security rules (open for local dev emulator)
  test-reports/             # Archived QA sign-off reports
  test-results/             # Test execution logs and coverage artifacts
  ```
- **Standard Port Assignments & Environment Variables:**
  - **Go Echo Backend Server:** Port `8080` (configurable via `PORT`)
  - **Firestore Emulator:** Port `8085` (`FIRESTORE_EMULATOR_HOST=localhost:8085`)
  - **Firebase Auth Emulator:** Port `9099` (`FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`)
  - **Firebase Emulator UI:** Port `4000` (`http://localhost:4000`)
  - **Vite Frontend Dev Server:** Port `5173` (`http://localhost:5173`)

---

## 3. API Contracts & Endpoints

### 3.1 Health Check
- **HTTP Method & Path:** `GET /api/health`
- **Request Payload:** None
- **Response Headers:** `Content-Type: application/json; charset=UTF-8`, CORS headers
- **Response Payload (`200 OK`):**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-08-28T05:00:00Z",
    "version": "0.1.0"
  }
  ```

---

## 4. UI / UX & Interaction Flow (Collaborate with @ui-designer)
- **Initial Frontend Shell:**
  - Clean Tailwind CSS baseline with dark/light mode foundational variables.
  - Minimal layout displaying application header, current system date, and connection status indicator to the Go backend (`/api/health`).
  - Active/healthy state: Displays a green badge indicating `"Backend Connected (v0.1.0)"`.
  - Disconnected/error state: Displays a visible error banner indicating `"Backend Unreachable"` without crashing the app shell.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Backend Health Check & Middleware Verification
- **Given:** The Go Echo backend server is running with CORS and logging middleware enabled.
- **When:** A client issues a `GET` request to `/api/health`.
- **Then:** The server responds with HTTP status `200 OK`, `Content-Type: application/json`, and a JSON body containing:
  - `"status": "healthy"`
  - `"version": "0.1.0"`
  - `"timestamp"`: valid ISO-8601 string.
- **And:** Response includes standard CORS headers allowing client origins.

### Scenario 2: Frontend Backend Connection & Offline Error State
- **Given:** The Vite dev server is running on `http://localhost:5173`.
- **When:** The React application loads with the Go backend reachable.
- **Then:** The UI displays a green/active health badge with backend status and timestamp.
- **When:** The Go backend server is unreachable.
- **Then:** The React UI displays a visible error banner indicating backend disconnection without crashing the app shell.

### Scenario 3: Local Firebase Emulator Suite Health Check
- **Given:** Docker and Docker Compose are initialized with `docker-compose.yml`.
- **When:** Running `docker-compose up -d`.
- **Then:** Firestore emulator is accessible on `localhost:8085`.
- **And:** Auth emulator is accessible on `localhost:9099`.
- **And:** Emulator UI is accessible on `http://localhost:4000`.

### Scenario 4: Production Single-Binary Asset Embedding
- **Given:** The frontend production bundle has been generated in `frontend/dist`.
- **When:** The Go binary is compiled via `go build ./cmd/server` and executed.
- **Then:** Issuing a `GET` request to `/` returns HTTP `200` and the bundled frontend `index.html`.

---

## 6. Definition of Done Checklist
- [ ] Backend implementation with unit tests passing (`@developer`) -> output saved to `test-results/backend-test.log`
- [ ] Frontend scaffold with Tailwind CSS, TanStack Query, and Vitest suite passing (`@developer` / `@ui-designer`) -> output saved to `test-results/frontend-test.log`
- [ ] Docker compose & Firebase emulator configuration verified (`@devops-engineer`)
- [ ] Single-binary `go:embed` asset serving verified (`@developer`)
- [ ] Acceptance criteria verified with saved QA sign-off report in `test-reports/QA-REPORT-001-project-scaffolding-<YYYY-MM-DD>.md` (`@tester`)
