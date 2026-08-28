---
name: scrum-qa-signoff
description: Use this skill during QA Acceptance Testing to execute unit, integration, and browser E2E test suites, verify Gherkin acceptance criteria, and archive reports to test-reports/.
---

# Scrum QA Verification & Acceptance Gate

This runbook guides **`@tester`** through validating acceptance criteria, running tests against Firebase emulators, executing headless browser tests, and archiving persistent verification reports.

---

## Step-by-Step Procedure

### 1. Automated Test Execution
Run test suites with emulator variables active:
```bash
export FIRESTORE_EMULATOR_HOST="localhost:8080"
export FIREBASE_AUTH_EMULATOR_HOST="localhost:9099"

# Run Go unit and emulator integration tests
go test -v ./... | tee test-results/backend-test.log

# Run frontend tests
cd frontend && npm test -- --run | tee ../test-results/frontend-test.log
```

### 2. Browser E2E Journeys (`/browser`)
Execute end-to-end user journeys using headless browser tools:
- **Morning Check-In:** Complete multi-step modal flow, task rollover, and check-in timestamp.
- **4-Row Execution Board:** Drag-and-drop task reordering, row transitions (Today $\leftrightarrow$ Blocked $\leftrightarrow$ Backlog), and checkbox completion.
- **End-of-Day Check-Out:** Triage unfinished tasks and record daily reflections.
- **Standup Markdown Export:** Click copy button and inspect markdown preview.
- Save screenshots to `test-results/screenshots/`.

### 3. Defect Loop (If Acceptance Criteria Fail)
If any Gherkin scenario fails:
1. Document the failure scenario and steps to reproduce.
2. Link the error log or screenshot from `test-results/`.
3. Route back to `@developer` with **Sign-Off Status: NEEDS WORK**.

### 4. Archive QA Sign-Off Report
When all acceptance criteria pass:
1. Compile and save the final report to:
   `test-reports/QA-REPORT-<feature-name>-<YYYY-MM-DD>.md`
2. Follow the standard template with the pass/fail verification matrix.
3. Mark **Sign-Off Status: APPROVED**.
