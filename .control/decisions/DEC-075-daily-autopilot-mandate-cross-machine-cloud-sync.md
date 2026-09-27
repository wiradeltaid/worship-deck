---
type: mandate
id: DEC-075
status: accepted
accepted_by: 'kodesh87 (2026-09-27)'
touches:
  - .control/memlog/autopilot-DEC-075.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-27'
---

# DEC-075 — Daily Autopilot mandate for Cross-Machine Cloud Sync with Ephemeral Auth and CORS (SPEC-88)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-075:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-075.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-075`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-88:
- SPEC-88-01: Go API Sync Bearer Auth and CORS Preflight (`internal/httpapi`, `internal/auth`, `cmd/api`; satisfying `FR-40`, `FR-21`).
- SPEC-88-02: Login Response Token Export and Auth Helpers (`src/lib/auth/`, `src/lib/sync/client.ts`; satisfying `FR-40`, `FR-21`).
- SPEC-88-03: Admin Sync Ephemeral Login Modal and UI Polish (`spa/src/components/`, `SyncArtifactButton.tsx`; satisfying `FR-40`, `FR-21`).
- SPEC-88-04: Cross-Machine Sync E2E Smoke Tests and Absence Guards (`tests/cross-machine-sync.test.mjs`; satisfying `FR-40`, `FR-21`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
