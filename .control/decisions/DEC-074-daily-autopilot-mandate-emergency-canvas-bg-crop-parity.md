---
type: mandate
id: DEC-074
status: applied
accepted_by: 'kodesh87 (2026-09-27)'
touches:
  - .control/memlog/autopilot-DEC-074.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-27'
---

# DEC-074 — Daily Autopilot mandate for Emergency Canvas Background Image Crop Parity (SPEC-87)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-074:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-074.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-074`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-87:
- SPEC-87-01: Emergency Canvas Background Upload & Crop Flow in `PresenterOperator.tsx` (dual persistence: online `/api/upload` + offline data URL fallback; 16:9 crop containment; element isolation guarantee; satisfying `FR-14`, `FR-16`, `FR-19`, `UC-12`).
- SPEC-87-02: Bilingual i18n Parity & Regression Guards (`catalogue-en.ts`, `catalogue-id.ts`, `keys.ts`, `tests/emergency-canvas-bg-crop.test.mjs`, `tests/bilingual-i18n-parity.test.mjs`; satisfying `FR-16`, `FR-25`, `UC-12`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
