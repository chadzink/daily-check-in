# PLAN-007: Row-Based Execution Board, Dedicated Health Page & Session Logout (Milestone 7)

- **Milestone:** Milestone 7 — UI Polish, Health Diagnostics Separation & Auth Session Controls
- **Document Reference:** `plans/PLAN-007-row-layout-health-page-and-logout.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@ui-designer`, `@developer`, `@devops-engineer`, `@tester`
- **Ceremony:** Backlog Refinement & Story Scoping (Workflow 01)
- **Status:** **Ready for Implementation** (Auth Mechanism locked: Full Firebase Auth SDK + default user `demo@dailycheckin.com`)

---

## 1. Feature Overview & User Stories

### 1.1 User Stories
- **Row-Based Execution Board:**
  *As a daily planner, I want the execution board to stack **Yesterday**, **Today**, **Blocked**, and **Backlog** as full-width horizontal rows rather than side-by-side columns, so that task titles, blocker reasons, and priority controls have ample horizontal breathing room and read naturally top-to-bottom.*
- **Clean Production UI (No Dev Stage Markers):**
  *As an end user, I want development stage markers (such as "Milestone 6" and "Milestone 5" badges/labels) removed from the header, board title, and footer, so that the application feels like a polished, production-ready product.*
- **Dedicated Health Check Modal:**
  *As a user and operator, I want backend, Firestore, and authentication status indicators moved off the main execution board into a dedicated System Health popup modal opened from a link in the footer, so that the primary workspace stays focused on daily execution while system diagnostics remain one click away.*
- **Session Logout & Re-Authentication:**
  *As a user, I want a Logout button in the top navigation bar so that I can sign out of my current session and log back in again (or switch accounts).*

### 1.2 Scope Boundaries
- **In-Scope:**
  1. **Row-Based Board Layout (`DailyBoard.tsx`, `ExecutionRow.tsx`, row components):**
     - Replace the 4-column desktop grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) in `frontend/src/components/board/DailyBoard.tsx` with a vertical stack of full-width rows (`flex flex-col gap-5`).
     - Preserve all `@hello-pangea/dnd` intra-row reordering and inter-row transitions (`TODAY <-> BLOCKED`, `BACKLOG -> TODAY`, `TODAY/BLOCKED -> BACKLOG`).
  2. **Remove Development Stage Markers (`App.tsx`):**
     - Remove the `Milestone 6` pill next to the `DailyCheckIn` brand title.
     - Remove the `Milestone 6 • Single-Binary Packaging & Production Readiness` badge above the `h1` board heading.
     - Update the footer text from `DailyCheckIn • Scrum Execution Rituals • Milestone 5: Interactive Calendar & Standup Export` to a clean product footer (e.g., `DailyCheckIn • Scrum Execution Rituals`) with a link/button to open the System Health modal.
  3. **System Health Popup Modal & Footer Trigger (`App.tsx`, new `HealthModal.tsx`):**
     - Remove the header health status pill (`status-loading`, `status-badge-error`, `status-badge-healthy`), the main-page `offline-banner`, and the 3-card `System Stack & Connectivity Grid` (`Go Echo Backend`, `Cloud Firestore`, `Auth & UI`) from the main board view.
     - Render those status indicators inside a popup modal (`HealthModal.tsx`) with a close button (`Escape` / backdrop click / Close button).
     - Add a `System Health` link/button in the main page footer that opens `HealthModal`.
  4. **Logout Button & Full Firebase Auth Session Flow (`firebase.ts`, `AuthContext.tsx`, `LoginPage.tsx`, `App.tsx`, `frontend/src/api/*`, `cmd/server/main.go`):**
     - Install and configure the `firebase` JS SDK (`firebase/auth`), connecting to the Firebase Auth Emulator (`localhost:9099`) in local/dev environments.
     - Seed/provision a default demo user (`demo@dailycheckin.com` / `Password123!`) in the local Auth Emulator setup (e.g., via seed script or emulator startup/login helper).
     - Create `frontend/src/context/AuthContext.tsx` wrapping Firebase `onAuthStateChanged`, `signInWithEmailAndPassword`, and `signOut`.
     - Add a **Logout** button in the top navigation bar (`App.tsx` header) when authenticated.
     - Render a clean Email/Password Sign-In view (`LoginPage.tsx`) when unauthenticated, allowing the user to log back in (with optional quick-fill/hint for `demo@dailycheckin.com` in dev/emulator mode).
     - Attach `Authorization: Bearer <firebase-id-token>` to all API requests in `frontend/src/api/*`.
     - Initialize `*firebaseAuth.Client` in `cmd/server/main.go` and pass it to `middleware.FirebaseAuthMiddleware(authClient)` so backend verifies Firebase ID tokens.
