# QA Acceptance & Sign-Off Report: PLAN-008 Stale Firebase Refresh Token Recovery

- **Plan Reference:** [PLAN-008-auth-invalid-refresh-token-recovery.md](../plans/PLAN-008-auth-invalid-refresh-token-recovery.md)
- **Feature Name:** Stale Firebase Refresh Token Recovery (`auth/invalid-refresh-token`)
- **Branch:** `fix/PLAN-008-auth-invalid-refresh-token`
- **Execution Date:** 2026-11-21
- **Lead QA Engineer:** `@tester`
- **Collaborators:** `@developer`, `@product-owner`
- **Sign-Off Status:** **APPROVED**

---

## 1. Executive Summary

This bug fix resolves a local-development and returning-user error loop where a persisted Firebase Auth refresh token becomes invalid (for example, after a Firebase Auth Emulator restart):
1. **Token Error Detection & Sign-Out (`frontend/src/api/client.ts`):**
   - `authFetch` wraps `currentUser.getIdToken()` in `try/catch`, checks `isInvalidTokenError(err)` against `INVALID_TOKEN_ERROR_CODES` (`auth/invalid-refresh-token`, `auth/user-token-expired`, `auth/user-not-found`, `auth/invalid-user-token`, `auth/token-expired`) via both `err.code` and `Error.message`, calls `await signOut(auth).catch(() => {})`, and rethrows `err`.
2. **Query Cache Reset (`frontend/src/context/AuthContext.tsx`):**
   - `AuthProvider` invokes `queryClient.clear()` whenever `onAuthStateChanged` transitions to `!firebaseUser`, clearing stale query data and error states.
3. **Unit Tests (`frontend/src/api/client.test.ts`, `frontend/src/context/AuthContext.test.tsx`):**
   - Added 4 tests in `client.test.ts` (structured `auth/invalid-refresh-token`, message-only `auth/invalid-refresh-token`, normal Bearer token attachment, and non-token error pass-through without `signOut`).
   - Added 1 test in `AuthContext.test.tsx` verifying `queryClient.clear()` and auth state reset when `onAuthStateChanged` emits `null`.

---

## 2. Automated Test & Build Verification

| Suite / Check | Command | Scope | Result |
| :--- | :--- | :--- | :--- |
| **Frontend Vitest Suite** | `cd frontend && npm test -- --run` | 11 test files (`client.test.ts`, `AuthContext.test.tsx`, `App.test.tsx`, `DailyBoard.test.tsx`, `TaskCard.test.tsx`, `CalendarWidget.test.tsx`, `HistoricalDateBanner.test.tsx`, `StandupExportModal.test.tsx`, `CheckOutModal.test.tsx`, `MorningCheckInModal.test.tsx`, `standupGenerator.test.ts`) | **PASS** (30 / 30 tests passed) |
| **Frontend Production Build** | `cd frontend && npm run build` | Strict `tsc && vite build` | **PASS** (0 TS errors; `dist/` built) |
| **Go Backend Tests** | `go test -v ./...` | `cmd/server`, `internal/api`, `internal/middleware`, `internal/repository`, `internal/service` | **PASS** (all 5 test packages passed) |
| **Single-Binary Build** | `go build -o bin/dailycheckin ./cmd/server` | Embedded SPA + Go backend | **PASS** (`bin/dailycheckin` built) |

---

## 3. Gherkin Acceptance Criteria Status

| Scenario | Description | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Scenario 1** | Stale Refresh Token Recovery (`auth/invalid-refresh-token` triggers `signOut(auth)` and rethrows) | Vitest (`frontend/src/api/client.test.ts`) | **PASS** |
| **Scenario 2** | Normal Authenticated Fetch (`Authorization: Bearer <token>` attached without `signOut`) | Vitest (`frontend/src/api/client.test.ts`) | **PASS** |
| **Scenario 3** | Sign-Out Query Cache Reset (`onAuthStateChanged` emitting `null` calls `queryClient.clear()` and resets state) | Vitest (`frontend/src/context/AuthContext.test.tsx`) | **PASS** |

---

## 4. Privacy & Path Hygiene Confirmation

- All file references in this report use project-relative paths.
- No absolute local filesystem paths, personal user identifiers, or credentials are included.
