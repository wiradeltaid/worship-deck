# 02: Presenter Operator Hydration Lifecycle and State Sync

**Satisfies:** [UC-12, FR-16]
**Blocked by:** SPEC-105-01
**Status:** done

**What to build:** In `src/operator/present/PresenterOperator.tsx` and `tests/presenter-reload-recovery.test.mjs`:

1. **Pre-Sync State Initialization**:
   - In `PresenterOperator.tsx`:
     - Load restored session synchronously on mount using `loadPresenterSession` from `src/lib/<presenter-session.ts>`:
       ```ts
       const restoredSession = useMemo(() => {
         return loadPresenterSession(serviceId, planIdentity, slides.length);
       }, [serviceId, planIdentity, slides.length]);
       ```
     - Initialize React states from `restoredSession`:
       - `index`: `restoredSession ? restoredSession.index : 0`
       - `blank`: `restoredSession ? restoredSession.blank : false`
       - `scriptureOverlay`: `restoredSession?.scriptureOverlay ?? null`
       - `loadedScripture`: `restoredSession?.loadedScripture ?? null`
       - `scripturePageIndex`: `restoredSession?.scripturePageIndex ?? 0`
       - `liveTransition`: `restoredSession?.liveTransition ?? deckTransition`
       - `liveBackground`: `restoredSession?.liveBackground ?? null`
     - Initialize `indexRef`, `blankRef`, `scriptureOverlayRef`, `transitionRef`, and `backgroundRef` immediately with these restored values.
   - **Pre-Sync Wire Invariant**:
     - `openPresentChannel(serviceId)` MUST construct `currentState()` with the recovered state.
     - Under NO circumstances may a default `index: 0` message be emitted before hydration completes.
   - When `ch.postMessage(currentState())` runs, the connected projector window receives the exact position, blank state, scripture overlay, transition, and background that were active before reload.
   - **Projection Mode**: projection safely falls back to `{ kind: 'deck' }` because WebRTC media tracks terminate on page reload.

2. **Continuous State Persistence**:
   - Unique presenter session ID: `presenterSessionIdRef = useRef(crypto.randomUUID())`.
   - Helper function `persistCurrentSession()` in `PresenterOperator.tsx`:
     ```ts
     const persistCurrentSession = useCallback(() => {
       savePresenterSession(serviceId, {
         planIdentity: planIdentityRef.current,
         activeSessionId: presenterSessionIdRef.current,
         index: indexRef.current,
         blank: blankRef.current,
         scriptureOverlay: scriptureOverlayRef.current,
         loadedScripture: loadedScriptureRef.current,
         scripturePageIndex: scripturePageIndexRef.current,
         liveTransition: transitionRef.current,
         liveBackground: backgroundRef.current,
       });
     }, [serviceId]);
     ```
   - Trigger `persistCurrentSession()` in:
     - `setIndexAndSync` / `manualNavigate`
     - `setBlankAndSync`
     - `setScriptureAndSync` / clear scripture
     - `setLiveTransition`
     - `setLiveBackground`

3. **Multi-Tab Authority Protection**:
   - Attach `activeSessionId` to the saved session.
   - If a new presenter session takes over (e.g. from Run-Sheet Start from Beginning), superseded background tabs recognize the authority change and disable further storage writes.

4. **Test Requirements (`tests/presenter-reload-recovery.test.mjs`)**:
   - Verify initial `sync` payload after reload matches all saved session states (`index`, `blank`, `scriptureOverlay`, `loadedScripture`, `scripturePageIndex`, `liveTransition`, `liveBackground`).
   - Negative ordering test: assert that NO `sync` with `index: 0` is emitted before restored state is dispatched.
   - Verify projector client (`ProjectorClient`) does not invoke `goTo(0)` when `PresenterOperator` reloads at slide 14.
   - Verify plan identity change forces clean start at index 0 and clears stale session.
