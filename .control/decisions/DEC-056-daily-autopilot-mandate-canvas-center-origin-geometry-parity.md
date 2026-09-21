---
type: mandate
id: DEC-056
status: accepted
applied_at: null
accepted_by: 'kodesh87 (2026-09-21)'
touches:
  - .control/memlog/autopilot-DEC-056.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-55-canvas-center-origin-geometry-parity/SPEC.md
  - src/lib/registry/
  - src/components/admin/
  - tests/smoke-spec-55.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-21'
---

# DEC-056 — Daily Autopilot mandate for Canvas Center-Origin Geometry Parity & Release Jump Elimination (SPEC-55)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-056:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-056.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-056`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-55 Canvas Center-Origin Geometry Parity & Release Jump Elimination) covering:
1) Unified center-origin geometry helpers and consistent Fabric constructor positioning (`canvas-utils.ts`);
2) Unified Fabric event handling and elimination of the release jump bug across moving, scaling, and rotating (`ArtifactEditor.tsx`);
3) Center-origin geometry parity for copy/paste, duplicate, auto-expand, and clip-path alignment;
4) Complete browser-parity regression test suite with mock Fabric textbox rendering (`tests/smoke-spec-55.test.mjs`);
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or cause regressions in canvas coordinate calculations if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
