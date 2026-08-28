# Workflow 04: Blocker Triage & Daily Standup

- **Scrum Ceremony:** Daily Scrum & Impediment Removal
- **Participants:** All Agents + User
- **Trigger:** Any agent blocked by missing index, emulator failure, or ambiguous spec
- **Primary Output:** Immediate routing and impediment resolution

---

## Escalation Routing Matrix
- **Database / Index Blocker:** Route to `@devops-engineer` $\rightarrow$ Add composite index to `firestore.indexes.json` and restart emulator.
- **Emulator / Environment Failure:** Route to `@devops-engineer` $\rightarrow$ Inspect docker logs and restart containers.
- **Design / Styling Ambiguity:** Route to `@ui-designer` $\rightarrow$ Provide Tailwind classes and layout specs.
- **Specification / Requirement Ambiguity:** Route to `@product-owner` $\rightarrow$ Clarify and amend plan scenarios.
- **Defect / Regression:** Route to `@developer` $\rightarrow$ Debug and fix code.
