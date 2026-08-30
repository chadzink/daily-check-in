# Sprint Retrospective: Milestone 1 (PLAN-001 Project Scaffolding)

- **Milestone:** Milestone 1 — Project Scaffolding & Local Infrastructure
- **Plan Reference:** [PLAN-001-project-scaffolding.md](../../plans/PLAN-001-project-scaffolding.md)
- **Branch:** `PLAN-001-project-scaffolding`
- **Execution Date:** 2026-08-30
- **Participants:** Full Squad (`@product-owner`, `@devops-engineer`, `@developer`, `@ui-designer`, `@tester`, User)
- **Status:** **COMPLETE**

---

## 1. Milestone Delivery & Metrics

The squad delivered the core architectural skeleton, local emulator infrastructure, Echo backend, React + TypeScript SPA, and single-binary packaging.

| Metric | Target | Actual | Assessment |
| :--- | :--- | :--- | :--- |
| **Backend Unit Test Coverage (`internal/api`)** | > 80% | **100.0%** | Exceeded |
| **Frontend Component Tests** | All passing | **3 / 3 (100%)** | Met |
| **Vite Bundle Build Duration** | < 10s | **~2.0s** | Exceeded |
| **Single-Binary Artifact** | Self-contained SPA | **`bin/dailycheckin`** | Met |
| **Local Emulator Startup** | < 15s | **~3s** (cached) | Met |
| **Gherkin Acceptance Criteria** | 4 / 4 | **4 / 4 Passed** | Met |

---

## 2. What Went Well (Practices to Maintain)

1. **Single-Binary `go:embed` Distribution:**
   Packaging the production Vite bundle directly into the Go executable eliminates static file hosting complexity and guarantees identical frontend/backend version alignment.
2. **Strict Layer Decoupling:**
   Echo routing, HTTP handlers, middleware, and domain models are cleanly segmented, establishing clear architectural patterns for Milestone 2.
3. **Local Firebase Emulator Containerization:**
   Encapsulating Firestore (:8085), Auth (:9099), and UI (:4000) inside Docker Compose guarantees reproducible local developer environments without host system dependencies.
4. **Tailwind Design System Foundation:**
   The UI delivers a polished dark-mode aesthetic with custom brand palettes, glassmorphic panels, and real-time backend connectivity polling.

---

## 3. What Slowed Us Down (Impediments & Blockers Resolved)

1. **Firebase Tools JRE Requirement:**
   - *Friction:* Initial emulator container failed with `Error: firebase-tools no longer supports Java version before 21`.
   - *Resolution:* Updated `docker/emulator/Dockerfile` from `openjdk17-jre-headless` to `openjdk21-jre-headless`.
2. **Gitignore Pattern Directory Masking:**
   - *Friction:* An unanchored `server` rule in `.gitignore` silently masked `cmd/server/main.go`.
   - *Resolution:* Anchored the binary ignore pattern to `/server`.
3. **TanStack Query Component Retry in Vitest:**
   - *Friction:* A hardcoded `retry: 1` prop within `useQuery` overrode the test `QueryClient` defaults, delaying failure assertions.
   - *Resolution:* Centralized retry policies in the application's root `QueryClient`.

---

## 4. Continuous Improvements & Codified Changes

In accordance with [`.agents/workflows/07-retrospective.md`](../../.agents/workflows/07-retrospective.md), the squad codified the following lasting improvements into project standards:

1. **Privacy & Path Hygiene Audit in DoD:**
   - Codified in [`GEMINI.md`](../../GEMINI.md), [`docs/WORKFLOWS.md`](../WORKFLOWS.md), and [`.agents/skills/scrum-qa-signoff/SKILL.md`](../../.agents/skills/scrum-qa-signoff/SKILL.md).
   - All test logs and reports committed to `test-results/` and `test-reports/` must contain strictly project-relative paths with zero personal identifiers or machine paths (`/Users/...`).
2. **Automated Log Sanitizer (`scripts/sanitize-test-output.sh`):**
   - Created [scripts/sanitize-test-output.sh](../../scripts/sanitize-test-output.sh) to automatically sanitize test outputs in CI and local test runs.
3. **Unified Developer Workflow Automation (`Makefile`):**
   - Introduced [Makefile](../../Makefile) providing standard commands for `make dev`, `make emulators`, `make test`, `make build`, and `make docker-build`.

---

## 5. Next Sprint Transition (Milestone 2 Kickoff)

With Milestone 1 accepted and reviewed:
- **Target Plan:** [PLAN-002-dual-task-model-persistence.md](../../plans/PLAN-002-dual-task-model-persistence.md)
- **Focus:** Domain entities (`DaySession`, `Task`, `DayTask`), Firestore repositories, and automated rollover service logic.
