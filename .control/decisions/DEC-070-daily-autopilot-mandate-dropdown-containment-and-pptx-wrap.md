---
type: mandate
id: DEC-070
status: accepted
accepted_by: 'kodesh87 (2026-09-26)'
touches:
  - .control/memlog/autopilot-DEC-070.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-26'
---

# DEC-070 — Daily Autopilot mandate for Song-Set Dropdown Containment and PPTX Dynamic Text Word Wrap Parity (SPEC-82, SPEC-83)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-070:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-070.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-070`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-82 and SPEC-83:
- SPEC-82-01: Presenter & projector deck default resolution (`resolveEffectiveBackgroundImage` lyric override reset, `ProjectorClient` background override propagation, satisfying `UC-27`, `FR-33`, `FR-16`).
- SPEC-82-02: Song-set background dropdown containment & typography (`DynamicFormBody.tsx` trigger `w-full`, `min-w-0`, `text-[11px] truncate` containment within `w-48` card slot, satisfying `FR-32`, `FR-31`).
- SPEC-83-01: PPTX dynamic text native word wrap and break parity (`resolveExplicitParagraphRunsForPptx` without synthetic headless `<a:br/>` soft breaks, `<a:bodyPr>` `wrap="square"` vs `wrap="none"`, deterministic height pre-scaling `normAutofit` parity, satisfying `UC-18`, `FR-14`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
