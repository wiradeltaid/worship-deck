---
type: mandate
id: DEC-105
status: accepted
accepted_by: 'kodesh87 (2026-10-13)'
touches:
  - .control/memlog/autopilot-DEC-105.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-118-presenter-layout-stability-tablet-media-bar-and-remote-resilience/
supersedes: null
superseded_by: null
created: '2026-10-13'
---

# DEC-105 — Daily Autopilot mandate for Presenter Layout Stability across Viewports, Tablet Media Bar Ergonomics, and Remote Connection Resilience (SPEC-118)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-105:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review (default), independent peer review: Terra via Codex CLI (`terra-codex`: `codex exec -m "gpt-5.6-terra" -s workspace-write -c model_reasoning_effort="high"`), and supplementary reviewer: DeepSeek V4 Pro via CodeBuddy CN (`deepseekpro`: `codebuddy -p --dangerously-skip-permissions --model cbcn/deepseek-v4-pro --effort high`) using the canonical helper `invoke-wdi-runner.ps1`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./...`, `npm test`, `npm run build`, `npm run typecheck`) directly on the active worktree after the coding pass and verifies red-to-green evidence before staging or committing;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra via Codex (`terra-codex`) and DeepSeek V4 Pro (`deepseekpro`) — follow `wdi-review` criteria for any touched architecture or spec documents;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-105.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-105`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-118: Presenter Layout Stability across Viewports, Tablet Media Bar Ergonomics, and Remote Connection Resilience (`SPEC-118-01`..`SPEC-118-04`)
incorporating:
1) Responsive Media Control Bar Breakpoint Expansion for Tablet & Compact Viewports (`SPEC-118-01`);
2) Zero-CLS Presenter Header Layout Stabilization and Guest Live Bounded Geometry (`SPEC-118-02`);
3) Header Alert & Prompt Isolation (Zero-Shift Banner Placement across Viewports) (`SPEC-118-03`);
4) Resilient Remote Pairing Connection, Reconnect Retention, and Heartbeat Jitter Tolerance (`SPEC-118-04`);
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, bilingual parity guards, and a 7-day expiry.
