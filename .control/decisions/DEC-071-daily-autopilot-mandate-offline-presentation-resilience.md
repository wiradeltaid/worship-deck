---
type: mandate
id: DEC-071
status: accepted
accepted_by: 'kodesh87 (2026-09-26)'
touches:
  - .control/memlog/autopilot-DEC-071.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-09-26'
---

# DEC-071 — Daily Autopilot mandate for Offline Presentation Resilience and Emergency Local Edit (SPEC-84)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-071:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer (`kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`);
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-071.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-071`.

## Why

To allow unattended continuous execution of engineering tickets under SPEC-84:
- SPEC-84-01: Session provider resilience & ProjectorPage independent session fallback (`src/operator/SessionProvider.tsx`, `src/operator/ProjectorPage.tsx`, `tests/session-provider-resilience.test.mjs`, satisfying `UC-20`, `FR-18`).
- SPEC-84-02: Offline service snapshot caching & zero-media readiness semantics (`src/lib/services.ts`, `src/operator/RunSheetPage.tsx`, `src/operator/PresenterPage.tsx`, `tests/offline-service-snapshot.test.mjs`, satisfying `UC-20`, `FR-14`, `FR-16`, `FR-19`).
- SPEC-84-03: Emergency local edit & monotonic patch revision synchronization with optimistic reconciliation (`src/lib/present-channel.ts`, `src/operator/PresenterPage.tsx`, `src/operator/ProjectorPage.tsx`, `tests/emergency-local-edit.test.mjs`, satisfying `UC-21`, `FR-16`, `FR-19`).
without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by `[ad-n]` parking, strict test suite gates, and a 7-day expiry.
