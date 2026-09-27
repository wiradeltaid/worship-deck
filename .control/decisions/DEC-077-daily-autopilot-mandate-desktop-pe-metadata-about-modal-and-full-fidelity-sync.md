---
type: mandate
id: DEC-077
status: accepted
accepted_by: 'kodesh87 (2026-09-27)'
touches:
  - .control/memlog/autopilot-DEC-077.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-27'
---

# DEC-077 — Daily Autopilot mandate for Desktop PE Metadata, About Modal, and Full-Fidelity Cloud Sync (SPEC-90, SPEC-91)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-077:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-077.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-077`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-90: Windows PE VersionInfo resource staging, Inno Setup directives, DPI awareness, and operator UI legal About modal (`SPEC-90-01` through `SPEC-90-03`).
- SPEC-91: Full-fidelity bidirectional cloud sync protocol, stable global IDs, parent-first upsert, and client-side asset hydration pipeline (`SPEC-91-01` through `SPEC-91-03`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
