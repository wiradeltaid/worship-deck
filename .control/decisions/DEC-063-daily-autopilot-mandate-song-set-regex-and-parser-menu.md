---
type: mandate
id: DEC-063
status: applied
applied_at: '2026-09-23'
accepted_by: 'kodesh87 (2026-09-23)'
touches:
  - .control/memlog/autopilot-DEC-063.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-23'
---

# DEC-063 — Daily Autopilot mandate for Song Set Regex Editing and Parser Profile Menu Removal (SPEC-68)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-063:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-063.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-063`.

## Why

To allow unattended continuous execution of engineering tickets SPEC-68-01 and SPEC-68-02 under SPEC-68:
- SPEC-68-01: Remove obsolete Advanced Parser Profile menu and routes from operator UI (UC-2, FR-36).
- SPEC-68-02: Expose and edit Song Set Entry Extraction Regex on form layout/settings (UC-2, UC-24, FR-32, FR-36).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
