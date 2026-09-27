---
type: mandate
id: DEC-073
status: applied
accepted_by: 'kodesh87 (2026-09-27)'
touches:
  - .control/memlog/autopilot-DEC-073.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-27'
---

# DEC-073 — Daily Autopilot mandate for Operator Ergonomics, Canvas Polish, and Localization Parity (SPEC-86)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-073:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-073.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-073`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-86:
- SPEC-86-01: Run-Sheet Header 50:50 Layout & Tiered Action Clusters (`spa/src/pages/RunSheetPage.tsx`, satisfying `UC-5`, `FR-14`, `FR-16`).
- SPEC-86-02: Song-Set Lyric Action Dedicated Row Placement (`src/operator/DynamicFormBody.tsx`, satisfying `UC-28`, `FR-34`).
- SPEC-86-03: Slide Thumbnail List Hover-Only Visibility State (`src/components/SlidePreviewList.tsx`, satisfying `UC-12`, `FR-16`).
- SPEC-86-04: Presenter Transport Slide Hide Toggle & Two-Row Header Layout (`src/operator/present/PresenterOperator.tsx`, satisfying `UC-12`, `FR-16`, `FR-19`).
- SPEC-86-05: Emergency Canvas Inspector Shape Guard, Image Upload & Cropping Parity (`src/operator/present/PresenterOperator.tsx`, `src/lib/emergency-canvas.ts`, `src/components/media/ImageCropDialog.tsx`, satisfying `FR-16`, `FR-19`, `AD-13`).
- SPEC-86-06: Strict Bilingual i18n Localization Parity Across Service & Presenter Surfaces (`src/lib/i18n/`, `keys.ts`, `RunSheetPage.tsx`, `PresenterOperator.tsx`, satisfying `FR-25`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
