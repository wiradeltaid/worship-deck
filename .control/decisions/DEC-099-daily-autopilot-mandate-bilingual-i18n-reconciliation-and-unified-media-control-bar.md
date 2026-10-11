---
type: mandate
id: DEC-099
status: accepted
accepted_by: 'kodesh87 (2026-10-11)'
touches:
  - .control/memlog/autopilot-DEC-099.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-112-mandatory-i18n-reconciliation-and-enforcement-guards/
  - .scratch/SPEC-113-unified-media-control-bar-and-single-list-library/
supersedes: null
superseded_by: null
created: '2026-10-11'
---

# DEC-099 — Daily Autopilot mandate for Mandatory Bilingual i18n Reconciliation (SPEC-112) and Unified Media Control Bar (SPEC-113)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-099:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review, and primary peer review: Terra (`terra` via CodeBuddy `cbai/gpt-5.6-terra`) with supplementary reviewers DeepSeek Pro (`deepseekpro` via CodeBuddy `cbcn/deepseek-v4-pro`), GLM-5.3 (`glm53` via CodeBuddy `cbcn/glm-5.3`), and Sonnet (`sonnet` via Kiro Agent `claude-sonnet-5`);
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer and supplementary panel;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-099.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-099`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-112: Mandatory Bilingual i18n Reconciliation and Enforcement Guards (`SPEC-112-01`..`SPEC-112-04`)
- SPEC-113: Unified Media Control Bar and Single-List Library (`SPEC-113-01`..`SPEC-113-04`)
incorporating:
1) Dictionary expansion with 100% key and parameter parity across Indonesian (`id`) and English (`en`);
2) Complete localization across media player suite, presenter console, and runsheet forms;
3) Removal of two-tab switcher in MediaDrawer in favor of a single unified list with clear badges and action buttons;
4) Unified MediaControlBar with top dock layout, panic controls, audio/loop controls, and spacebar focus isolation;
5) Projector sync and video rendering stability;
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, bilingual parity guards, and a 7-day expiry.
