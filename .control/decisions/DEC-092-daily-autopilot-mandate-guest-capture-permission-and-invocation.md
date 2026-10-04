---
type: mandate
id: DEC-092
status: accepted
accepted_by: 'kodesh87 (2026-10-04)'
touches:
  - .control/memlog/autopilot-DEC-092.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-106-guest-capture-permission-discovery-and-invocation-fix/
supersedes: null
superseded_by: null
created: '2026-10-04'
---

# DEC-092 — Daily Autopilot mandate for Guest Video Capture Permission Discovery, Web API Receiver Binding, and Dropdown Click Resilience (SPEC-106)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-092:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-092.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-092`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-106: Guest Video Capture Permission Discovery, Web API Receiver Binding, and Dropdown Click Resilience (`SPEC-106-01`..`SPEC-106-02`)
incorporating the multi-model adversarial reviews folded into the spec without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, consumer clone cleanup, and a 7-day expiry.
