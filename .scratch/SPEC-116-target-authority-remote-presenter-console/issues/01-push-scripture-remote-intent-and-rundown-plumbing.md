# SPEC-116-01 — Push Scripture Remote Intent Dispatching, Chunk Pagination Sync, Clear Scripture, and Rundown Text Plumbing

**Satisfies:** [UC-12, UC-29, FR-16, FR-35]
**Blocked by:** []
**Status:** open

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
