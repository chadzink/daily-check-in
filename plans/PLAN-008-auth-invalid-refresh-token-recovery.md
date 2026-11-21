# PLAN-008: Stale Firebase Refresh Token Recovery (`auth/invalid-refresh-token`)

- **Branch / Fix Reference:** `fix/PLAN-008-auth-invalid-refresh-token`
- **Document Reference:** `plans/PLAN-008-auth-invalid-refresh-token-recovery.md`
- **Lead Agent:** `@product-owner`
- **Collaborating Agents:** `@developer`, `@tester`
- **Ceremony:** Bugfix Review & Retrospective Documentation
- **Status:** **Implemented, Verified & Approved**

---

## 1. Bug Overview & Root Cause

### 1.1 Problem Statement & User Impact
*As a local developer or returning user, when my persisted Firebase Auth refresh token becomes invalid (for example, after a Firebase Auth Emulator restart), I want the application to automatically clear my stale session and return me to the sign-in screen, so that I am not trapped in a broken `Failed to load execution board` / `Retry` error loop.*

### 1.2 Root Cause Analysis
1. When the Firebase Auth Emulator restarts, previously issued refresh tokens stored in the browser's IndexedDB are invalidated.
2. On page load, the Firebase JS SDK still hydrated `auth.currentUser` from IndexedDB.
3. Subsequent API calls via `authFetch` invoked `currentUser.getIdToken()`, which failed with `Firebase: Error (auth/invalid-refresh-token)`.
4. Because `authFetch` did not sign out on invalid-token errors, `auth.currentUser` remained non-null and TanStack Query surfaced `Failed to load execution board` with a `Retry` button that repeatedly hit the same failing `getIdToken()` path.

### 1.3 Scope Boundaries
- **In-Scope:**
  - Detect invalid/expired Firebase token errors in `frontend/src/api/client.ts` (`authFetch`) and trigger `signOut(auth)` before rethrowing.
  - Clear the TanStack Query cache (`queryClient.clear()`) in `frontend/src/context/AuthContext.tsx` whenever `onAuthStateChanged` transitions to `!firebaseUser`.
  - Add unit tests in `frontend/src/api/client.test.ts` covering invalid refresh token recovery and normal Bearer token attachment.
- **Out-of-Scope:**
  - Changes to `DaySession`, `Task`, or `DayTask` Firestore schemas or `firestore.indexes.json`.
  - Backend Go Echo API or middleware changes.
  - Wrapping `AuthContext`'s standalone `getIdToken` helper (all API traffic routes through `authFetch`).

---

## 2. Architecture & Auth Flow Impact

### 2.1 Data Model Impacts
- **Firestore Models (`DaySession`, `Task`, `DayTask`):** **Zero impact.** No schema or composite index changes required.

### 2.2 Frontend Auth & API Client Flow
1. **Token Error Detection & Sign-Out (`frontend/src/api/client.ts`):**
   - `INVALID_TOKEN_ERROR_CODES` tracks:
     - `auth/invalid-refresh-token`
     - `auth/user-token-expired`
     - `auth/user-not-found`
     - `auth/invalid-user-token`
     - `auth/token-expired`
   - `isInvalidTokenError(err)` checks both structured `err.code` values and `Error.message` substrings.
   - `authFetch` wraps `await currentUser.getIdToken()` in `try/catch`; when `isInvalidTokenError(err)` is true, it calls `await signOut(auth).catch(() => {})` and rethrows `err`.
2. **Query Cache Reset (`frontend/src/context/AuthContext.tsx`):**
   - `onAuthStateChanged(auth, (firebaseUser) => ...)` sets `user`, marks `isLoading` false, and calls `queryClient.clear()` whenever `!firebaseUser`.
   - Clearing the cache prevents stale error states or previous-user query data from persisting after automatic or manual sign-out.
3. **Unit Tests (`frontend/src/api/client.test.ts`):**
   - Verifies `authFetch('/api/health')` calls `signOut(auth)` and rethrows when `getIdToken()` rejects with `auth/invalid-refresh-token`.
   - Verifies `authFetch('/api/health')` attaches `Authorization: Bearer valid-jwt-token` and does not call `signOut` when `getIdToken()` succeeds.

---

## 3. Acceptance Criteria (Gherkin Scenarios)

- **Scenario 1: Stale Refresh Token Recovery**
  - **Given:** `auth.currentUser` holds a stale session whose `getIdToken()` rejects with `auth/invalid-refresh-token` (e.g., after an Auth Emulator restart).
  - **When:** The app executes an API request via `authFetch`.
  - **Then:** `authFetch` calls `signOut(auth)` to clear the stale IndexedDB session, rethrows the error, `onAuthStateChanged` receives `null`, `queryClient.clear()` resets cached queries, and the UI transitions cleanly to the sign-in screen without a stuck `Retry` loop.

- **Scenario 2: Normal Authenticated Fetch**
  - **Given:** `auth.currentUser` is authenticated and `getIdToken()` resolves with a valid JWT token.
  - **When:** The app executes an API request via `authFetch`.
  - **Then:** `authFetch` attaches `Authorization: Bearer <token>` to the request headers, forwards the `fetch` call, and does not call `signOut(auth)`.

- **Scenario 3: Sign-Out Query Cache Reset**
  - **Given:** The user has cached board or session queries in TanStack Query.
  - **When:** `onAuthStateChanged` fires with `null` (via automatic stale-token sign-out or explicit logout).
  - **Then:** `AuthProvider` sets `user` to `null`, sets `isLoading` to `false`, and invokes `queryClient.clear()` so no stale authenticated data or error states remain.

---

## 4. Definition of Done (DoD) Review & Product Owner Sign-Off

- [x] Root cause and scope boundaries documented in `PLAN-008`
- [x] `frontend/src/api/client.ts` implements `isInvalidTokenError` and `signOut(auth)` recovery in `authFetch`
- [x] `frontend/src/context/AuthContext.tsx` clears `queryClient` when `onAuthStateChanged` emits `!firebaseUser`
- [x] `frontend/src/api/client.test.ts` covers both `auth/invalid-refresh-token` sign-out and normal Bearer token attachment
- [x] Frontend test suite (`cd frontend && npm test`) and strict TypeScript build (`cd frontend && npm run build`) verified on branch `fix/PLAN-008-auth-invalid-refresh-token`
