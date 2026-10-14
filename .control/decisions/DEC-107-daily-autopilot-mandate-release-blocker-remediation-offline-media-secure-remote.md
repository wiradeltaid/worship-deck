---
type: mandate
id: DEC-107
status: accepted
accepted_by: 'kodesh87 (2026-10-14)'
touches:
  - .control/memlog/autopilot-DEC-107.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-121-release-blocker-remediation-offline-media-and-secure-remote/
supersedes: null
superseded_by: null
created: '2026-10-14'
---

# DEC-107 — Daily Autopilot mandate for Production Release Blocker Remediation: Offline Media Playback, Secure QR Mobile Pairing, Backend Security Boundaries, and Telemetry Monotonicity (SPEC-121)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-107:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review (default), independent peer review: Terra via Codex CLI (`terra-codex`: `codex exec -m "gpt-5.6-terra" -s workspace-write -c model_reasoning_effort="high"`), and supplementary reviewer: DeepSeek V4 Pro via CodeBuddy CN (`deepseekpro`: `codebuddy -p --dangerously-skip-permissions --model cbcn/deepseek-v4-pro --effort high`) using the canonical helper `& "D:\Developer\wiradeltaid\ops\research\tooling\invoke-wdi-runner.ps1"`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`go test ./...`, `npm test`, `npm run build`, `npm run typecheck`) directly on the active worktree after the coding pass and verifies red-to-green evidence before staging or committing;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra via Codex (`terra-codex`) and DeepSeek V4 Pro (`deepseekpro`) — follow `wdi-review` criteria for any touched architecture or spec documents;
> 5) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-107.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-107`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-121: Production Release Blocker Remediation: Offline Media Playback, Secure QR Mobile Pairing, Backend Security Boundaries, and Telemetry Monotonicity (`SPEC-121-01`..`SPEC-121-04`)
incorporating:
1) Offline Media Playback Resolution, Local Hydration Resilience, and Service Worker Version Parity (`SPEC-121-01`);
2) Isolated Mobile QR Pairing, Capability Tokens, PIN Rate Limiting, and Presentation Stream Hijack Prevention (`SPEC-121-02`);
3) Backend Security Boundaries: Fail-Closed Host and Origin Header Validation, Strict StorageKey 64-Hex SHA-256 and Directory Containment (`SPEC-121-03`);
4) Monotonic Seekbar Telemetry (`seq`), Reconnect Full-State Snapshot, Projector Video Mute Invariant, and Bilingual Localization Parity (`SPEC-121-04`);
and comprehensive regression verification without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, zero room-facing audio leaks, and a 7-day expiry.
