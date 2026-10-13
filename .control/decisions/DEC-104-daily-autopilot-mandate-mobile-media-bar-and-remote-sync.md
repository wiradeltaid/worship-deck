---
type: mandate
id: DEC-104
status: accepted
accepted_by: 'kodesh87 (2026-10-13)'
touches:
  - .control/memlog/autopilot-DEC-104.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-117-mobile-media-bar-header-harmony-and-remote-sync/
supersedes: null
superseded_by: null
created: '2026-10-13'
---

# DEC-104 — Daily Autopilot mandate for Mobile Media Bar Ergonomics, Presenter Header Layout Harmony, and Remote Synchronization (SPEC-117)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-104:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review (default), independent peer review: Terra via Codex CLI (`terra-codex`: `codex exec -m "gpt-5.6-terra" -s workspace-write -c model_reasoning_effort="high"`), and supplementary reviewer: DeepSeek V4 Pro via CodeBuddy CN (`deepseekpro`: `codebuddy -p --dangerously-skip-permissions --model cbcn/deepseek-v4-pro --effort high`) using the canonical helper `invoke-wdi-runner.ps1`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./...`, `npm test`, `npm run build`, `npm run typecheck`) directly on the active worktree after the coding pass and verifies red-to-green evidence before staging or committing;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra via Codex (`terra-codex`) and DeepSeek V4 Pro (`deepseekpro`) — follow `wdi-review` criteria for any touched architecture or spec documents;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-104.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-104`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-117: Mobile Media Bar Ergonomics, Header Layout Harmony, Bidirectional Presentation Telemetry, and Remote Local Media Manifest (`SPEC-117-01`..`SPEC-117-04`)
incorporating:
1) Responsive 2-Row Media Control Bar with Mobile Ergonomics, Track Metadata, and Scrubbable Seekbar (`SPEC-117-01`);
2) Presenter Header Layout Harmony, Unified Compact Toolbar, and Compact Guest Feed Controls (`SPEC-117-02`);
3) Bidirectional Presentation Telemetry Mirroring for Host Slide Index, Blank, Lock, and Background Overrides (`SPEC-117-03`);
4) Remote Local Computer Media Playlist Manifest Synchronization and Unified Cueing (`SPEC-117-04`);
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, bilingual parity guards, and a 7-day expiry.
