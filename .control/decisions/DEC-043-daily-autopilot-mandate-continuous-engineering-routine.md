---
type: mandate
id: DEC-043
status: applied
accepted_by: 'kodesh87 (2026-09-18)'
touches:
  - .control/memlog/autopilot-DEC-043.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
supersedes: null
superseded_by: null
created: '2026-09-18'
---

# DEC-043 — Daily Autopilot mandate for continuous engineering routine and delivery (SPEC-40, SPEC-41, SPEC-42)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-043:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./cmd/... ./internal/...` and `npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-043.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-043`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-40 gallery asset replacement and custom name, SPEC-41 announcement set hierarchy and grouping, and SPEC-42 deck sequence song set deletion) with high fidelity and strict verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or make unwanted architectural shifts if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
