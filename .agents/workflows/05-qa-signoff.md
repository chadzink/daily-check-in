# Workflow 05: QA Verification & Acceptance Gate

- **Scrum Ceremony:** Acceptance Testing & Quality Gate
- **Lead Agent:** `@tester`
- **Collaborator:** `@developer`
- **Primary Input:** Pre-flight verified implementation from `@developer`
- **Primary Output:** `test-reports/QA-REPORT-<feature>-<YYYY-MM-DD>.md`

---

## Process Flow
1. **Automated Suites:** Execute Go integration tests against Firestore emulator and frontend Vitest suites.
2. **Headless Browser E2E (`/browser`):** Validate key journeys (Morning Check-In, Board DND, Task Completion, End-of-Day Check-Out, Standup Markdown Copy).
3. **Defect Loop:** If any acceptance criteria fail, file detailed defect with screenshot/log and return to `@developer`.
4. **Privacy & Path Hygiene Gate:** Audit logs in `test-results/` and reports in `test-reports/` to ensure zero absolute filesystem paths (`/Users/...`, `/home/...`), zero personal identifiers (usernames, emails), and zero secrets/tokens are present.
5. **Sign-Off Archival:** When all pass and privacy checks are satisfied, persist sign-off report to `test-reports/` and archive sanitized logs/screenshots in `test-results/`.

