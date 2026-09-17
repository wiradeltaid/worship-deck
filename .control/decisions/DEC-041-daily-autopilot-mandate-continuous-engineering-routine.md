---
type: mandate
id: DEC-041
status: applied
accepted_by: 'kodesh87 (2026-09-18)'
touches:
  - .control/memlog/autopilot-DEC-041.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
supersedes: null
superseded_by: null
created: '2026-09-18'
---

# DEC-041 — Daily Autopilot mandate for continuous engineering routine and delivery

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-041:
> 1) Execution: delegate coding passes to in-session subagent within an isolated worktree under coordinator supervision;
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./cmd/... ./internal/...` and `npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-041.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-041`.

## Why

To allow unattended continuous execution of engineering tickets, backlog items, or bug fixes with high fidelity and strict verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or make unwanted architectural shifts if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
