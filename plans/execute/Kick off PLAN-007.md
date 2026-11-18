Initiate Sprint Milestone Kickoff and Feature Swarming for [PLAN-007-row-layout-health-page-and-logout.md](../PLAN-007-row-layout-health-page-and-logout.md) on branch `phase-7-prepare-for-launch`.

Coordinate the squad (@product-owner, @devops-engineer, @developer, @ui-designer, @tester) according to `.agents/skills/scrum-milestone-kickoff/SKILL.md` and `.agents/skills/scrum-feature-swarming/SKILL.md`:

1. **Infrastructure & Firebase Auth Emulator Seeding (@devops-engineer):**
   - Verify Firebase Local Emulators (`dailycheckin-emulators`: Firestore `:8085`, Auth `:9099`, UI `:4000`) are running and responsive.
   - Add or verify a seed mechanism (e.g., script / `Makefile` target) that provisions the default demo user `demo@dailycheckin.com` with password `Password123!` in the Firebase Auth Emulator (`:9099`).
   - Verify frontend Firebase environment configuration (`.env` / Vite env vars or sensible local emulator defaults) for `firebase/auth`.

2. **Backend Firebase Auth Middleware Wiring (@developer):**
   - Update `cmd/server/main.go` to initialize `*firebaseAuth.Client` via `app.Auth(ctx)` and pass it to `middleware.FirebaseAuthMiddleware(authClient)` (replacing `nil`).
   - Verify `internal/middleware/auth.go` validates `Authorization: Bearer <idToken>` issued by the Firebase Auth Emulator (`FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`).
   - Keep `GET /api/health` (and `HEAD /api/health`) lightweight and unauthenticated (`{ status, timestamp, version }`).

3. **Frontend Row Layout, Stage Marker Removal, Health Modal & Auth Flow (@ui-designer & @developer):**
   - **Row-Based Board Layout (`DailyBoard.tsx`):**
     - Switch from 4-column grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-4`) to stacked full-width horizontal rows (`flex flex-col gap-5`) for **Yesterday**, **Today**, **Blocked**, and **Backlog**, preserving `@hello-pangea/dnd` drag-and-drop.
   - **Remove Development Stage Markers (`App.tsx`):**
     - Remove `Milestone 6` header pill, `Milestone 6 • Single-Binary Packaging & Production Readiness` badge, and `Milestone 5: Interactive Calendar & Standup Export` footer text.
   - **System Health Popup Modal (`HealthModal.tsx` & `App.tsx`):**
     - Remove the header health pill, main-page offline banner, and 3-card connectivity grid from the main board.
     - Move them into `HealthModal.tsx` triggered by a `System Health` link/button in the footer.
   - **Firebase Auth & Logout (`firebase.ts`, `AuthContext.tsx`, `LoginPage.tsx`, `frontend/src/api/*`, `App.tsx`):**
     - Install `firebase` in `frontend/`.
     - Implement `AuthContext` (`onAuthStateChanged`, `signInWithEmailAndPassword`, `signOut`, `getIdToken`), `LoginPage` (with `demo@dailycheckin.com` / `Password123!` support), `Authorization: Bearer <idToken>` injection on API calls, and a Header **Logout** button (`data-testid="logout-button"`).

4. **QA Verification & Full System Regression (@tester):**
   - Run full automated test suites (`go test ./...`, `cd frontend && npm test`, `cd frontend && npm run build`, and `go build -o bin/dailycheckin ./cmd/server`) with sanitized logs in `test-results/`.
   - Execute browser E2E validation against the live Firebase Emulators and Go backend covering:
     1. Row-based layout (Yesterday -> Today -> Blocked -> Backlog stacked vertically) and drag-and-drop.
     2. Absence of Milestone/dev stage markers on `/`.
     3. Absence of status indicators on `/` and functional `System Health` footer link opening `HealthModal`.
     4. Logout button clearing session -> LoginPage -> signing back in as `demo@dailycheckin.com` / `Password123!`.
   - Archive final QA Sign-Off report in `test-reports/QA-REPORT-007-row-layout-health-and-logout-2026-11-18.md`.
