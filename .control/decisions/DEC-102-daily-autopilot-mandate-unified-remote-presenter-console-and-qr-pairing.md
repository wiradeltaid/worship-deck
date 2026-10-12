---
type: mandate
id: DEC-102
status: accepted
accepted_by: 'kodesh87 (2026-10-12)'
touches:
  - .control/memlog/autopilot-DEC-102.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-115-unified-remote-presenter-console-and-qr-pairing/
supersedes: null
superseded_by: null
created: '2026-10-12'
---

# DEC-102 — Daily Autopilot mandate for Unified Remote Presenter Console and QR Pairing (SPEC-115)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-102:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review (default), independent peer review: Terra via Codex CLI (`terra-codex`: `codex exec -m "gpt-5.6-terra" -s workspace-write -c model_reasoning_effort="high"`), and supplementary reviewer: DeepSeek V4 Pro via CodeBuddy CN (`deepseekpro`: `codebuddy -p --dangerously-skip-permissions --model cbcn/deepseek-v4-pro --effort high`) using the canonical helper `invoke-wdi-runner.ps1`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./...`, `npm test`, `npm run build`, `npm run typecheck`) directly on the active worktree after the coding pass and verifies red-to-green evidence before staging or committing;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra via Codex (`terra-codex`) and DeepSeek V4 Pro (`deepseekpro`) — follow `wdi-review` criteria for any touched architecture or spec documents;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-102.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-102`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-115: Unified Remote Presenter Console and QR Pairing (`SPEC-115-01`..`SPEC-115-04`)
incorporating:
1) Zero-Friction Remote Pairing: Scannable QR Modal, Auto-Claim Token URL, URL hygiene, and Generic `/remote` Route (`SPEC-115-01`);
2) Unified Presenter Surface: Dual-Mode Layout, Shared Presenter Model, and Host Isolation Guards (`SPEC-115-02`);
3) Full-Surface Remote Intent Telemetry: Transport Mirroring, Song Selection, Scripture Triggering, and Stage Synchronization (`SPEC-115-03`);
4) End-to-End Verification Suite: Pairing Guards, Absence Assertions, Bilingual Parity, and Defect Injection (`SPEC-115-04`);
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, bilingual parity guards, and a 7-day expiry.
