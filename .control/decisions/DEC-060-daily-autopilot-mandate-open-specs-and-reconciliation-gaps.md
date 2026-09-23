---
type: mandate
id: DEC-060
status: applied
accepted_by: 'kodesh87 (2026-09-23)'
touches:
  - .control/memlog/autopilot-DEC-060.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-23'
---

# DEC-060 — Daily Autopilot mandate for Open Specs & Reconciliation Gaps (SPEC-56 through SPEC-65)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-060:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-060.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-060`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-56 through SPEC-65) covering:
1) SPEC-56: Dynamic Predefined Field catalog wiring (FR-37);
2) SPEC-57: Node schema mirror parity with SQLite (FR-39, FR-40);
3) SPEC-58: Delete service unlinks uploads (FR-10);
4) SPEC-59: Announcement set freeze snapshot boundary (FR-21);
5) SPEC-60: Hymns 404 on unregistered book code (FR-2);
6) SPEC-61: Manual sync push body cap and chunking (FR-40);
7) SPEC-62: Fonts delete endpoint (FR-39);
8) SPEC-63: Form layout fetch error surfaced (FR-37);
9) SPEC-64: Installer version sync (FR-40);
10) SPEC-65: Remote reconnect without re-pairing (FR-35);
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