- **Out-of-Scope:**
  - Multi-tenant organization workspaces or role-based access control (RBAC).
  - User registration/password-reset email flows beyond basic sign-in/sign-out.
  - Changes to `DaySession`, `Task`, or `DayTask` Firestore schemas.

---

## 2. Architecture & Data Model Impacts

### 2.1 Data Model Impacts
- **Firestore Models (`DaySession`, `Task`, `DayTask`):** **Zero impact.** No schema changes or new `firestore.indexes.json` composite indexes are required.

### 2.2 Frontend Architecture Impacts
- **Layout (`frontend/src/components/board/DailyBoard.tsx`):**
  - Change container from `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start` to `flex flex-col gap-5` so **Yesterday**, **Today**, **Blocked**, and **Backlog** render as stacked horizontal rows.
  - Review `ExecutionRow.tsx` and `TaskCard.tsx` widths/spacing so cards look balanced in full-width rows (e.g., compact single-line or responsive multi-column card grid inside rows if desired, while keeping vertical `Droppable` list semantics for `@hello-pangea/dnd`).
- **Health Modal (`frontend/src/components/HealthModal.tsx` & `App.tsx`):**
  - Manage `isHealthModalOpen` state in `App.tsx` (no extra SPA router or `react-router-dom` dependency required). Clicking `System Health` in the footer opens `HealthModal`.
- **Authentication (`firebase/auth` & `frontend/src/context/AuthContext.tsx`):**
  - Install `firebase` in `frontend/package.json` and initialize `getAuth()` (connecting to `connectAuthEmulator(auth, 'http://localhost:9099')` when running against local emulators).
  - Create `AuthProvider` and `useAuth()` hook (`user`, `isAuthenticated`, `isLoading`, `login(email, password)`, `logout()`, `getIdToken()`) integrated in `main.tsx` or `App.tsx`.
  - All `fetch` calls in `frontend/src/api/tasks.ts` (and calendar/ritual API modules) must fetch the active Firebase ID token (`await user.getIdToken()`) and send `Authorization: Bearer <idToken>`.
- **Default Demo User Seeding:**
  - Provision `demo@dailycheckin.com` with password `Password123!` in the Firebase Auth Emulator (e.g. via a startup/seed script or `Makefile` target using the Auth Emulator REST/Admin API) so the user can immediately sign in and test logout/re-login.

### 2.3 Backend Architecture Impacts
- **Health Endpoint (`internal/api/health.go`):**
  - Existing `GET /api/health` (and `HEAD /api/health`) stays lightweight, remaining unauthenticated and returning `{ status, timestamp, version }` without live Firestore/Auth dependency probes.
- **Auth Middleware (`internal/middleware/auth.go` & `cmd/server/main.go`):**
  - Update `cmd/server/main.go` to initialize `*firebaseAuth.Client` from the Firebase App (`app.Auth(ctx)`) and pass it to `middleware.FirebaseAuthMiddleware(authClient)` instead of `nil`.
  - Ensure `Authorization: Bearer <idToken>` tokens issued by the Firebase Auth Emulator (`FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`) are verified cleanly by the Go Firebase Admin SDK.

---

## 3. API Contracts & Endpoints

