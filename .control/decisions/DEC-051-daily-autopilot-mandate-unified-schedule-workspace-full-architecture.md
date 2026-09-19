---
type: mandate
id: DEC-051
status: applied
applied_at: '2026-09-20'
accepted_by: 'kodesh87 (2026-09-20)'
touches:
  - .control/memlog/autopilot-DEC-051.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-50-unified-schedule-workspace-uiux-full-architecture/SPEC.md
  - src/operator/workspace/
  - spa/src/
  - tests/smoke-spec-50.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-20'
---

# DEC-051 — Daily Autopilot mandate for Unified Schedule Workspace Full Architecture (SPEC-50)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-051:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-051.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-051`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-50 Unified Schedule Workspace UI/UX Full Architecture & Screen Replacement Blueprint) covering mode separation (Master Preset Builder vs. Schedule Instance), reusable master libraries (Song Sets, Announcements, Canvas Templates, Predefined Fields Registry), in-workspace remote control & projector liveness safety, and desktop offline sync without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or make unwanted architectural shifts if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
