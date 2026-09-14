# SPEC-28 — Canvas Editor Interaction UX, Text Ghosting Elimination & Bounding-Box Resize Invariants

> **Independent review applied — 2026-09-14.** This revision incorporates the owner’s raw notes and the as-built Option A implementation. It replaces the original global “disable shrink-to-fit” direction because that would regress SPEC-26’s measured Canvas/Presenter/PPTX parity and runtime overflow safety. The editor and the projected slide have different rendering responsibilities; the distinction is explicit below.

## 1. Problem Statement

Hand testing on `/admin/artifacts` exposed two linked Canvas Editor regressions:

1. **Ghost text.** The editor has an HTML `<ArtifactSlide>` visual layer and a Fabric interaction layer. A Fabric text proxy becomes visible after style edits when a handler writes a real `fill` or `shadow`; the user then sees a second, anti-aliased text run over the DOM one. The current selection/serialization paths also read style from those Fabric paint properties, which makes the defect recur.
2. **Ambiguous text-box sizing.** A box drag changes `liveElements`, which changes the DOM box. `ArtifactSlide` then applies its runtime shrink-to-fit policy, so shrinking a box can visually shrink text despite the authored `fontSize` remaining unchanged. Conversely, a font-size increase can leave a box shorter than the text at scale 1. The current Fabric `Textbox` measurements must not become persisted geometry.

## 2. Review Conclusions and Non-Negotiable Boundaries

### 2.1 Option A remains the architecture

Option A is sound: the DOM `<ArtifactSlide>` is the only visual renderer in the editor, and Fabric is an interaction overlay. Fabric text proxies MAY retain `Textbox` behavior where it is needed for keyboard text editing, but they are not a source of typography, clipping, or persisted geometry.

Every editor text proxy is non-visual for its full lifetime:

```ts
fill: 'transparent'
stroke: 'transparent'
shadow: null
```

The invariant applies at construction, selection synchronization, every toolbar operation, text mutation, object transformation, duplicate/insert, and remount. Do not use `opacity: 0` as a shortcut if it hides or impairs Fabric controls. The DOM visual layer remains visible; the Fabric object carries hit-testing, controls, and metadata only.

`liveElements` is the editor’s visual/style state. A proxy MAY mirror text metadata in `obj.data`, but `syncSelection` and serialization MUST read the style metadata or `liveElements` by `elementId`, never `obj.fill` or `obj.shadow`. In particular, the toolbar must not interpret transparent proxy paint as the selected text color.

### 2.2 Runtime fit and editor resize behavior are deliberately different

`ArtifactSlide` remains the runtime contract used by Presenter, Projector, thumbnails, and the browser side of parity with the PPTX renderer. Its `largestFittingTextScale`, clipping, wrapping, and font-readiness behavior remain unchanged for runtime rendering. `applyFabricTextFit` remains available for non-proxy rendering/parity paths; it MUST NOT be repurposed to mutate an Option A transparent interaction proxy.

The editor visual layer needs an **ephemeral**, editor-only overflow mode:

- default/runtime mode: current shrink-to-fit + clipping behavior;
- editor interaction mode: authored font size (`fitScale = 1`), `white-space: pre-wrap`, and `overflow: hidden` while a layout is being authored.

This mode is passed only from `ArtifactEditor` to its visual layer. It MUST NOT be serialized into a template, the runtime contract, a service snapshot, or a PPTX plan. A manually smaller editor box therefore wraps and clips at the box boundary instead of changing its visual font scale; a projected slide remains protected by the existing runtime fit policy.

### 2.3 Geometry has one coordinate system and one mutation record

All persisted geometry is reference-canvas geometry: `CANVAS_WIDTH = 960`, `CANVAS_HEIGHT = 540`, then converted to percentages only at the layout boundary. CSS pixels and displayed Fabric canvas pixels are never persisted.

Fabric transforms expose a scaled effective height. The minimum must therefore be applied to the **effective** height, not by assigning a minimum directly to `target.height` while `target.scaleY < 1`:

