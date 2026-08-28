---
name: scrum-feature-swarming
description: Use this skill during Sprint Execution when implementing features, coordinating between backend and frontend, writing tests, and completing pre-flight handoffs.
---

# Scrum Feature Swarming & Implementation

This runbook guides **`@developer`** (with styling collaboration from **`@ui-designer`** and infrastructure support from **`@devops-engineer`**) through full-stack implementation and self-verification.

---

## Step-by-Step Procedure

### 1. Follow Architectural Boundaries
- **Backend (Go 1.23+ Echo):**
  - Keep `internal/api/` free of database calls.
  - Implement core logic, rollover rules, and transactions in `internal/service/`.
  - Pass `ctx context.Context` across all repository methods.
  - Map errors to sentinel types and corresponding HTTP status codes.
- **Frontend (React 18+ / TypeScript / Tailwind CSS):**
  - Use TanStack Query query key factories for cache invalidation.
  - Implement optimistic updates for checkbox toggles and task drag-and-drop.
  - Normalize dates as `YYYY-MM-DD` strings via `date-fns`.

### 2. UI Polish & Accessibility (`@ui-designer` Pairing)
- Ensure all interactive elements have visible focus rings and accessible labels.
- Verify Dark and Light theme styling in `index.css` and Tailwind classes.
- Ensure micro-animations for checkbox clicks and drag previews.

### 3. Pre-Flight Self-Verification
Before handing off to `@tester`, execute all local validation checks:
```bash
# 1. Run Go unit & service tests
go test -v ./...

# 2. Run frontend unit tests
cd frontend && npm test

# 3. Verify frontend production build
npm run build

# 4. Verify Go binary builds with embedded assets
cd .. && go build -o bin/dailycheckin ./cmd/server
```

### 4. Handoff Protocol to `@tester`
Provide a concise handoff note including:
- Files modified and created.
- Key implementation choices and edge cases handled.
- Confirmation of clean pre-flight test results.
