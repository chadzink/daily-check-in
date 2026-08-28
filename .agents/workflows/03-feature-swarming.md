# Workflow 03: Feature Swarming & Implementation

- **Scrum Ceremony:** Sprint Execution / Pairing
- **Lead Agent:** `@developer`
- **Collaborators:** `@ui-designer`, `@devops-engineer`
- **Primary Input:** Approved plan & scheduled tasks
- **Primary Output:** Clean, fully-tested code ready for QA

---

## Process Flow
1. **Backend Layering:** Implement Echo handlers, services, and Firestore repositories with `ctx` propagation and standard error returns.
2. **Frontend State & Components:** Implement TanStack Query hooks, optimistic updates, and `@hello-pangea/dnd` board logic.
3. **UI Polishing (`@ui-designer` Pairing):** Apply Tailwind tokens, micro-animations, dark/light styles, and WCAG AA contrast.
4. **Pre-Flight Self-Verification:**
   - `go test -v ./...`
   - `npm test && npm run build`
   - `go build ./cmd/server`
5. **QA Handoff:** Notify `@tester` with summary of modified files and critical paths.
