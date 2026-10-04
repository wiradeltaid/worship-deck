# 02: Scripture Visual-Density Scaling & Stage Height Budget

**Satisfies:** [UC-12, UC-13, FR-16, FR-19]
**Blocked by:** none
**Status:** closed

**What to build:** In `src/lib/scripture-format.ts`, `src/lib/scripture-scaling.ts`, `src/components/ScriptureOverlayView.tsx`, `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`, and `tests/scripture-continuation-presentation.test.mjs`:

1. **Visual-Line Metric Propagation**:
   - In `src/lib/scripture-format.ts` (`paginateScriptureVerses`):
     - Compute `estimatedVisualLines` for each `ScripturePageChunk` using the existing `estimateScriptureLines()` function.
     - Include `estimatedVisualLines: number` on `ScripturePageChunk` and `ScriptureOverlay` in `src/lib/present-channel.ts`.
   - Pass `estimatedVisualLines` to `ScriptureOverlayView` in both `PresenterOperator.tsx` and `ProjectorClient.tsx`, maintaining strict operator-room presentation parity.

2. **Dynamic Density Scaling for Chapter Presentation**:
   - In `src/lib/scripture-scaling.ts` (`getScriptureScaling`):
     - Accept optional `estimatedVisualLines?: number`.
     - When `typographyMode === 'chapter'`:
       - **1–5 visual lines** (light density, e.g. John 4:1-5): base font **`6.0cqh`** (minHeight: `32cqh`).
       - **6–7 visual lines** (medium density, e.g. John 4:6-9 on whole chapter): base font **`5.4cqh`** (minHeight: `26cqh`).
       - **8–10 visual lines** (dense narrative, e.g. John 4:21-27): base font **`4.8cqh`** (minHeight: `20cqh`).
     - Passages in verse mode (<= 4 source verses not part of whole chapter) retain existing hero scaling (6.5cqh / 8.5cqh).

3. **Stage Height Budget Alignment & Zero-Clipping Contract**:
   - In `src/components/ScriptureOverlayView.tsx`:
     - Increase `lineHeight` for chapter mode from `1.28` to **`1.36`** for improved visual breathing room.
     - Update verse container height budget in CSS to `max-h-[82cqh]`.
     - In `computeScriptureFitScale()`: update height threshold from `stageHeight * 0.78` to `stageHeight * 0.82`, aligning JS fitting calculation with the CSS container.
     - Zero-clipping guarantee: `computeScriptureFitScale` scales dynamically if rendered content exceeds `maxAllowedHeight`, ensuring 100% containment on calibrated 16:9 displays.

4. **Automated Tests**:
   - In `tests/scripture-continuation-presentation.test.mjs`:
     - Test that actual page chunks from whole-chapter pagination scale adaptively based on `estimatedVisualLines`:
       - <= 5 visual lines -> `6.0cqh`
       - 6–7 visual lines -> `5.4cqh`
       - 8–10 visual lines -> `4.8cqh`
     - Test that fit scale preserves 16:9 containment with zero clipping on calibrated fixtures (John 4 / Yohanes 4, Esther 8:9).
     - Test operator-room parity: verify identical typography and scaling parameters between Presenter and Projector.

## Completion evidence

- Updated `src/lib/present-channel.ts` and `src/lib/scripture-format.ts` to attach `estimatedVisualLines` to `ScripturePageChunk` and `ScriptureOverlay`.
- Enhanced `getScriptureScaling` in `src/lib/scripture-scaling.ts` to adaptively scale base font (6.0cqh for <=5 lines, 5.4cqh for 6-7 lines, 4.8cqh for 8-10 lines).
- Updated `computeScriptureFitScale` height threshold to `stageHeight * 0.82` and CSS container to `max-h-[82cqh]`, with `lineHeight: 1.36` in `src/components/ScriptureOverlayView.tsx`.
- Propagated `estimatedVisualLines` to `ScriptureOverlayView` across both `PresenterOperator.tsx` and `ProjectorClient.tsx` for 100% operator-room presentation parity.
- Verified all 12 tests in `tests/scripture-continuation-presentation.test.mjs` pass.

