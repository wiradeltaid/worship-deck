# SPEC-76 — Song Set Background Thumbnail Dropdowns and Canvas Image Fit Modes

## Problem Statement

Two usability gaps were identified during hand testing of service preparation and live presentation:

1. **Raw ID Strings in Background Selectors**:
   - In the live Presenter Console (`/services/{id}/present`) under Song Set live background override, the dropdown selector displays raw hash filenames / ID strings (e.g. `7a5b3c...jpg` or `Image 12`) parsed from image URLs.
   - In the Service Form (`/services/{id}`) within dynamic song set fields, the background selector similarly displays raw ID / filename strings.
   - Because background image uploads use opaque hash filenames, operators cannot identify which graphic corresponds to which song set without memorizing hash strings or opening separate media library tabs. Both surfaces must offer consistent, visual thumbnail-led selection where operators see image previews directly inside the dropdown options and trigger without deciphering opaque hash strings.

2. **Incomplete Image Sizing Controls & Resize Coercion for Canvas Elements & Placeholders**:
   - When designing slides in the Canvas Artifact Editor (`/admin/artifacts`), operators add image elements and predefined image placeholders (such as `sermon graphic` / `sermon_poster`) and resize their bounding boxes to various target ratios (e.g., full screen 16:9, vertical 3:4, banner, or compact inset).
   - Currently, the element properties toolbar only toggles between `Stretch` (`fill`) and `Fit` (`contain`), and manual resizing on canvas forcibly coerces the element's style to `objectFit: 'fill'` (overwriting any previous user choice). The industry-standard `Cover` (Fill area / scale to fill while preserving aspect ratio, cropping overflow) mode is missing from the editor UI, even though the underlying data model (`ImageStyle.objectFit: 'contain' | 'cover' | 'fill'`) and presentation renderers (`ArtifactSlide.tsx`, `pptx-draw.ts`) already support it.
   - Operators need intuitive, clearly labeled controls in the element properties toolbar to choose how images adapt to the bounding box:
     - **Fit (Contain)**: Preserves aspect ratio, fits entirely within width and height bounds (letterbox/pillarbox if ratios differ).
     - **Cover (Fill Area)**: Preserves aspect ratio, expands to cover the entire bounding box (crops overflow).
     - **Stretch (Fill)**: Stretches image to match width and height in all directions (distorts aspect ratio without ratio lock).

Neither change should disrupt existing template layouts, database migrations, or PPTX export compatibility.

## Solution

1. **Visual Thumbnail Dropdown for Background Selection**:
   - In `src/operator/DynamicFormBody.tsx` (Service Form) and `src/operator/present/PresenterOperator.tsx` (Presenter Console), update the background selection `<Select>` components:
     - Visually led selector: each item renders an image thumbnail preview (`<img src={img.url} />` with rounded borders and aspect ratio containment) alongside clean, non-opaque labels (`Image <id>` or `Background <id>`, with `(Default)` indicator where applicable). Opaque hash filenames are completely eliminated from user-facing text.
     - Render the selected item trigger with the selected thumbnail preview and clean label.
     - Retain distinct domain sentinel semantics:
       - Service Form maps default sentinel to `background: ''` (stored in service payload).
       - Presenter Console maps "Deck default" to `null` (live-only session override).

2. **Full Image Fit Mode Triad & Elimination of Resize Coercion in Canvas Editor**:
   - In `src/components/admin/ArtifactEditor.tsx`:
     - Expand `imageFit` state to `'contain' | 'cover' | 'fill'`.
     - Expand the image properties toolbar to present all three sizing modes:
       - **Fit** (`objectFit: 'contain'`): Aspect ratio preserved, entire image fits inside bounding box.
       - **Cover** (`objectFit: 'cover'`): Aspect ratio preserved, fills entire bounding box, cropping excess.
       - **Stretch** (`objectFit: 'fill'`): Stretches to fill container bounds completely in all directions.
     - Ensure this control is active and functional when selecting either static `image` elements or predefined `image-placeholder` elements (e.g. `sermon_poster`).
     - **Eliminate Resize Coercion**: Remove legacy code paths in scaling/resizing handlers that forcibly set `objectFit = 'fill'`. Manual resizing must preserve the element's configured `objectFit`.
     - Serialize `element.style.objectFit` into the layout JSON on change and mark canvas dirty.
     - Underlying `ArtifactSlide` stage preview renders the chosen fit mode in real time.

3. **Product Decision on Image Fit Modes**:
   - In response to the user's research request regarding standard image options: slide presentation and graphic design standards (PowerPoint, Keynote, Canva, CSS `object-fit`) establish three core container modes: `Fit` (`contain`), `Cover` (`cover`), and `Stretch` (`fill`). An unconstrained "actual-size" mode (`object-fit: none`) is intentionally excluded because modern multi-megapixel photo uploads (e.g. 4000x3000) would unpredictably overflow the 1920x1080 canvas bounds. `Cover` directly satisfies the user's intent to fill the bounding box completely without letterboxing or distortion.

