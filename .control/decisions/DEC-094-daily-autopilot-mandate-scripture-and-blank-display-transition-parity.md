---
type: mandate
id: DEC-094
status: applied
accepted_by: 'kodesh87 (2026-10-05)'
touches:
  - .control/memlog/autopilot-DEC-094.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-108-scripture-and-blank-display-transition-parity/
supersedes: null
superseded_by: null
created: '2026-10-05'
---

# DEC-094 — Daily Autopilot mandate for Scripture and Blank Display Transition Parity (SPEC-108)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-094:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-094.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-094`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-108: Scripture and Blank Display Transition Parity (`SPEC-108-01`..`SPEC-108-04`)
incorporating canonical AD-23 transition parity, adaptive blackout blanking, and projector overlay synchronization without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, consumer clone cleanup, and a 7-day expiry.
