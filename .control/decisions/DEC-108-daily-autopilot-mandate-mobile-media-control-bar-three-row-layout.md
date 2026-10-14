---
type: mandate
id: DEC-108
status: accepted
accepted_by: 'kodesh87 (2026-10-14)'
touches:
  - .control/memlog/autopilot-DEC-108.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-122-mobile-media-bar-three-row-layout-and-phone-seekbar-resilience/
supersedes: null
superseded_by: null
created: '2026-10-14'
---

# DEC-108 — Daily Autopilot mandate for Mobile Media Control Bar Three-Row Layout and Phone Seekbar Resilience (SPEC-122)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-108:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review (default), independent peer review: Terra via Codex CLI (`terra-codex`: `codex exec -m "gpt-5.6-terra" -s workspace-write -c model_reasoning_effort="high"`), and supplementary reviewer: DeepSeek V4 Pro via CodeBuddy CN (`deepseekpro`: `codebuddy -p --dangerously-skip-permissions --model cbcn/deepseek-v4-pro --effort high`) using the canonical helper `& "D:\Developer\wiradeltaid\ops\research\tooling\invoke-wdi-runner.ps1"`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./...`, `npm test`, `npm run build`, `npm run typecheck`) directly on the active worktree after the coding pass and verifies red-to-green evidence before staging or committing;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra via Codex (`terra-codex`) and DeepSeek V4 Pro (`deepseekpro`) — follow `wdi-review` criteria for any touched architecture or spec documents;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-108.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-108`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-122: Mobile Media Control Bar Three-Row Layout and Phone Seekbar Resilience (`SPEC-122-01`)
incorporating:
1) Responsive 3-row layout restructuring for mobile smartphones (`< sm` / `< 640px`) in `MediaControlBar.tsx`, dedicating Visual Row 1 to Track Header info & Drawer launcher, Visual Row 2 to a full-width non-collapsing seekbar container (`media-control-bar-seekbar`), and Visual Row 3 to panic playback controls & projector toggle;
2) Coalescing of Visual Rows 1 and 2 on tablet viewports (`sm:` to `< xl`) to preserve established 2-row layout, and flattening on desktop (`xl:`) to preserve 1-row layout;
3) Sizing invariants (`w-full flex-1 min-w-[120px]` seekbar) and defect injection proof suites in `tests/presenter-media-player.test.mjs`;
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates and a 7-day expiry.
