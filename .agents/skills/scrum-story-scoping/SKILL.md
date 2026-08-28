---
name: scrum-story-scoping
description: Use this skill during Backlog Refinement when scoping new features, authoring /plans/PLAN-*.md files, defining Gherkin acceptance criteria, and achieving Definition of Ready (DoR).
---

# Scrum Story Scoping & Definition of Ready (DoR)

This runbook guides **`@product-owner`**, with input from **`@ui-designer`** and **`@devops-engineer`**, to scope, specify, and groom features before development begins.

---

## Pre-Requisites
- User story or requirement identified in [ROADMAP.md](../../../plans/ROADMAP.md) or requested by the user.
- Familiarity with domain models in [SPECIFICATION.md](../../../docs/SPECIFICATION.md).

---

## Step-by-Step Procedure

### 1. Scope Boundary & Vertical Slicing
- Identify the core user value. Prevent enterprise feature creep (e.g. single-user ritual workflow before multi-tenancy).
- Decompose into vertical slices: Backend API $\rightarrow$ Frontend State $\rightarrow$ UI Polish $\rightarrow$ E2E Validation.

### 2. Collaborate with `@ui-designer`
- Identify required UI components: 4-row execution board, top-left calendar widget, ritual modals, or standup export.
- Define interaction states: drag-and-drop feedback, loading skeletons, empty states, micro-animations, and theme support.

### 3. Collaborate with `@devops-engineer`
- Check Firestore query patterns against `firestore.indexes.json`.
- Identify any special environment configurations or emulator ports.

### 4. Author the Implementation Plan
Create or update `plans/PLAN-<feature-name>.md` using the standard template:
1. **Feature Overview & User Story**
2. **Architecture & Data Model Impacts** (`DaySession`, `Task`, `DayTask`)
3. **API Contracts & Endpoints** (HTTP paths, request/response DTO schemas)
4. **UI/UX & Interaction Flows** (Tailwind tokens, drag-and-drop states)
5. **Acceptance Criteria (Gherkin Scenarios):**
   - Scenario 1 (Happy Path)
   - Scenario 2 (Validation / Edge Case)
   - Scenario 3 (Boundary / State Transition)
6. **Definition of Done Checklist**

### 5. Validate Definition of Ready (DoR) Gate
Verify before handing off to `@developer`:
- [ ] No ambiguous requirements or open questions.
- [ ] Explicit Gherkin criteria exist for both happy paths and edge cases.
- [ ] Data models and API signatures are defined.
