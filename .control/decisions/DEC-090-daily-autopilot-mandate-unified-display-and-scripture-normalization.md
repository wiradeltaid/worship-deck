---
type: mandate
id: DEC-090
status: accepted
accepted_by: 'kodesh87 (2026-10-04)'
touches:
  - .control/memlog/autopilot-DEC-090.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-103-presenter-unified-display-capture-discovery-and-scripture-normalization/
supersedes: null
superseded_by: null
created: '2026-10-04'
---

# DEC-090 — Daily Autopilot mandate for Presenter Unified Display, Capture Discovery, Fullscreen Navigation, and Scripture Comma Normalization (SPEC-103)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-090:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-090.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-090`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-103: Presenter Unified Display Selection, Guest Capture Discovery, Fullscreen Navigation, and Scripture Comma Normalization (`SPEC-103-01`..`SPEC-103-04`)
incorporating the multi-model adversarial reviews folded into the spec without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, consumer clone cleanup, and a 7-day expiry.
