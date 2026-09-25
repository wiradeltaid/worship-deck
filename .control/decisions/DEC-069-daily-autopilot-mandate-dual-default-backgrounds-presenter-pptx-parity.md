---
type: mandate
id: DEC-069
status: accepted
accepted_by: 'kodesh87 (2026-09-25)'
touches:
  - .control/memlog/autopilot-DEC-069.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-25'
---

# DEC-069 — Daily Autopilot mandate for Dual Default Backgrounds, Song-Set Resolution, and Presenter/PPTX Parity (SPEC-81)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-069:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-069.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-069`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-81:
- SPEC-81-01: Presenter live background preview & override strictly scoped to lyric slides (presenter)
- SPEC-81-02: Dual default backgrounds (is_default_song, is_default_announcement) model & library UI (hub)
- SPEC-81-03: Song set background resolution, cascade fallback, and PPTX media deduplication parity (hub)
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
