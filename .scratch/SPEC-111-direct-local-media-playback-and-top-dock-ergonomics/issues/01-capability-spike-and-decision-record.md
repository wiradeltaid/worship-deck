# SPEC-111-01 — Capability Spike on WebView2, Service Worker Handle Resolution, and OPFS Fallback

**Satisfies:** [UC-12, FR-16]
**Blocked by:** none
**Status:** done

## Summary
Conduct a focused capability spike verifying directory picker support in Windows WebView2, Service Worker handle accessibility from IndexedDB, and OPFS fallback behavior, recording architectural decisions as a DEC.

## Key Responsibilities
1. **Capability Spike Execution**:
   - Verify `window.showDirectoryPicker()` and `showOpenFilePicker()` behavior inside the packaged `WorshipDeck.exe` (Microsoft Edge WebView2).
   - Test whether Service Worker contexts can directly read `FileSystemFileHandle` from IndexedDB or if `MessageChannel` port transfer from the client page is required.
   - Validate OPFS (`navigator.storage.getDirectory()`) as an automated fallback when directory picking is unsupported or denied.
   - Test `navigator.storage.persist()` durability and permission prompts.
2. **Decision Record**:
   - Record validated platform decisions in a `DEC-` under `.control/decisions/` establishing the storage ladder (showDirectoryPicker -> OPFS fallback).

## Acceptance Criteria
- Verified matrix of storage capability across Google Chrome, Microsoft Edge, and packaged WebView2.
- Clean capability decision recorded before downloader and Service Worker implementation begins.
- Guard test verifies fallback activation when directory picker is unavailable.

## Comments

- 2026-10-11: Completed capability spike, ratified storage ladder DEC-098, implemented `storage-ladder.ts`, and verified fallback hierarchy and `<a download>` absence guard in `tests/local-media-player.test.mjs`.
