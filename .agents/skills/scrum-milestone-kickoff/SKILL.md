---
name: scrum-milestone-kickoff
description: Use this skill during Sprint Planning / Milestone Kickoff to verify local emulator health, configure feature branches, and sequence implementation dependencies.
---

# Scrum Sprint / Milestone Kickoff

This runbook guides the squad during **Milestone Kickoff & Sprint Planning** when starting a new implementation cycle from [ROADMAP.md](../../../plans/ROADMAP.md).

---

## Step-by-Step Procedure

### 1. Git Branch Setup
- Ensure working directory is clean: `git status`.
- Check out or create the feature branch:
  ```bash
  git checkout -b feat/<milestone-or-feature-name>
  ```

### 2. Emulator & Infrastructure Health Check (`@devops-engineer`)
- Start Firebase Local Emulators via Docker Compose:
  ```bash
  docker-compose up -d
  ```
- Verify emulator availability:
  - Firestore on `localhost:8080` (or `localhost:8085` depending on compose mapping)
  - Auth on `localhost:9099`
  - Emulator UI on `localhost:4000`
- Confirm environment variables:
  ```bash
  export FIRESTORE_EMULATOR_HOST="localhost:8080"
  export FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"
  ```

### 3. Dependency Sequencing & Task Breakdown (`@product-owner` & `@developer`)
Review `/plans/PLAN-<feature-name>.md` and establish the layer-by-layer dependency sequence:
1. **Model Layer:** `internal/model/` (domain entities and DTOs)
2. **Repository Layer:** `internal/repository/` (Firestore queries and mappings)
3. **Service Layer:** `internal/service/` (business rules, transactions, rollover logic)
4. **API Layer:** `internal/api/` (Echo handlers, routes, input validation)
5. **Frontend State:** `frontend/src/api/` & `frontend/src/hooks/` (TanStack Query keys and hooks)
6. **Frontend UI:** `frontend/src/components/` (React components styled with Tailwind CSS)
7. **Pre-flight & Hand-off:** Self-tests before handoff to `@tester`.