### 3.1 Existing Health Endpoint (Unchanged — Lightweight)
- **`GET /api/health`** (unauthenticated, also supports `HEAD`)
  - **Response `200 OK`:**
    ```json
    {
      "status": "healthy",
      "timestamp": "2026-11-17T20:00:00Z",
      "version": "0.1.0"
    }
    ```

### 3.2 Authenticated Domain Endpoints
- All `/api/backlog*`, `/api/tasks*`, `/api/days*`, `/api/calendar*` endpoints continue using their existing contracts, with requests carrying:
  - `Authorization: Bearer <firebase-id-token>` issued by Firebase Auth (`demo@dailycheckin.com` or any registered Firebase user).
- **Response `401 Unauthorized`** (when unauthenticated and not in fallback mode):
  ```json
  {
    "error": "Unauthorized",
    "message": "Missing or invalid authorization credentials",
    "code": "UNAUTHORIZED"
  }
  ```

---

## 4. UI / UX & Interaction Flows (Collaborate with `@ui-designer`)

### 4.1 Row-Based Execution Board Layout
- **Vertical Row Stack:**
  1. **Yesterday** (`YesterdayRow`) — Read-only completed tasks from the prior active workday.
  2. **Today** (`TodayRow`) — Prioritized 1..N active tasks with inline Quick Add (`N` shortcut).
  3. **Blocked** (`BlockedRow`) — Blocked tasks with explicit blocker reason chips and Unblock action.
  4. **Backlog** (`BacklogRow`) — Persistent global backlog with inline Quick Add (`B` shortcut) and "Pull into Today" action.
- **Drag-and-Drop Mechanics (`@hello-pangea/dnd`):**
  - Each `ExecutionRow` keeps its `droppableId` (`YESTERDAY` disabled, `TODAY`, `BLOCKED`, `BACKLOG`).
  - Vertical stacking makes dragging between adjacent rows (e.g., `TODAY` <-> `BLOCKED`, `BACKLOG` -> `TODAY`) natural and predictable across all viewport widths.

### 4.2 Header & Footer Cleanup
- **Header (`App.tsx`):**
  - Left: `DailyCheckIn` logo + title (no `Milestone 6` badge).
  - Right: `CalendarWidget` + **Logout** button (`LogOut` icon from `lucide-react`, `data-testid="logout-button"`).
- **Footer (`App.tsx`):**
  - Clean product label (`DailyCheckIn • Scrum Execution Rituals`) + clickable link/button `System Health` (`data-testid="footer-health-link"`) that opens `HealthModal`.

### 4.3 System Health Popup Modal (`HealthModal.tsx`)
- Opened via the `System Health` link in the footer; dismissed via Close button, backdrop click, or `Escape` key.
- Displays:
  - Modal header with title `System Health` and Close button.
  - Overall connection status banner (Healthy / Offline with Retry button).
  - 3 status cards moved from `App.tsx`:
    1. **Go Echo Backend** (`/api/health` status, version, timestamp)
    2. **Cloud Firestore** (connectivity/emulator status)
    3. **Authentication** (Firebase Auth provider/session status)

### 4.4 Logout & Re-Login Flow
1. User clicks **Logout** (`data-testid="logout-button"`) in the header.
2. `AuthContext.logout()` calls Firebase `signOut(auth)`, clears TanStack Query cache (`queryClient.clear()`), and transitions the UI to `LoginPage`.
3. On `LoginPage`, user enters email and password (e.g., `demo@dailycheckin.com` / `Password123!`) and submits.
4. `AuthContext.login(email, password)` calls `signInWithEmailAndPassword(auth, email, password)`, obtains the Firebase ID token, and renders the main `DailyBoard` for the authenticated user.

---

## 5. Acceptance Criteria (Gherkin Scenarios)

### Scenario 1: Row-Based Execution Board Layout & Drag-and-Drop
- **Given:** The user is authenticated and viewing the main execution board on desktop (`1280x800`) or mobile (`375x812`).
- **When:** The board renders **Yesterday**, **Today**, **Blocked**, and **Backlog**.
- **Then:** Each section renders as a stacked horizontal row (vertical Y-offset increases from Yesterday -> Today -> Blocked -> Backlog) rather than side-by-side columns.
- **And:** Dragging a task from **Today** to **Blocked** opens `BlockerReasonModal`, and dragging from **Backlog** to **Today** pulls the task into Today.

