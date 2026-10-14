# SPEC-121-01 — Offline Media Playback Resolution & Unconnected Startup Fallback

**Satisfies:** [FR-16, UC-12]
**Blocked by:** []
**Status:** open

## Summary
Ensure full resilience when starting the desktop application without internet connectivity:
1. In `PresenterOperator.tsx`, assemble local-only media items from `localMediaRegistry` first. If `fetch('/api/media/playlist')` fails (offline), gracefully retain and display local items rather than aborting.
2. In `MediaStage.tsx` and `playlist-model.ts`, route playback of locally hydrated items through valid local resolvers (`/local-media/<sha256>` or `/api/media/<id>/content`) instead of dead external cloud URLs.
3. Synchronize IndexedDB schema version in `public/media-sw.js` to match `local-media-registry.ts` (`DB_VERSION = 2`) and support Blob extraction from `record.fileHandle`.

## Acceptance Criteria
- Presenter console mounts and displays all previously registered local media when initialized offline.
- Media playback executes cleanly without network connectivity, resolving local byte ranges.
- Service Worker successfully serves range 206 responses from IndexedDB v2 records.
- Automated regression tests prove offline playlist hydration and verify failure behavior via defect injection.
