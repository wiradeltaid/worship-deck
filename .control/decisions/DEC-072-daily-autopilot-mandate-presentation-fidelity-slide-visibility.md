---
type: mandate
id: DEC-072
status: applied
accepted_by: 'kodesh87 (2026-09-26)'
touches:
  - .control/memlog/autopilot-DEC-072.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-26'
---

# DEC-072 — Daily Autopilot mandate for Presentation Fidelity, Slide Visibility Control, and Operator Polish (SPEC-85)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-072:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-072.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-072`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-85:
- SPEC-85-01: Song-Set Save-to-Book dirty guard & book selection modal (`DynamicFormBody.tsx`, `SongSetSection.tsx`, satisfying `UC-14`, `FR-33`).
- SPEC-85-02: Scripture & Congregation aspect containment & Run-Sheet aside scroll uncap (`PresenterOperator.tsx`, `ScriptureSlide.tsx`, satisfying `UC-21`, `FR-16`).
- SPEC-85-03: Run-Sheet action bar layout wrapping redesign & Rundown Fill parity (`RunSheetPage.tsx`, satisfying `UC-20`, `FR-14`, `FR-31`).
- SPEC-85-04: Slide visibility control (Hide/Show slide) in presenter & projector (`PresenterOperator.tsx`, `ProjectorClient.tsx`, `present-channel.ts`, `slide-plan.ts`, satisfying `UC-21`, `UC-22`, `FR-16`, `FR-19`).
- SPEC-85-05: Emergency multi-element canvas edit & hydrated service slide patching (`PresenterOperator.tsx`, `ArtifactSlide.tsx`, `present-channel.ts`, satisfying `UC-21`, `FR-16`, `FR-19`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