### Scenario 2: Removal of Development Stage Markers
- **Given:** The user views the main application page (`/`).
- **When:** Inspecting the header, board title section, and footer.
- **Then:** No text matching `Milestone 5`, `Milestone 6`, or similar development stage badges is rendered anywhere in the UI.

### Scenario 3: Status Indicators Moved to System Health Popup Modal
- **Given:** The user is on the main execution board (`/`).
- **When:** The page renders.
- **Then:** No backend health pill, Firestore status card, or Auth status card is displayed on the main board.
- **And:** The footer contains a `System Health` link/button.
- **When:** The user clicks `System Health`.
- **Then:** A popup modal opens displaying the backend, Firestore, and authentication status indicators, and can be closed to return to the board.

### Scenario 4: User Logout and Re-Login Flow
- **Given:** The user (`demo@dailycheckin.com`) is signed in via Firebase Auth and viewing the execution board.
- **When:** The user clicks the **Logout** button in the top navigation bar.
- **Then:** Firebase `signOut` completes, cached user task data is cleared from the UI, and the Login screen is displayed.
- **When:** The user submits `demo@dailycheckin.com` and `Password123!` on the Login screen.
- **Then:** The user is authenticated via Firebase Auth and redirected back to the execution board with their tasks loaded.

### Scenario 5: Edge Case — Backend Offline in Health Modal
- **Given:** The user opens the `System Health` modal while the Go backend is unreachable.
- **When:** `GET /api/health` fails.
- **Then:** The Health modal displays an offline error alert with a functional **Retry** button, while the main board remains free of status card clutter.

---

## 6. Vertical Slices & Definition of Done Checklist

### Vertical Slices
1. **Slice 1 (Layout & Cleanup):** Switch `DailyBoard.tsx` to stacked rows + remove Milestone badges/labels in `App.tsx`.
2. **Slice 2 (Health Modal):** Extract status cards/banner from `App.tsx` into `HealthModal.tsx` and wire the footer `System Health` trigger.
3. **Slice 3 (Firebase Auth & Logout):** Install `firebase`, wire `firebase/auth` + `AuthContext.tsx` + `LoginPage.tsx` + `Authorization: Bearer <idToken>` header injection, initialize `*firebaseAuth.Client` in `cmd/server/main.go`, seed default user `demo@dailycheckin.com` (`Password123!`), and add Header **Logout** button.
4. **Slice 4 (Verification):** Update/add Vitest unit tests (`DailyBoard.test.tsx`, `HealthModal.test.tsx`, `AuthContext.test.tsx`) and run `/browser` E2E validation.

### Definition of Done Checklist
- [x] `DailyBoard.tsx` renders **Yesterday**, **Today**, **Blocked**, and **Backlog** as stacked rows with working drag-and-drop (`@developer` / `@ui-designer`)
- [x] All Milestone/dev stage markers removed from `App.tsx` (`@developer`)
- [x] Status indicators removed from main board and moved to `HealthModal` opened from the footer (`@developer` / `@ui-designer`)
- [x] Full Firebase Auth (`firebase/auth` + `*firebaseAuth.Client` in `cmd/server/main.go`), `LoginPage`, default emulator user `demo@dailycheckin.com` (`Password123!`), and Header **Logout** button implemented and tested (`@developer`)
- [x] Frontend build (`npm run build` with strict `tsc`) and `go test ./...` pass (`@developer`)
- [x] Single-binary `go:embed` build serves the updated SPA cleanly (`@devops-engineer`)
- [ ] Live Chrome `/browser` E2E verification completed (unit/API checks archived in `test-reports/QA-REPORT-007-row-layout-health-and-logout-2026-11-18.md`; browser run blocked by missing `DevToolsActivePort`) (`@tester`)
