---
type: mandate
id: DEC-055
status: accepted
accepted_by: 'kodesh87 (2026-09-21)'
touches:
  - .control/memlog/autopilot-DEC-055.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-54-layout-ssot-field-regex-sandbox-and-canvas-rotation-parity/SPEC.md
  - src/operator/
  - src/components/admin/
  - src/lib/registry/
  - internal/httpapi/
  - internal/db/
  - tests/smoke-spec-54.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-21'
---

# DEC-055 — Daily Autopilot mandate for Layout SSOT, Rundown Regex Sandbox Integration, Photo Deletion Persistence, and Canvas Rotation Parity (SPEC-54)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-055:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-055.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-055`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-54 Layout SSOT, Rundown Regex Sandbox Integration, Photo Deletion Persistence, and Canvas Rotation Parity) covering:
1) Form layout single source of truth and seeder cleanup (retiring duplicate layout customization from `DynamicFormBody.tsx`, dynamic layout hydration with preserved historical fields, and cleaning obsolete hardcoded song set entries from seeder);
2) Photo deletion persistence and anti-resurrection guard (explicit undefined vs empty string check in `EditForm.tsx` and per-key merge precedence in backend `services.go` preventing resurrection of deleted photos);
3) Integrated rundown regex sandbox and parser profile coexistence (inlining regex configuration in `FormLayoutAdminPanel.tsx`, live test area executing production-parity parser rules, and nesting parser profiles under `Layout & Fields`);
4) Smooth optimistic AJAX interactions (in-place state updates with rollback on network failure, eliminating jarring full-page loading re-mounts);
5) Canvas element rotation coordinate alignment and real-time sync (bidirectional center-origin conversion in `canvas-utils.ts` and `object:rotating` real-time visual updates in `ArtifactEditor.tsx`);
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or cause regressions in form layout or canvas geometry if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
