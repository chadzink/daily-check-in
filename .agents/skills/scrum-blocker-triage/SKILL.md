---
name: scrum-blocker-triage
description: Use this skill when an agent encounters an execution impediment, missing database index, emulator outage, or specification ambiguity requiring rapid escalation and resolution.
---

# Scrum Blocker Triage & Impediment Resolution

This runbook defines the escalation procedure when an agent hits an execution blocker during development or testing.

---

## Escalation Matrix

| Symptom / Blocker | Category | Responsible Agent | Immediate Action |
| :--- | :--- | :--- | :--- |
| `FAILED_PRECONDITION: requires an index` | Database Index | `@devops-engineer` | Update `firestore.indexes.json` with composite index fields; restart emulator. |
| `connection refused on :8080 or :9099` | Emulator Infrastructure | `@devops-engineer` | Check `docker-compose ps` and restart Firebase emulator container. |
| Missing component state or styling gap | Design / UX | `@ui-designer` | Provide concrete Tailwind classes or component specification. |
| Undefined edge case or requirement conflict | Domain / Spec | `@product-owner` | Amend Gherkin criteria in `/plans/PLAN-*.md`. |
| Failing test or syntax error | Implementation Defect | `@developer` | Debug root cause, apply fix, and re-run pre-flight tests. |

---

## Blocker Logging Procedure
When blocked, the encountering agent should immediately report:
```markdown
### 🛑 Blocker Notice
- **Encountering Agent:** [@agent]
- **Blocked On:** [Summary of failure / error message]
- **Category:** [Database / Infrastructure / Design / Spec / Code]
- **Assigned To:** [@target-agent]
- **Proposed Resolution / Unblock Requirement:** [What is needed to proceed]
```
The assigned agent resolves the impediment and notifies the squad before work resumes.
