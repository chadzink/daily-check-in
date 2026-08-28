---
name: scrum-retrospective
description: Use this skill during Sprint Retrospective to analyze test metrics, identify development bottlenecks, and codify process improvements into GEMINI.md and agent instructions.
---

# Scrum Sprint Retrospective & Continuous Improvement

This runbook guides the squad during the **Sprint Retrospective** held at the completion of a major roadmap milestone.

---

## Step-by-Step Procedure

### 1. Gather Retrospective Data
- Review test reports in `test-reports/`.
- Review build durations, emulator startup reliability, and friction during agent handoffs.
- Identify any repeated blockers encountered during development (e.g. index errors, UTC timezone drift).

### 2. Identify Action Items
Categorize observations into:
- **What Went Well:** Practices and tooling to maintain.
- **What Slowed Us Down:** Bottlenecks, flaky tests, or ambiguous specifications.
- **Process Adjustments:** Concrete instructions to update.

### 3. Codify Improvements
- Update [`GEMINI.md`](../../../GEMINI.md) with new guidelines or rules.
- Update relevant agent prompts in [`.agents/agents/`](../../agents/).
- Update workflow guides or skill runbooks to automate newly learned practices.
