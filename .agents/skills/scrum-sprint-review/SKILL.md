---
name: scrum-sprint-review
description: Use this skill during Sprint Review and Demo to verify the full Definition of Done (DoD), summarize test evidence, and obtain human-in-the-loop sign-off before merging.
---

# Scrum Sprint Review & Definition of Done (DoD)

This runbook guides **`@product-owner`**, **`@tester`**, and the squad during the **Sprint Review** ceremony prior to branch merge.

---

## Step-by-Step Procedure

### 1. Review QA Sign-Off Evidence
- Confirm `test-reports/QA-REPORT-<feature>-<YYYY-MM-DD>.md` exists and has **Sign-Off Status: APPROVED**.
- Inspect visual assets in `test-results/screenshots/`.

### 2. Audit Definition of Done (DoD) Checklist
Validate that all items are completed:
- [ ] Every Gherkin acceptance scenario verified with automated or browser test.
- [ ] Idiomatic Go formatting (`gofmt`) and clean error propagation.
- [ ] UI adheres to Tailwind design tokens and supports dark/light themes.
- [ ] Single binary compilation succeeds with embedded static assets (`//go:embed`).
- [ ] No regression in existing tests across the codebase.

### 3. Present Demo Walkthrough to User
- Provide a concise summary of accomplishments:
  - User story delivered.
  - Verification matrix summary.
  - Links to screenshots/recordings.
- Request user sign-off for merging to `main`.
