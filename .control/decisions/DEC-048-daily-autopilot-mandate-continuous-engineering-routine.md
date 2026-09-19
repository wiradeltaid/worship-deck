---
type: mandate
id: DEC-048
status: accepted
accepted_by: 'kodesh87 (2026-09-19)'
touches:
  - .control/memlog/autopilot-DEC-048.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-47-offline-desktop-inno-setup-and-manual-sync/SPEC.md
  - cmd/api/main.go
  - cmd/desktop/main.go
  - internal/db
  - internal/httpapi
  - internal/sync
  - scripts/build-desktop.mjs
  - installer/worship-presenter.iss
  - src/components/admin
  - tests/smoke-spec-47.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-19'
---

# DEC-048 — Daily Autopilot mandate for continuous engineering routine and delivery (SPEC-47)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-048:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-cli chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./cmd/... ./internal/...` and `npm test`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-048.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-048`.

## Why

To allow unattended continuous execution of engineering tickets and backlog releases (SPEC-47 offline desktop application with Inno Setup and on-demand manual sync) with high fidelity and strict verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work or make unwanted architectural shifts if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
