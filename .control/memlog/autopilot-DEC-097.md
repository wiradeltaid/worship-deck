---
artifact: .control/decisions/DEC-097-daily-autopilot-mandate-direct-local-media-playback-and-top-dock-ergonomics.md
---

# Autopilot Ledger — DEC-097

## Resume

- Iteration: I-1
- Run branch: autopilot/DEC-097
- Stopped at: In progress — SPEC-111-01 closed, ready for SPEC-111-02
- Blocked: —
- Parked: —
- Next: SPEC-111-02 (SQLite schema and backend migrations)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-097 for Direct Local Media Playback, Conscious Offline Downloader, and Two-Tab Media Library (SPEC-111) | waiting for interactive manual dispatch | low | .control/decisions/DEC-097-daily-autopilot-mandate-direct-local-media-playback-and-top-dock-ergonomics.md |
| I-1 | SPEC-111-01 | Establish 3-tier storage ladder (DirectoryPicker -> OPFS -> Memory), durable storage persistence, and Service Worker stream transfer contract without <a download> | monolithic single-storage assumption or ambient SW permissions | playback stalls in WebView2 and offline sanctuary access failures | .control/decisions/DEC-098-storage-ladder-webview2-file-system-access-and-service-worker-stream-resolution.md, src/operator/present/media-player/storage-ladder.ts, tests/local-media-player.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, Vite build green, public-repo-guard green, full npm test suite green, validator green)
- SPEC-111-01: PASS (Storage ladder capability detection, OPFS fallback, memory fallback, storage persistence, and <a download> prohibition guard green; tests/local-media-player.test.mjs & smoke:spec-111 green)