```ts
minSingleLineHeightPx = Math.max(
  fontSizePx,
  fontSizePx * effectiveLineHeight,
);
effectiveHeightPx = target.height * Math.abs(target.scaleY);
```

When the effective height is below the floor, adjust the transform so the effective height equals the floor, preserve the opposite resize edge, then synchronize clip geometry and `liveElements`. On `object:modified`, normalize the effective reference-pixel dimensions into `width`/`height` with `scaleX = scaleY = 1` before recording the intended geometry change. A clamp that changes raw `height` before scale normalization is incorrect: it can still produce a smaller visible box and can make the active control jump.

The one-line floor is a drag floor, not a promise that arbitrary multiline content fits. A text-box drag may wrap and clip content after reaching that floor.

`userResizedHeight` means exactly that the user resized height. Automatic expansion after a toolbar font-size change MUST NOT set it. Record a separate explicit mutation source, for example `heightChange: 'user-resize' | 'font-size-auto'`, and make serialization persist either intentional source. Record changed axes independently: a horizontal-only drag must not mark height as user-resized. Active selections must apply the clamp and intent to every selected text child, not merely the `ActiveSelection` container.

### 2.4 Font-size increase expands for current editor content

A single-line floor alone cannot meet the owner’s “renders immediately at full scale” requirement for wrapped or multiline text. On a font-size increase, calculate the required scale-1 content height for each selected text element at its current authored width, using the same DOM/CSS line-breaking behavior as the editor visual layer. Then persist only an expansion:

```ts
requiredHeightPx = max(minSingleLineHeightPx, measuredContentHeightPx)
nextHeightPx = max(currentEffectiveHeightPx, requiredHeightPx)
```

This is per selected text element. It handles a multi-selection without copying one element’s dimensions to another. A decrease in font size, family/style change, or a later save MUST NOT shrink an already enlarged box. For unresolved runtime placeholders, this guarantees the currently authored editor text only; runtime values retain the established fit-and-clip safety policy.

## 3. User Stories

1. As an administrator changing text color, family, style, shadow, or font size, I see one clean DOM-rendered text run and never a Fabric duplicate.
2. As an administrator shrinking a text box at a fixed font size, I keep that authored visual font size in the editor; the text wraps or clips at the new boundary.
3. As an administrator increasing font size, each selected text box expands only as needed for its current scale-1 content, so its editor preview is immediately readable without manual handle dragging.
4. As an administrator dragging text controls, I cannot collapse a box below a single readable line; I can still make it arbitrarily larger.
5. As an operator, I retain the current runtime fit-and-clip behavior on Presenter, Projector, thumbnails, and PPTX output regardless of how a template was edited.

## 4. Acceptance Criteria

1. After every text toolbar mutation, every selected Fabric text proxy has `fill === 'transparent'`, `stroke === 'transparent'`, and `shadow === null`; the visible color, decoration, and shadow are rendered solely by the DOM layer.
2. Selection synchronization and template serialization preserve the actual text style even though the proxy is transparent and shadowless.
3. In editor interaction mode, shrinking a text box at a fixed font size leaves the DOM fit scale at `1`, wraps with `pre-wrap`, and clips with `overflow: hidden`. It does not change the persisted font size.
4. Runtime `ArtifactSlide` behavior and `applyFabricTextFit` parity behavior remain unchanged for non-editor/projection paths; the existing SPEC-26 parity and clipping tests remain green.
5. A drag cannot lower a text object’s effective reference height below `max(fontSizePx, fontSizePx * effectiveLineHeight)`. Shapes and images are unaffected. The clamp preserves the opposite edge and works for each text object in an active multi-selection.
6. Increasing font size expands, but never contracts, each selected text box to at least its scale-1 current-content height; the expansion survives save/reload. Decreasing font size preserves that expanded geometry.
7. A width-only drag does not create a height-resize intent, and a height auto-expansion does not masquerade as a user resize. Fabric-computed `Textbox` dimensions never overwrite authored layout geometry on save.