4. **Runtime & PPTX Parity**:
   - `ArtifactSlide.tsx` applies `resolveObjectFit(element.style)` (`contain`, `cover`, `fill`) to resolved images.
   - `pptx-draw.ts` maps `contain` and `cover` to pptxgenjs `sizing: { type: objectFit, w, h }` and `fill` to unconstrained stretch without errors.

5. **Automated Verification**:
   - Author `tests/background-thumbnail-picker.test.mjs` verifying:
     - Option and trigger rendering in both Presenter and DynamicFormBody include thumbnail image tags and clean non-opaque labels.
     - Absolute absence of raw hash string leaks in option text.
     - Distinct sentinel values are preserved (`''` for service form, `null` for presenter).
   - Author `tests/canvas-image-fit-modes.test.mjs` verifying:
     - `ArtifactEditor.tsx` declares and renders all 3 sizing options (`contain`, `cover`, `fill`).
     - `image-placeholder` elements activate the image properties toolbar.
     - Manual resize operations do not coerce `objectFit` to `fill`.
     - `resolveObjectFit` and `calculateImageFit` accurately handle `contain`, `cover`, and `fill`.
     - PPTX export in `pptx-draw.ts` preserves sizing definitions across all three modes.

## User Stories

1. As a service planner configuring song sets on `/services/{id}`, I want to see thumbnail previews of available background images in the dropdown with clean labels, so that I can immediately choose the right graphic without guessing from hash filenames.
2. As a presenter operator overriding backgrounds on `/services/{id}/present`, I want to see thumbnail previews of background options in the presenter header dropdown, so that I can quickly select a new visual theme during live service.
3. As a slide layout designer adding `sermon graphic` on `/admin/artifacts`, I want to choose between Fit, Cover, and Stretch in the element properties toolbar, so that the sermon poster fills the slide exactly as intended regardless of its source aspect ratio.
4. As a slide designer manually resizing an image or image-placeholder on canvas, I want the element to keep its configured Fit or Cover mode instead of being forcibly stretched, so that my aspect ratio choices persist through layout edits.
5. As a slide designer creating a full-screen sermon slide, I want to set the sermon graphic to Cover so that it covers the entire 16:9 canvas without black bars, or Stretch when exact pixel-matching is required.
6. As a slide designer creating a framed sermon slide, I want to set the sermon graphic to Fit so that the entire poster is visible inside its designated frame without any cropping.
7. As a repository maintainer, I want automated unit tests, behavioral checks, and PPTX parity assertions ensuring that thumbnail dropdowns and the three fit modes are preserved without regressions.

## Implementation Decisions

- **Thumbnail Selector Component/Layout**:
  Inside `<SelectItem>` for background choices:
  ```tsx
  <div className="flex items-center gap-2 py-0.5">
    <img
      src={bg.url}
      alt=""
      className="h-6 w-9 shrink-0 rounded border border-border object-cover bg-muted"
    />
    <span className="truncate text-xs">
      Image {bg.id} {bg.isDefault ? '(Default)' : ''}
    </span>
  </div>
  ```
  Inside `<SelectTrigger>`: Render the selected thumbnail alongside the clean label so the operator sees the current choice at a glance.
- **Three-Button Segmented Control in ArtifactEditor**:
  Replace the 2-button toggle in `ArtifactEditor.tsx` with a 3-button segmented group:
  - `Fit` (`contain`)
  - `Cover` (`cover`)
  - `Stretch` (`fill`)
- **Preserve Fit Mode on Resize**:
  Remove `(member as any).data.objectFit = 'fill'` and related assignments from `ArtifactEditor.tsx:1236-1240`, `1277-1278`, and `1377-1378`. Let the element keep its authored `objectFit`.
- **Support for `image-placeholder` Type**:
  Ensure `selectedImageCount` and active element detection in `ArtifactEditor.tsx` include elements where `el.type === 'image' || el.type === 'image-placeholder' || (obj as any).data?.isImage || (obj as any).data?.placeholderKey`.
- **Preserve Backward Compatibility**:
  Existing layouts without explicit `objectFit` continue to resolve to `DEFAULT_OBJECT_FIT` (`contain`). Existing `fill` settings remain `fill`. No existing templates are invalidated.

## Testing Decisions

- Author `tests/background-thumbnail-picker.test.mjs`:
  - Asserts `PresenterOperator.tsx` renders background options with thumbnail images (`<img src=...`) and thumbnail triggers.
  - Asserts `DynamicFormBody.tsx` renders song set background options with thumbnail images.
  - Asserts zero occurrences of raw hash filenames (`.split('/').pop()`) in option labels.
  - Verifies distinct sentinel values (`''` vs `null`).
- Author `tests/canvas-image-fit-modes.test.mjs`:
  - Asserts `ArtifactEditor.tsx` declares and renders all 3 sizing options (`contain`, `cover`, `fill`).
  - Asserts `image-placeholder` elements are included in image properties toolbar detection.
  - Asserts resize operations preserve existing `objectFit` instead of coercing to `fill`.
  - Asserts `resolveObjectFit` in `render-model.ts` returns `contain`, `cover`, and `fill` respectively.
  - Asserts PPTX export in `pptx-draw.ts` preserves sizing definitions across all three modes.
- Wire both test files additively into `package.json` test script.
