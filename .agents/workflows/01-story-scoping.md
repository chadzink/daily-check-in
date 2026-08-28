# Workflow 01: Backlog Refinement & Story Scoping

- **Scrum Ceremony:** Backlog Refinement / Story Grooming
- **Lead Agent:** `@product-owner`
- **Collaborators:** `@ui-designer`, `@devops-engineer`
- **Primary Input:** User requirements or item from `plans/ROADMAP.md`
- **Primary Output:** `/plans/PLAN-<feature-name>.md` meeting Definition of Ready (DoR)

---

## Process Flow
1. `@product-owner` clarifies domain constraints (`DaySession`, `Task`, `DayTask`, 4 rows, ritual wizards).
2. `@ui-designer` specifies component hierarchy, Tailwind tokens, and micro-interaction states.
3. `@devops-engineer` audits required Firestore composite indexes and environment settings.
4. `@product-owner` drafts Gherkin acceptance criteria (`Given / When / Then`) covering happy paths, edge cases, and validation rules.

## Definition of Ready (DoR) Checklist
- [ ] User story and scope boundaries clearly defined.
- [ ] Model impacts and Firestore collection mappings specified.
- [ ] API endpoint contracts and DTO schemas defined.
- [ ] UI interaction and design token specifications documented.
- [ ] Explicit Gherkin scenarios defined for happy and edge cases.
