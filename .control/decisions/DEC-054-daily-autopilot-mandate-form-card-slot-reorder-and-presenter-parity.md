---
type: mandate
id: DEC-054
status: applied
applied_at: '2026-09-20'
accepted_by: 'kodesh87 (2026-09-20)'
touches:
  - .control/memlog/autopilot-DEC-054.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-53-form-card-slot-reorder-and-presenter-transition-parity/SPEC.md
  - src/operator/workspace/
  - spa/src/
  - tests/smoke-spec-53.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-20'
---

# DEC-054 — Daily Autopilot mandate for Form Card Slot Reorder and Presenter Transition Parity (SPEC-53)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-054:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-054.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-054`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-53 Form Card Slot Reorder and Presenter Transition Parity) covering:
1) Top workspace mockup navigation labeling and chrome parity (aligning tab labels, action buttons, and status chips);
2) Form card groupings sequential reordering and normalization (enabling drag/up/down sorting across card groups with normalized order keys);
3) Intra-card and cross-card slot reordering (reordering slots within cards and moving slots cleanly between groups);
4) Presenter slide text transition and crossfade visual parity (smooth transition timing, fade/slide/zoom animations, and absence of layout jump);
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or cause regressions in presenter parity if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
