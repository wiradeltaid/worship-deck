---
type: mandate
id: DEC-076
status: applied
accepted_by: 'kodesh87 (2026-09-27)'
touches:
  - .control/memlog/autopilot-DEC-076.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-27'
---

# DEC-076 — Daily Autopilot mandate for Native Desktop WebView2 Window and Installer Default Seed Staging (SPEC-89)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-076:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-076.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-076`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-89:
- SPEC-89-01: Complete Default Seed & Corpora Staging (`scripts/build-desktop.mjs`, `internal/db/`; satisfying `FR-20`, `FR-21`, `UC-14`, `UC-15`).
- SPEC-89-02: Clean Startup & Graceful Desktop Shutdown Lifecycle (`cmd/api/main.go`, `internal/desktop/`; satisfying `FR-21`, `UC-15`).
- SPEC-89-03: Native Win32 / WebView2 Desktop Window Wrapper (`internal/desktop/window_windows.go`, `window_other.go`; satisfying `FR-21`, `UC-15`).
- SPEC-89-04: Contract & Staging Automated Test Suite (`tests/desktop-webview2-contract.test.mjs`, `tests/installer-corpora-staging.test.mjs`; satisfying `FR-20`, `FR-21`, `UC-14`, `UC-15`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
