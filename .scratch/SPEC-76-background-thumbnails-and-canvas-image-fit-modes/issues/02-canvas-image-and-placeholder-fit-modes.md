# 02: Canvas Image and Placeholder Fit Modes (WSD-W2)

**What to build:** In `src/components/admin/ArtifactEditor.tsx`, provide full support for the standard image sizing triad (`Fit` / `contain`, `Cover` / `cover`, `Stretch` / `fill`) in the element properties toolbar. Ensure this control is actively available and fully functional when selecting static `image` elements as well as predefined `image-placeholder` elements (e.g. `sermon graphic` / `sermon_poster`). Eliminate legacy canvas scaling handlers that forcibly coerced resized elements to `objectFit = 'fill'`, ensuring manual bounding box resizing preserves the element's configured `objectFit`. Persist the chosen `objectFit` to `element.style.objectFit` in the layout JSON. Verify that `ArtifactSlide.tsx` applies the style via `resolveObjectFit` and `pptx-draw.ts` exports all three modes cleanly to PPTX without regressions. Author `tests/canvas-image-fit-modes.test.mjs` verifying UI options, type declarations, resize preservation, runtime resolution, and PPTX sizing mapping, and wire additively into `package.json` preserving `--test-concurrency=1`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/components/admin/ArtifactEditor.tsx`, `src/lib/registry/types.ts`, `src/lib/artifacts/render-model.ts`, `src/components/artifacts/ArtifactSlide.tsx`, and `src/lib/pptx-draw.ts` first.
- [x] In `src/components/admin/ArtifactEditor.tsx`:
      - Expand `imageFit` state to `'contain' | 'cover' | 'fill'`.
      - Expand the image properties toolbar button group to 3 segmented options: `Fit` (`contain`), `Cover` (`cover`), `Stretch` (`fill`), with clear tooltip descriptions.
      - Update element selection filter so that `selectedImageCount` and active image detection recognize `image-placeholder` elements (by `el.type === 'image-placeholder'`, `data.isImage`, or `data.placeholderKey`).
      - Remove legacy resize coercion code paths (in `object:scaling` / bounding box handlers around lines 1236-1240, 1277-1278, and 1377-1378) that forced `objectFit = 'fill'`. Preserve the element's existing `objectFit`.
      - In `handleToggleImageFit` (or `setImageFit`), serialize `objectFit` to `element.style.objectFit` and update Fabric object data accordingly.
- [x] In `src/lib/artifacts/render-model.ts` and `src/components/artifacts/ArtifactSlide.tsx`:
      - Verify that `resolveObjectFit` correctly handles `contain`, `cover`, and `fill`.
      - Verify that `ImageElement` in `ArtifactSlide.tsx` renders `<img style={{ objectFit: resolveObjectFit(element.style) }} />`.
- [x] In `src/lib/pptx-draw.ts`:
      - Verify that `renderImageElement` maps `contain` and `cover` to pptxgenjs `sizing: { type: objectFit, w, h }` and `fill` to unconstrained stretch.
- [x] Author `tests/canvas-image-fit-modes.test.mjs`:
      - Verify that `ArtifactEditor.tsx` renders buttons for all 3 fit modes (`contain`, `cover`, `fill`).
      - Verify that `image-placeholder` elements activate the image properties toolbar.
      - Verify that scaling / resizing handlers do not coerce `objectFit` to `fill`.
      - Verify that `resolveObjectFit` accurately resolves `contain`, `cover`, and `fill`.
      - Verify that `pptx-draw.ts` preserves sizing specifications for all three modes.
- [x] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/canvas-image-fit-modes.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [x] Run tests and `npm run typecheck` to verify 100% clean execution.
