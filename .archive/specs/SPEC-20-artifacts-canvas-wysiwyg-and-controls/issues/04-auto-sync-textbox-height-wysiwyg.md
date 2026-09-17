# Ticket SPEC-20-04 — Auto-Sync Textbox Bounding Box Height for True WYSIWYG Parity

**Status:** ready-for-agent

## Component
`registry` / `presenter` (`src/lib/registry/canvas-utils.ts`, `src/components/admin/ArtifactEditor.tsx`, `src/components/artifacts/ArtifactSlide.tsx`, `src/lib/pptx-draw.ts`)

## Dependencies
`blocked_by: ["SPEC-20-03"]`

## Problem
During QA of SPEC-19 on `presenter-dev.bic.my.id`:
1. In the canvas editor, text with large font sizes (e.g. 60px - 100px) displays cleanly at the authored size because `fabric.Textbox` allows text to expand vertically beyond its initial box height without clipping.
2. However, upon switching to Presentation View (`ArtifactSlide.tsx`) or downloading PPTX, the text suddenly downscales to a tiny size (e.g. 25px).
3. In SPEC-19, an overflow warning badge (`⚠️ Text exceeds box bounds; presentation and PPTX will auto-shrink text to fit`) was added, forcing operators to manually drag bounding box handles to eliminate the warning. Operators found this confusing and manual because the canvas already looked visually correct.
4. **Deliberate Policy Reversal from SPEC-19-05**: SPEC-20 supersedes the manual warning badge approach with automatic bounding box synchronization. Instead of placing the burden on operators to manually resize boxes, `serializeCanvas` auto-syncs `h` (and checks `w` expansion) to encapsulate rendered text upon save.
5. Root Cause: In `src/lib/registry/canvas-utils.ts` (`serializeCanvas`), lines 322-328:
   ```typescript
   const h = isText
     ? scaleY !== 1
       ? source.h * scaleY
       : source.h
     : isHeightResized
       ? pxToPct(measuredHeight, CANVAS_HEIGHT)
       : source.h;
   ```
   For text elements, `source.h` was locked and never updated when font size or text lines expanded vertically. When saved, the element retained a tiny `h` (e.g. 10% = 54px). In `ArtifactSlide.tsx`, `largestFittingTextScale` saw that the 100px text exceeded the 54px container and aggressively shrank the font. In PPTX, `estimateTextFitScale` did the same.

## Requirements
1. In `src/lib/registry/canvas-utils.ts` (`serializeCanvas`):
   - For text elements (`isText`), automatically synchronize the bounding box height `h` with the measured rendered text height:
     ```typescript
     const measuredTextHeightPct = pxToPct(measuredHeight, CANVAS_HEIGHT);
     const h = isText
       ? Math.max(source.h, measuredTextHeightPct)
       : isHeightResized
         ? pxToPct(measuredHeight, CANVAS_HEIGHT)
         : source.h;
     ```
   - Ensure `h` does not exceed the slide boundary (`next.y + h <= 100` or clamped to `Math.min(100 - next.y, h)`).
   - Horizontal width check: if `measuredWidth > authoredWidth`, expand `w` up to `100 - next.x` so single-word overflows do not cause horizontal clipping or unwanted scaling.
   - Stored slides lifecycle: auto-sync applies upon save in canvas editor; existing stored slides retain their authored values until opened and saved by an operator.
2. In `src/components/admin/ArtifactEditor.tsx`:
   - When text font size is changed or text content is modified, update `obj.data.authoredHeight` to match the new rendered text height.
   - Remove or retire the manual "Text exceeds box bounds" warning badge, because bounding box height is now auto-synchronized to accommodate the text.
3. In `ArtifactSlide.tsx` and `pptx-draw.ts`:
   - Because the persisted bounding box `h` now fully encloses the rendered text at authored font size, `largestFittingTextScale` and `estimateTextFitScale` evaluate to `1.0` (no downscaling).
   - Slides created in the editor now maintain 100% WYSIWYG parity with Presentation View and PPTX downloads.
4. In `tests/smoke-spec-19.test.mjs`:
   - Refactor lines 247-270: retain the 0.75 pt/px mathematical equivalence invariant while updating the overflow badge assertion to reflect that SPEC-20 retired the manual badge in favor of automatic height synchronization.
5. In `.how/registry/06-flows/canvas-authoring-controls.md`:
   - Update documentation under "Canvas overflow feedback" to explain the automatic height synchronization policy and note the retirement of the manual warning badge.

## Acceptance Criteria
- Creating or editing text with font size 60px or 100px on canvas automatically persists a bounding box height `h` large enough to envelop the text lines.
- In Presentation View (`ArtifactSlide.tsx`), the text displays at the full authored font size without unexpected auto-shrinking.
- In downloaded PPTX decks, text maintains identical proportional scale (0.75 pt/px) without auto-shrink.
- Manual box stretching is no longer required to achieve WYSIWYG text sizing, and the manual warning badge is removed.
- Tests in `tests/smoke-spec-19.test.mjs` pass with updated assertion.
- Documentation in `.how/registry/06-flows/canvas-authoring-controls.md` reflects the auto-sync behavior.
- Automated tests in `tests/smoke-spec-20.test.mjs` verify round-trip serialization of auto-synced textbox height and presentation scale parity.
