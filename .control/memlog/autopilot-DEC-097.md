---
artifact: .control/decisions/DEC-097-daily-autopilot-mandate-direct-local-media-playback-and-top-dock-ergonomics.md
---

# Autopilot Ledger — DEC-097

## Resume

- Iteration: I-1 (final)
- Run branch: autopilot/DEC-097
- Stopped at: Complete — All FR/Tickets/Specs in scope (SPEC-111) delivered, verified, and mandate applied
- Blocked: —
- Parked: —
- Next: Owner review and merge of PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-097 for Direct Local Media Playback, Conscious Offline Downloader, and Two-Tab Media Library (SPEC-111) | waiting for interactive manual dispatch | low | .control/decisions/DEC-097-daily-autopilot-mandate-direct-local-media-playback-and-top-dock-ergonomics.md |
| I-1 | SPEC-111-01 | Establish 3-tier storage ladder (DirectoryPicker -> OPFS -> Memory), durable storage persistence, and Service Worker stream transfer contract without <a download> | monolithic single-storage assumption or ambient SW permissions | playback stalls in WebView2 and offline sanctuary access failures | .control/decisions/DEC-098-storage-ladder-webview2-file-system-access-and-service-worker-stream-resolution.md, src/operator/present/media-player/storage-ladder.ts, tests/local-media-player.test.mjs |
| I-1 | SPEC-111-02 | Create media_playlist_items table with strict lowercase hex sha256 and non-negative size constraints, indexed by order_key and sha256 | unconstrained schema or dynamic client-side hashing | dirty catalog state, uppercase/lowercase hash mismatch, and broken offline matching | internal/db/schema.sql, internal/db/migrate.go, internal/db/migrate_media_playlist.go, internal/db/migrate_media_playlist_test.go |
| I-1 | SPEC-111-03 | Implement playlist REST endpoints, refcounted asset purge with 409 conflict guard, and HTTP 206 Partial Content byte range streaming | unconditional physical file deletion or non-streamable whole-file delivery | broken media references in other services and video seeking freezes in presenter | internal/httpapi/media_playlist.go, internal/httpapi/server.go, internal/httpapi/media_playlist_test.go |
| I-1 | SPEC-111-04 | Implement LocalMediaRegistry with separate directory handle and sha256 index stores, O(1) matching map, and chunked streaming hasher | relying on filename/metadata equality or main-thread hashing | UI lockups during 1GB video ingest and false matching across distinct media | src/operator/present/media-player/media-hasher.ts, src/operator/present/media-player/local-media-registry.ts, src/operator/present/media-player/index.ts, tests/local-media-player.test.mjs |
| I-1 | SPEC-111-05 | Implement root public/media-sw.js virtual streamer for /local-media/ namespace, RFC 7233 byte-range slicing, and present-channel source: local wire protocol | loading whole files into memory or streaming local media through loopback HTTP | excessive memory consumption on 1GB videos and broken projector seeking | public/media-sw.js, src/operator/present/media-player/virtual-streamer.ts, src/lib/present-channel.ts, src/projected/media/ProjectedMediaLayer.tsx, tests/local-media-player.test.mjs |
| I-1 | SPEC-111-06 | Implement two-tab layout (Pustaka Cloud vs Media Laptop) in MediaDrawer and accessible 4-state badge contract without emojis | mixed single-list clutter or unlabelled emoji icons | operator confusion over cloud vs offline availability and accessibility regressions | src/operator/present/media-player/MediaStatusBadge.tsx, src/operator/present/media-player/MediaDrawer.tsx, src/operator/present/media-player/index.ts, tests/local-media-player.test.mjs |
| I-1 | SPEC-111-07 | Implement ConsciousDownloaderEngine with sequential concurrency-1 queue, bulk preflight calculation, atomic streaming write with hash check, and physical file preservation on unlink | unmanaged concurrent downloads or background auto-caching without consent | bandwidth exhaustion in sanctuaries, corrupted partial downloads, and accidental data deletion | src/operator/present/media-player/downloader-engine.ts, src/operator/present/media-player/index.ts, tests/local-media-player.test.mjs |
| I-1 | SPEC-111-08 | Mount MediaTopBar in fixed 44px slot between header and slide monitors in PresenterOperator with spacebar focus safety and strict 4-predicate local-first routing | bottom-dock scroll occlusion or unverified local routing | operator panic controls scrolled below the fold and black projector screens | src/operator/present/media-player/playback-router.ts, src/operator/present/media-player/MediaTopBar.tsx, src/operator/present/PresenterOperator.tsx, src/operator/present/media-player/index.ts, tests/local-media-player.test.mjs |
| I-1 | SPEC-111-09 | Enforce and prove 5 mandatory absence guards with defect injection verification and full synthetic fixture compliance | static assertions without defect injection | undetected regressions in auto-download, filename matching, SW scope, or file preservation | tests/local-media-player.test.mjs, tests/public-repo-guard.test.mjs |

## Smoke Test Results

- Preflight verification: PASS (Go test suite green, Vite build green, public-repo-guard green, full npm test suite green, validator green)
- SPEC-111-01: PASS (Storage ladder capability detection, OPFS fallback, memory fallback, storage persistence, and <a download> prohibition guard green; tests/local-media-player.test.mjs & smoke:spec-111 green)
- SPEC-111-02: PASS (Database migration idempotency, constraint checks on empty name, invalid type, negative size/duration, uppercase/non-hex/short SHA green; internal/db/migrate_media_playlist_test.go green)
- SPEC-111-03: PASS (Playlist CRUD, PATCH reordering, HTTP 206 Content-Range streaming, 416 OOB range handling, refcounted unlinking, and 409 purge conflict guard green; internal/httpapi/media_playlist_test.go green)
- SPEC-111-04: PASS (Chunked streaming SHA-256 with progress callback, empty blob hash parity, LocalMediaRegistry dual stores, staleness detection on size/mtime change, and O(1) matching map green; tests/local-media-player.test.mjs & smoke:spec-111 green)
- SPEC-111-05: PASS (RFC 7233 byte range parser, /local-media/ URL resolution, media-sw.js namespace isolation, ProjectedSource.source wire synchronization, and projector muted invariant green; tests/local-media-player.test.mjs & smoke:spec-111 green)
- SPEC-111-06: PASS (No emojis in badge contract, 4-state labels [Streaming, Mengunduh, Tersedia di lokal, File terlepas], role=progressbar, and two-tab MediaDrawer structure green; tests/local-media-player.test.mjs & smoke:spec-111 green)
- SPEC-111-07: PASS (Conscious sequential downloader queue, bulk preflight size formatting, atomic stream abort on hash mismatch, and physical file preservation on index unlink green; tests/local-media-player.test.mjs & smoke:spec-111 green)
- SPEC-111-08: PASS (Local-first 4-predicate router, MediaTopBar fixed 44px slot without layout shift, panic controls with spacebar focus safety, and source indicator badge [Lokal|Cloud] green; tests/local-media-player.test.mjs & smoke:spec-111 green)
- SPEC-111-09: PASS (5 absence guards proven via defect injection: zero auto-download, zero filename matching, SW namespace isolation, local disk preservation, and server file unlink preservation green; public-repo-guard green)
