---
type: mandate
id: DEC-103
status: accepted
accepted_by: 'kodesh87 (2026-10-13)'
touches:
  - .control/memlog/autopilot-DEC-103.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-116-target-authority-remote-presenter-console/
supersedes: null
superseded_by: null
created: '2026-10-13'
---

# DEC-103 — Daily Autopilot mandate for Target-Authority Remote Presenter Console (SPEC-116)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-103:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review (default), independent peer review: Terra via Codex CLI (`terra-codex`: `codex exec -m "gpt-5.6-terra" -s workspace-write -c model_reasoning_effort="high"`), and supplementary reviewer: DeepSeek V4 Pro via CodeBuddy CN (`deepseekpro`: `codebuddy -p --dangerously-skip-permissions --model cbcn/deepseek-v4-pro --effort high`) using the canonical helper `invoke-wdi-runner.ps1`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./...`, `npm test`, `npm run build`, `npm run typecheck`) directly on the active worktree after the coding pass and verifies red-to-green evidence before staging or committing;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra via Codex (`terra-codex`) and DeepSeek V4 Pro (`deepseekpro`) — follow `wdi-review` criteria for any touched architecture or spec documents;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-103.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-103`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-116: Target-Authority Remote Presenter Architecture (`SPEC-116-01`..`SPEC-116-04`)
incorporating:
1) Push Scripture Remote Intent Dispatching, Page Pagination Mirroring, and Rundown Sheet Text Plumbing (`SPEC-116-01`);
2) Remote Media Playlist Hydration, Media Drawer Selection, Software Volume/Mute Control, and Audio Fade Out (`SPEC-116-02`);
3) Guest Speaker HDMI Capture Remote Telemetry Mirroring and Host Execution Intent Plumbing (`SPEC-116-03`);
4) Comprehensive Verification Suite, End-to-End Hardware Isolation Guards, Bilingual Parity, and Real-File Defect Injection Proofs (`SPEC-116-04`);
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, bilingual parity guards, and a 7-day expiry.
