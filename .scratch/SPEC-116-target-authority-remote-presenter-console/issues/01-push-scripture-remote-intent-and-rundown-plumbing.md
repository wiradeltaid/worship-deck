# SPEC-116-01 — Push Scripture Remote Intent Dispatching, Chunk Pagination Sync, Clear Scripture, and Rundown Text Plumbing

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** []
**Status:** done

## Summary
Implement remote scripture intent dispatching in `PresenterOperator.tsx` when `mode === 'remote'`, wire scripture chunk pagination updates and clear scripture intents to `onSendIntent`, mirror scripture overlay state over SSE, and forward service `raw_payload` rundown text through `RemotePage.tsx` and `RemoteOperator.tsx`.

## Key Responsibilities
1. **Remote Scripture Intent Dispatching (`PresenterOperator.tsx`)**:
   - In `pushScripture()`, when `mode === 'remote'`, call `onSendIntent` with `{ type: 'scripture', reference: baseRef, text: firstPage.text, verses: firstPage.verses, mode: scriptureMode, is_whole_chapter: isWholeChapter, pageIndex: 0, planIdentity: planIdentityRef.current }`.
   - In `clearScripture()`, when `mode === 'remote'`, call `onSendIntent` with `{ type: 'clear-scripture', planIdentity: planIdentityRef.current }`.
   - In `handlePageChange(pageIdx)`, compute target page slice and dispatch `{ type: 'scripture', reference: loadedScripture.reference, text: targetPage.text, verses: targetPage.verses, mode: scriptureMode, pageIndex: pageIdx, planIdentity: planIdentityRef.current }`.
2. **Host-Side Scripture Application & SSE Mirroring (`presenter-remote-client.ts`, `PresenterOperator.tsx`)**:
   - Update `PresenterActionHandlers` and `applyRemoteIntent` to accept `pageIndex` in scripture intents and apply to `setScriptureOverlay` and `scripturePageIndexRef`.
   - Host `broadcastState` includes active `scripture` overlay snapshot in `RemoteControlSessionState`.
3. **Rundown Text Plumbing (`RemotePage.tsx`, `RemoteOperator.tsx`)**:
   - In `spa/src/pages/RemotePage.tsx`, pass `rundownText={data.raw_payload || ''}` to `<RemoteOperator />`.
   - In `src/operator/present/RemoteOperator.tsx`, accept `rundownText?: string` prop and pass it down to `<PresenterOperator rundownText={rundownText} ... />`.

## Acceptance Criteria
- Pushing scripture from a paired mobile remote device immediately dispatches a `scripture` intent and renders the verse on the sanctuary screen via the host PC.
- Changing scripture pages on mobile advances the projected scripture slide on the host screen and maintains bidirectional page index parity.
- Clicking Clear Scripture on mobile removes the scripture overlay on both mobile and host screens.
- Opening the mobile remote view displays the service rundown text in the sidebar without showing "No rundown text provided".

## Comments
- Implemented remote scripture intent dispatching in `PresenterOperator.tsx` (`pushScripture`, `handlePageChange`, `handleModeChange`, `clearScriptureAndSync`).
- Extended `PresenterRemoteIntent` with `pageIndex?: number` and updated `applyRemoteIntent` to propagate `pageIndex` and route `clear-scripture` to `clearScriptureAndSync`.
- Added bidirectional SSE mirroring for scripture overlay via `RemoteControlSessionState['scripture']`, including full passage preservation and immediate connection snapshot.
- Plumbed `rundownText={data.raw_payload || ''}` from `RemotePage.tsx` through `RemoteOperator.tsx` to `PresenterOperator.tsx`.
- Peer review passed: DeepSeek V4 Pro and Terra Codex findings addressed (full passage verse parity, `handleModeChange` remote intent routing and SSE broadcast, initial connection scripture snapshot, multi-page roundtrip test, EOF hygiene).
- Verified green across: `tests/remote-presenting-client.test.mjs` (26/26 tests pass), `tests/remote-screen.test.mjs` (13/13 tests pass), `tests/bilingual-i18n-parity.test.mjs` (25/25 tests pass), `npm run typecheck` (0 errors), `npm run build` (clean build), `public-repo-guard.test.mjs` (5/5 pass), `go test ./...` (100% green).
