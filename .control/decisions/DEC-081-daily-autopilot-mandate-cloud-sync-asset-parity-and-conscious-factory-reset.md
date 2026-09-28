---
type: mandate
id: DEC-081
status: accepted
accepted_by: 'kodesh87 (2026-09-28)'
touches:
  - .control/memlog/autopilot-DEC-081.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-28'
---

# DEC-081 — Daily Autopilot mandate for Cloud Sync Asset Hydration Parity and Conscious Factory Reset (SPEC-93)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-081:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-081.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-081`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-93: Cloud sync asset hydration parity, discrete dual-hash extraction (32-hex legacy / 64-hex SHA-256), write-path content addressing, conscious factory reset confirmation, and IndexedDB cache purge (`SPEC-93-01` through `SPEC-93-04`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
