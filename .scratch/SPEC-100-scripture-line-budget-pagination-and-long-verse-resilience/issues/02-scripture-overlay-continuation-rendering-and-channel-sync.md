# 02: Presentation Surface Line-Budget Scaling & Scripture Overlay Continuation Rendering

**What to build:** In `src/lib/scripture-scaling.ts`, `src/lib/offline/service-snapshot.ts`, `src/components/ScriptureOverlayView.tsx`, `src/operator/present/PresenterOperator.tsx`, `src/lib/present-channel.ts`, and `src/projected/ProjectorClient.tsx`:

1. **Chapter Presentation Base Font Stabilization & Durable Rehydration**:
   - In `src/lib/scripture-scaling.ts` (`getScriptureScaling`):
     - Single derivation location: `typographyMode` is derived once upon acquisition in `PresenterOperator.tsx`: `(is_whole_chapter || verses.length > 4) ? 'chapter' : 'verse'`.
     - `getScriptureScaling` and all renderers are strictly consumers of passed `typographyMode`. Tail pages with <= 4 verses in a whole chapter remain locked to `typographyMode: 'chapter'`.
     - When `typographyMode === 'chapter'`, lock `fontSizeStyle` to a stable **`4.8cqh`** across all pages, retaining hero/reading size only for single short verse lookups.
     - In `computeScriptureFitScale`:
       - Preserves stage safety (`maxAllowedHeight = stageHeight * 0.78`) without clipping.
       - Guarantees scale >= `0.917` (`4.4cqh`) for declared bilingual fixtures (`KJV` & `TB`).
       - Adjacent page scale delta `<= 0.08` across chapter presentation.
   - In `src/lib/offline/service-snapshot.ts`:
     - Add `typography_mode: 'chapter' | 'verse'` and `is_whole_chapter: boolean` to `ScriptureCacheRecord`.
     - In `getCachedScripturePassage`: if `cached.typography_mode` is missing (legacy record), safely derive:
       `cached.typography_mode || (cached.is_whole_chapter || cached.reference.indexOf(':') === -1 || (cached.verses && cached.verses.length > 4) ? 'chapter' : 'verse')`.

2. **Render Geometry Reconciliation & Anti-Blowout CSS**:
   - In `src/components/ScriptureOverlayView.tsx`:
     - Set `lineHeight: typographyMode === 'chapter' ? 1.28 : 1.35` (matching visual budget).
     - Add `overflow-wrap: anywhere` on `data-slot="scripture-text"` to ensure unbroken tokens cannot trigger horizontal overflow.
     - Render continuation indicators only when `isContinuation === true` (or `continuationIndex > 1`).

3. **Canonical Wire Contract & Presenter-Projector Synchronization**:
   - In `src/lib/present-channel.ts`:
     - Define unified `ScriptureOverlay` with all fields non-optional:
       ```ts
       export type ScriptureOverlay = {
         reference: string;
         displayReference: string;
         text: string;
         mode: 'per-verse' | 'inline';
         verses: Array<{ verse: number; text: string; label?: string }>;
         currentPage: number;
         totalPages: number;
         typographyMode: 'chapter' | 'verse';
         isContinuation: boolean;
         continuationIndex: number;
         continuationCount: number;
       };
       ```
     - Define `PresentMessage`:
       `| ({ type: 'scripture'; planIdentity: string } & ScriptureOverlay)`
       `| { type: 'sync'; ...; scripture?: ScriptureOverlay | null; ... }`
   - In `PresenterOperator.tsx`:
     - Broadcast complete non-optional object and forward `typographyMode`.
     - Handle `[Next Page]` and `[Prev Page]` navigation: increments/decrements `scripturePageIndex`, updates active `ScriptureOverlayView`, and broadcasts new chunk immediately to `ProjectorClient`.
     - Normalize incoming remote scripture intents into a complete `ScriptureOverlay` before broadcast, preserving remote control functionality (FR-35).
   - In `ProjectorClient.tsx`:
     - Unpack all fields and forward exact props to `ScriptureOverlayView`.

4. **Automated Integration Tests in `tests/scripture-continuation-presentation.test.mjs`**:
   - Operator navigation test: load John 4 / Yohanes 4, step through every page with `[Next Page]`, and assert exact projector synchronization, scale >= `0.917`, adjacent delta `<= 0.08`, zero clipping (`scrollHeight <= clientHeight`), and tail pages retaining `typographyMode: 'chapter'`.
   - Acceptance test on 16:9 viewports (1920x1080 and 1280x720) across both KJV and TB: verifies `scrollHeight <= clientHeight` and `scrollWidth <= clientWidth` across all John 4 / Yohanes 4, Esther 8:9 / Ester 8:9, and Psalm 23 / Mazmur 23 pages after web fonts settle.
   - Scale floor verification: scale factor across all declared pages never drops below `0.917` (`4.4cqh`) with adjacent-page delta `<= 0.08`.
   - Partial selections coverage: 4 verses (verse mode) vs 5 verses (chapter mode).
   - Legacy cache fallback verification: legacy records lacking `typography_mode` derive correctly across chapter, multi-verse, and single-verse fixtures.
   - Unbroken tokens wrap cleanly with `overflow-wrap: anywhere`.
   - Defect injection proofs.

**Blocked by:** SPEC-100-01

**Status:** closed

- [x] Stabilize whole-chapter presentation base font to `4.8cqh` with calibrated `0.917` floor and adjacent delta `<= 0.08`.
- [x] Add `typography_mode` to `ScriptureCacheRecord` with legacy read derivation fallback.
- [x] Implement end-to-end `[Next Page]` / `[Prev Page]` navigation lifecycle with projector synchronization.
- [x] Reconcile render geometry (`lineHeight: 1.28`) and add `overflow-wrap: anywhere`.
- [x] Add integration tests in `tests/scripture-continuation-presentation.test.mjs`.
