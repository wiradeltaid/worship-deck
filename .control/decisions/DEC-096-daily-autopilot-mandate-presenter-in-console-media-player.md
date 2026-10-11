---
type: mandate
id: DEC-096
status: applied
accepted_by: 'kodesh87 (2026-10-11)'
touches:
  - .control/memlog/autopilot-DEC-096.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-110-presenter-in-console-media-player/
supersedes: null
superseded_by: null
created: '2026-10-11'
---

# DEC-096 — Daily Autopilot mandate for Presenter In-Console Media Player and Congregation Video Projection (SPEC-110)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-096:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review, and peer review: Terra (`cbai/gpt-5.6-terra`) with supplementary reviewers Sonnet (`kiro-agent`), DeepSeek Pro (`cbcn/deepseek-v4-pro`), and GLM-5.3 (`cbcn/glm-5.3`);
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer and supplementary reviewers;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-096.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-096`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-110: Presenter In-Console Media Player & Congregation Video Projection (`SPEC-110-01`..`SPEC-110-04`)
incorporating server-backed media asset storage, bottom mini-dock with instant panic controls, non-modal slide-over preparation drawer, mutual exclusivity with guest camera capture on `z-30`, HDMI audio loop feedback prevention (muted projector audio), and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, consumer clone cleanup, and a 7-day expiry.
