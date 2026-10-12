---
type: mandate
id: DEC-100
status: applied
accepted_by: 'kodesh87 (2026-10-12)'
touches:
  - .control/memlog/autopilot-DEC-100.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-114-media-player-suite-hardening-and-playlist-sync/
supersedes: null
superseded_by: null
created: '2026-10-12'
---

# DEC-100 — Daily Autopilot mandate for Media Player Suite Hardening: Dual-Door Sync, Unified 3-Way Deletion Matrix, Shuffle/Repeat, and Header Cleanup (SPEC-114)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-100:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review, and primary peer review: DeepSeek Pro (`deepseekpro` via CodeBuddy `cbcn/deepseek-v4-pro`) with supplementary reviewer Terra (`terra` via CodeBuddy `cbai/gpt-5.6-terra`);
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to DeepSeek Pro peer reviewer and supplementary panel;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-100.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-100`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-114: Media Player Suite Hardening: Dual-Door Sync, Unified 3-Way Deletion Matrix, Shuffle/Repeat, and Header Cleanup (`SPEC-114-01`..`SPEC-114-04`)
incorporating:
1) Drawer play/pause toggle fix, projection switching desynchronization resolution, and removal of redundant header launcher button (`SPEC-114-01`);
2) Asymmetric deletion resolution via unified 3-way deletion matrix, backend playlist hydration on mount, and cloud upload metadata registration (`SPEC-114-02`);
3) Shuffle and Repeat transport controls in MediaControlBar, state engine integration, repeat-one override, and video auto-advance sanctuary screen safety (`SPEC-114-03`);
4) End-to-end integration, dual availability indicators, spacebar safety, and strict bilingual i18n parity guards (`SPEC-114-04`);
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, bilingual parity guards, and a 7-day expiry.
