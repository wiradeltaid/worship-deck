---
type: mandate
id: DEC-061
status: applied
accepted_by: 'kodesh87 (2026-09-23)'
touches:
  - .control/memlog/autopilot-DEC-061.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-23'
---

# DEC-061 — Daily Autopilot mandate for Exempt Branding Static Assets from Session Gate (SPEC-66)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-061:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-061.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-061`.

## Why

To allow unattended continuous execution of engineering ticket SPEC-66-01 under SPEC-66:
- SPEC-66: Exempt /branding static assets from session authentication gate (FR-18), resolving the broken branding image defect on the login page;
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
