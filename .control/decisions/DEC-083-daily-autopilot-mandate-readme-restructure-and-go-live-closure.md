---
type: mandate
id: DEC-083
status: applied
accepted_by: 'kodesh87 (2026-09-30)'
touches:
  - .control/memlog/autopilot-DEC-083.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-30'
---

# DEC-083 — Daily Autopilot mandate for README Restructure Post v0.1.0 Publication and Go-Live Closure (SPEC-73)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-083:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-083.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-083`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-73: WorshipDeck first release (0.1.0) and go-live work (`SPEC-73-16` / `WSD-H-17` post-publication README restructure and release alignment).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
