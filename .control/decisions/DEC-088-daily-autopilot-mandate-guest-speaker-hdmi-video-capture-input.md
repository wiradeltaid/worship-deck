---
type: mandate
id: DEC-088
status: applied
accepted_by: 'kodesh87 (2026-10-04)'
touches:
  - .control/memlog/autopilot-DEC-088.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .control/generated/decisions.md
  - .how/_platform/ARCHITECTURE-SPINE.md
  - .how/presenter/SDD-presenter.md
  - .scratch/
supersedes: null
superseded_by: null
created: '2026-10-04'
---

# DEC-088 — Daily Autopilot mandate for Guest Speaker HDMI Video Capture Input and AD-29 Narrow Telemetry Extension (SPEC-101)

## Decision

> The owner grants an autonomous daily engineering execution mandate under DEC-088:
> 1) Execution: coordinator implements application and test changes directly inside the active worktree (no coding delegation);
> 2) Code review: coordinator self-review and independent peer review via `kiro-agent chat --model gpt-5.6-terra --effort high --trust-tools=fs_read --no-interactive`;
> 3) Testing & Verification: coordinator alone verifies the authoritative test suite (`npm test` and `go test ./cmd/... ./internal/...`) with executable absence guards and defect injection;
> 4) Review & Architecture Analysis: delegate document/architecture review to Terra peer reviewer;
> 5) Architectural Invariant Extensions:
>    - `AD-10`: Authoritatively extends `PresentMessage['sync']` and `currentState()` with `projection: ProjectedSource` (`{ kind: 'deck' } | { kind: 'guest'; guestSessionId: string }`) so projector reconnects/reloads deterministically retain projection state without `localStorage` reliance.
>    - `AD-29`: Authoritatively admits a narrow, strictly typed, non-controlling telemetry message from projector to operator: `projector-media-status` (`attached` | `unavailable` with closed reason taxonomy). Projector does not become a secondary controller; Operator Console retains sole authority to transition global projection state to `deck`.
> 6) Worktree isolation & Integration: coordinator alone isolates worktrees, logs all decisions in `.control/memlog/autopilot-DEC-088.md`, stages, commits, and merges per `wdi-autopilot`;
> carrying implementation through G5 Release in the run branch `autopilot/DEC-088`.

## Why

To allow unattended continuous execution of engineering tickets under:
- SPEC-101: Guest Speaker HDMI Video Capture Input (`SPEC-101-01`..`SPEC-101-03`)
incorporating the unanimous adversarial review findings from 5 model architects (DeepSeek Pro, Sol, Qwen Max, GLM-5.3, Opus) and Terra without blocking on manual prompts.

## Cost if wrong

Unattended iterations could spin on blocked work if not bounded by strict test suite gates, consumer clone cleanup, and a 7-day expiry.
