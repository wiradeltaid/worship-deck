---
type: mandate
id: DEC-068
status: accepted
accepted_by: 'kodesh87 (2026-09-25)'
touches:
  - .control/memlog/autopilot-DEC-068.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-25'
---

# DEC-068 — Daily Autopilot mandate for PPTX Word Wrap Option, Curated Presentation Fonts Expansion, and Image Crop Aspect Handling (SPEC-78, SPEC-79, SPEC-80)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-068:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-068.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-068`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-78, SPEC-79, and SPEC-80:
- SPEC-78: PPTX text box word wrap option on export (SPEC-78-01)
- SPEC-79: Curated free presentation fonts expansion (SPEC-79-01, SPEC-79-02)
- SPEC-80: Image crop aspect ratio presets and original/custom aspect handling (SPEC-80-01)
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