## 5. Implementation Plan

### 28-01 — Enforce the transparent proxy invariant

**Files:** `src/lib/registry/canvas-utils.ts`, `src/components/admin/ArtifactEditor.tsx`, targeted tests.

- Centralize creation and reassertion of a text proxy’s non-visual paint properties.
- Remove all toolbar writes of visual `fill`, `stroke`, or `shadow` to Fabric proxies. Write visual style to `liveElements` and proxy metadata instead.
- Make `syncSelection`, duplication, text style application, and serialization resolve style by `elementId`/metadata rather than Fabric paint properties.
- Do not run `applyFabricTextFit` as a typography mutation on transparent proxies. Their geometry must be explicit and independent of Fabric’s `Textbox.initDimensions()` width/height recalculation.

### 28-02 — Split editor overflow behavior from runtime fitting

**Files:** `src/components/admin/ArtifactEditor.tsx`, `src/components/artifacts/ArtifactSlide.tsx` or a narrowly scoped visual-layer adapter, targeted tests.

- Add a non-persisted editor-only render mode to the visual layer. It displays text at authored scale 1 and clips/wraps during editing.
- Keep the current default runtime rendering path unchanged. No new layout field, template JSON field, service-snapshot field, or PPTX worker field is permitted.
- Verify the editor’s DOM layer reflects `liveElements` immediately through a resize and never has a visible Fabric text layer over it.

### 28-03 — Make height constraints and auto-expansion intentional

**Files:** `ArtifactEditor.tsx`, `canvas-utils.ts`, a small pure geometry helper if it makes the clamp testable, targeted tests.

- Calculate the one-line minimum in reference pixels from the effective style; clamp effective, not raw, scaled height; preserve the opposite edge; normalize only after the drag completes.
- Track width and height intent separately and add an explicit font-size-auto height mutation source. Update serialization so it persists only user-resize or font-size-auto geometry, never a Fabric measurement.
- On font-size increase, measure each selected element’s scale-1 current-content height using the editor DOM line-breaking contract, then expand only to the maximum required height. Never contract on a decrease.
- Include `ActiveSelection` children in drag clamping and in font-size expansion.

## 6. Verification and Required Evidence

Add `tests/smoke-spec-28.test.mjs` to the explicit `npm test` script. The test module must include executable checks for all of the following:

1. Mount/change color, family, bold/italic/underline, shadow on/off/blur, font size, duplicate, and remount. Inspect the real Fabric proxy state after each; all remain transparent/shadowless while the DOM style changes. Prove this absence guard red by injecting a visible `fill`, `stroke`, and `shadow` separately, then revert each injection.
2. Resize a text box in the actual editor visual layer and assert editor fit scale remains `1`, wrapping/clipping occur at the resized box, and the runtime `ArtifactSlide` fixture still exercises its fit policy. This prevents accidentally disabling runtime safety while fixing authoring UX.
3. Exercise vertical, horizontal, corner, and active-multiselection drags. Assert effective text height never falls under the floor, the unchanged axis does not gain resize intent, and a shape/image remains unconstrained.
4. Increase font size for a single-line and a wrapping multiline text element; assert each expands to its own required scale-1 height, persists through serialize/save/reload, and does not contract after a font-size decrease.
5. Retain a save-without-edit regression fixture proving Fabric measurement cannot rewrite authored width or height (SPEC-26 / BUG-35).

The source-scan tests in this repository are useful guards but cannot prove visual interaction. Add a browser-harness human/visual smoke deliverable: at `/admin/artifacts`, change the listed styles, shrink and re-expand both a one-line and multiline box, adjust font size up/down, save/reload, and compare the editor against Presenter/Projector. Record the tested template identifiers and viewport in the implementation evidence.

## 7. Out of Scope

- Altering the 16:9 stage wrapper or container-query letterboxing validated by SPEC-26.
- Persisting an editor-specific fit/overflow preference.
- Changing PPTX geometry or the production runtime text-fit policy.
- Replacing the DOM visual layer with Fabric rendering.
