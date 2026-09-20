---
type: mandate
id: DEC-052
status: accepted
accepted_by: 'kodesh87 (2026-09-20)'
touches:
  - .control/memlog/autopilot-DEC-052.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-51-unified-schedule-workspace-1920-fullhd-redesign/SPEC.md
  - src/operator/workspace/
  - spa/src/
  - tests/smoke-spec-51.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-20'
---

# DEC-052 — Daily Autopilot mandate for Unified Schedule Workspace 1920 Full HD Redesign (SPEC-51)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-052:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-052.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-052`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-51 Unified Schedule Workspace 1920 Full HD Redesign) covering 1920 Full HD responsive viewport optimization (240px run sheet sidebar, 820px primary context editor, 860px sticky canvas preview with in-drawer libraries & preset drawers, consolidated AV command header, and comprehensive smoke tests) without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or make unwanted layout regressions if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
