---
type: mandate
id: DEC-106
status: applied
applied_at: '2026-10-13'
accepted_by: 'kodesh87 (2026-10-13)'
touches:
  - .control/memlog/autopilot-DEC-106.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-119-presenter-remote-seekbar-telemetry-resilience-and-touch-scrubbing/
supersedes: null
superseded_by: null
created: '2026-10-13'
---

# DEC-106 — Daily Autopilot mandate for Presenter Remote Media Seekbar Telemetry Resilience, Inert Remote Audio Isolation, and Touch Scrubbing (SPEC-119)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-106:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review (default), independent peer review: Terra via Codex CLI (`terra-codex`: `codex exec -m "gpt-5.6-terra" -s workspace-write -c model_reasoning_effort="high"`), and supplementary reviewer: DeepSeek V4 Pro via CodeBuddy CN (`deepseekpro`: `codebuddy -p --dangerously-skip-permissions --model cbcn/deepseek-v4-pro --effort high`) using the canonical helper `invoke-wdi-runner.ps1`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./...`, `npm test`, `npm run build`, `npm run typecheck`) directly on the active worktree after the coding pass and verifies red-to-green evidence before staging or committing;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra via Codex (`terra-codex`) and DeepSeek V4 Pro (`deepseekpro`) — follow `wdi-review` criteria for any touched architecture or spec documents;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-106.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-106`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-119: Presenter Remote Media Seekbar Telemetry Resilience, Inert Remote Audio Isolation, and Touch Scrubbing (`SPEC-119-01`..`SPEC-119-04`)
incorporating:
1) Passive Inert MediaStage on Remote Mode (`isInert`) & Suppression of Local Playback Dispatchers (`SPEC-119-01`);
2) Optimized Host Media Telemetry Throttling & Coalescing Broadcast Queue (`SPEC-119-02`);
3) Optimistic Seek Hold, Telemetry Reconciliation & Rubber-Banding Elimination (`SPEC-119-03`);
4) Mobile Touch Ergonomics, Pointer Cancel Resilience & Smooth Scrubbing (`SPEC-119-04`);
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, zero room-facing audio leaks, and a 7-day expiry.
