---
artifact: .control/decisions/DEC-096-daily-autopilot-mandate-presenter-in-console-media-player.md
---

# Autopilot Ledger — DEC-096

## Resume

- Iteration: I-1
- Run branch: autopilot/DEC-096
- Stopped at: In flight — SPEC-110-03 delivered, proceeding to SPEC-110-04
- Blocked: —
- Parked: —
- Next: SPEC-110-04 (Guard Test Suite & Absence Invariant Verification)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-096 for Presenter In-Console Media Player and Congregation Video Projection (SPEC-110) | waiting for interactive manual dispatch | low | .control/decisions/DEC-096-daily-autopilot-mandate-presenter-in-console-media-player.md |
| I-1 | SPEC-110-01 | Implement pure playlist domain model, external media store, MediaEngine with fade attenuation/cancellation, and MediaStage DOM host | stateful component internals | playback interrupts on view toggles, uncaught play rejections, and audio clipping | src/operator/present/media-player/, tests/presenter-media-player.test.mjs |
| I-1 | SPEC-110-02 | Mount persistent bottom MediaDock with panic controls, non-modal right-column MediaDrawer, and header launcher button with focus safety | obstructive modal dialogues | focus loss during slide navigation, unhandled panic controls during lock, and slide cue misses | src/operator/present/media-player/, src/operator/present/PresenterOperator.tsx, internal/httpapi/uploads.go, tests/presenter-media-player.test.mjs |
| I-1 | SPEC-110-03 | Extend present-channel with kind: 'media', enforce mutual exclusivity on z-30, and mount ProjectedMediaLayer with runtime mute invariant | sharing guest stream layer or unmuted projector audio | HDMI sound loop feedback, conflicting simultaneous z-30 video overlays, and broken reconnect states | src/lib/present-channel.ts, src/projected/media/ProjectedMediaLayer.tsx, src/projected/ProjectorClient.tsx, src/operator/present/PresenterOperator.tsx, tests/presenter-media-player.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, SPA build green, public-repo-guard green, full npm test suite 1876 tests green, validator green)
- SPEC-110-01: PASS (playlist-model pure ops, media-store subscription, media-engine fade attenuation/cancellation/rejection safety green; tests/presenter-media-player.test.mjs green)
- SPEC-110-02: PASS (MediaLauncherButton, MediaDock panic controls, non-modal MediaDrawer layout, and PresenterOperator integration green; tests/presenter-media-player.test.mjs green)
- SPEC-110-03: PASS (present-channel kind: 'media' parsing, mutual exclusivity on z-30, ProjectedMediaLayer mute invariant and drift correction green; tests/presenter-media-player.test.mjs green)
