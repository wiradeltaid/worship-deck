---
title: 'PPTX worker draws a finished plan and exits'
type: 'feature'
created: '2026-08-19'
status: 'done'
baseline_revision: '7030c26'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.how/hub/04-components/LC-13-pptx.md'
  - '.how/_platform/ARCHITECTURE-SPINE.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** PptxGenJS currently runs inside the Next process and `pptx.ts` imports the SQLite planner.

**Approach:** Split draw into `src/lib/pptx-draw.ts`. CLI `workers/pptx/draw.mjs` reads plan JSON on stdin, writes PPTX on stdout, exits. `generatePptx` becomes a wrapper that still builds the plan in-process for as-built Next until story 2-3.

## Boundaries & Constraints

**Always:** Worker MUST NOT import `getDb`, `@/lib/db`, `buildSlidePlan`, or `@/lib/settings`. Transition is in the JSON payload.

**Block If:** Worker opens SQLite. Draw behaviour regresses `tests/pptx-content.test.mjs`.

**Never:** Keep a Node process up after the write. Commit rendered `.pptx`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Valid plan JSON | stdin `{ serviceDate, transition, plan }` | OpenXML on stdout, exit 0 | — |
| Empty plan | `plan: []` | Valid empty-ish deck or zero slides; exit 0 | Do not crash |
| Import SQLite | worker graph | Test fails | Absence-guard proved by inject/revert |

</intent-contract>

## Code Map

- `src/lib/pptx-draw.ts` — PptxGenJS + zip post-process
- `src/lib/pptx.ts` — `buildSlidePlan` + `generatePptxFromPlan`
- `workers/pptx/draw.mjs` — CLI
- `tests/pptx-worker.test.mjs`

## Tasks & Acceptance

- Worker module graph has no SQLite.
- `generatePptx` still used by as-built tests stays green.
- Absence-guard recorded (inject, fail, revert).

## Spec Change Log

## Review Triage Log
