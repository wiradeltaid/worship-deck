---
type: mandate
id: DEC-050
status: applied
applied_at: '2026-09-19'
accepted_by: 'kodesh87 (2026-09-19)'
touches:
  - .control/memlog/autopilot-DEC-050.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-49-unified-schedule-workspace-full-milestone-prototype/SPEC.md
  - src/operator/workspace/MockupCanvasDesignerModal.tsx
  - src/operator/workspace/MockupDutyRosterDrawer.tsx
  - src/operator/workspace/MockupMediaGalleryDrawer.tsx
  - src/operator/workspace/MockupTimeline.tsx
  - src/operator/workspace/MockupEditor.tsx
  - src/operator/workspace/MockupCanvasPreview.tsx
  - tests/smoke-spec-49.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-19'
---

# DEC-050 — Daily Autopilot mandate for Unified Schedule Workspace Full Milestone Prototype (SPEC-49)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-050:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./cmd/... ./internal/...` and `npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-050.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-050`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-49 Unified Schedule Workspace Full Milestone Prototype) covering in-place Canvas Designer modal, custom slides item type, duty roster integration, and media gallery asset management without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or make unwanted architectural shifts if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
