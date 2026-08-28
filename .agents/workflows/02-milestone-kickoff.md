# Workflow 02: Sprint & Milestone Kickoff

- **Scrum Ceremony:** Sprint Planning
- **Lead Agent:** `@product-owner`
- **Collaborators:** Full Squad
- **Primary Input:** Approved `/plans/PLAN-*.md`
- **Primary Output:** Feature branch & verified local development environment

---

## Process Flow
1. **Branch Setup:** Check out `feat/<milestone-or-feature>`.
2. **Environment Verification (`@devops-engineer`):**
   - Start emulators: `docker-compose up -d`.
   - Verify Firestore (`:8080`), Auth (`:9099`), and UI (`:4000`).
   - Export emulator host variables.
3. **Execution Queue:** Break down implementation order:
   `internal/model` $\rightarrow$ `internal/repository` $\rightarrow$ `internal/service` $\rightarrow$ `internal/api` $\rightarrow$ `frontend/src/` $\rightarrow$ `test-reports/`.
