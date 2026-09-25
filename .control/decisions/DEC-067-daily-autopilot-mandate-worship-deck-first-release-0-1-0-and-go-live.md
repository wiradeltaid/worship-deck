---
type: mandate
id: DEC-067
status: applied
accepted_by: 'kodesh87 (2026-09-24)'
touches:
  - .control/memlog/autopilot-DEC-067.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-24'
---

# DEC-067 — Daily Autopilot mandate for WorshipDeck first release 0.1.0 and go-live work (SPEC-73)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-067:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-067.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-067`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-73:
- SPEC-73: WorshipDeck first release 0.1.0 and go-live work (WSD-H-01 through WSD-H-17)
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
