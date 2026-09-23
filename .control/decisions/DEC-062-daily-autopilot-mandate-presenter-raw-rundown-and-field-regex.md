---
type: mandate
id: DEC-062
status: applied
accepted_by: 'kodesh87 (2026-09-23)'
touches:
  - .control/memlog/autopilot-DEC-062.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-23'
---

# DEC-062 — Daily Autopilot mandate for Presenter Raw Rundown Display & Dynamic Field Regex Consolidation (SPEC-67)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-062:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-062.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-062`.

## Why

To allow unattended continuous execution of engineering tickets SPEC-67-01 and SPEC-67-02 under SPEC-67:
- SPEC-67-01: Decouple Presenter view from parsed_data.items to render raw_payload directly in Run-Sheet sidebar and clean up obsolete props (FR-15, UC-11).
- SPEC-67-02: Consolidate form intake auto-population onto Dynamic Predefined Field Regex suggestions without silent overwrites (FR-36, UC-2).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
