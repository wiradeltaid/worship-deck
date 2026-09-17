# TEST-PLAN — SPEC-20 Artifacts Canvas WYSIWYG Auto-Sync & Controls Refinement

This test plan defines the automated and manual verification suites for SPEC-20 under WDI Method TDD standards.

---

## 1. Automated Test Suite (`tests/smoke-spec-20.test.mjs`)

A dedicated smoke and regression test suite will run via Node's native test runner (`node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/smoke-spec-20.test.mjs`).

### Test Case Matrix

| ID | Target Ticket | Scenario | Assertion |
|---|---|---|---|
| **T-20-01** | SPEC-20-01 | Font Picker Combobox Structure | `ArtifactEditor.tsx` renders Font Family selector using `Popover`, `PopoverTrigger`, and `PopoverContent`, with `side="bottom"` and `align="start"`. |
| **T-20-02** | SPEC-20-01 | Keyboard Input Isolation | Search input in font popover is NOT wrapped by Base UI `SelectPrimitive.List`, preventing native listbox typeahead focus hijacking. |
| **T-20-03** | SPEC-20-01 | Dynamic Font Catalog Filtering | Input text query correctly filters font entries across categories (`system`, `sans`, `serif`, `display`, `script`). |
| **T-20-04** | SPEC-20-02 | Canvas Drawing Mouse Move Handler | `ArtifactEditor.tsx` registers a `mouse:move` listener on canvas when `drawingTool` is active. |
| **T-20-05** | SPEC-20-02 | Temporary Preview Rubberband Lifecycle | Instantiates temporary dashed Fabric object on `mouse:down`, resizes on `mouse:move`, and cleanly removes on `mouse:up` or Escape cancellation. |
| **T-20-06** | SPEC-20-03 | Non-Canvas 16:9 Stage Viewport | When `isEditable === false` (`song-set-entry`, `ann-set-marker`), an `aspect-video` placeholder card renders in place of a collapsed banner. |
| **T-20-07** | SPEC-20-03 | Layout Stability & Deck Sequence Height | Deck Sequence sidebar container retains stable height without collapsing or jumping when toggling between canvas and non-canvas slides. |
| **T-20-08** | SPEC-20-04 | `serializeCanvas` Textbox Auto-Height Sync | For `type === 'text'`, `serializeCanvas` saves `h = Math.max(source.h, pxToPct(measuredHeight, CANVAS_HEIGHT))`, expanding box height to fit rendered text lines. |
| **T-20-09** | SPEC-20-04 | Boundary Clamping for Auto-Synced Textbox | Auto-synced `h` is clamped to ensure `y + h <= 100` so elements never spill out of slide bounds. |
| **T-20-10** | SPEC-20-04 | Presentation Fit Parity (`largestFittingTextScale = 1.0`) | An element saved with auto-synced `h` yields `fitsAt(1.0) === true` in `ArtifactSlide.tsx`, eliminating unwanted auto-shrink. |
| **T-20-11** | SPEC-20-04 | PPTX Text Scale Parity (`estimateTextFitScale = 1.0`) | PPTX export text fit estimation returns `1.0` when bounding box height matches rendered text dimensions. |
| **T-20-12** | SPEC-20-04 | Textbox Horizontal Width Expansion / Clamping | When `measuredWidth > authoredWidth`, `serializeCanvas` auto-syncs `w` clamped to `100 - next.x` so single-word overflows do not cause horizontal clipping. |
| **T-20-13** | Regression | Regression Tests Migration & Invariants | `tests/smoke-spec-19.test.mjs` and `tests/artifact-editor-layout.test.mjs` pass without regressions following Popover and auto-sync migration. |

---

## 2. Regression & Test Migration Matrix

Because SPEC-20 deliberately refactors the Font Selector from Base UI Select to Popover and supersedes the manual overflow warning badge with automatic height synchronization, the following regression tests and documentation must be updated during autopilot execution:

### 2.1 Test Refactoring Tasks

| File | Target Section | Current Assertion | Updated SPEC-20 Assertion |
|---|---|---|---|
| `tests/smoke-spec-19.test.mjs` | Lines 247–270 (`SPEC-19-05`) | Checks for `⚠️ Text exceeds box bounds; presentation and PPTX will auto-shrink text to fit.` in `ArtifactEditor.tsx` and `.how/registry/06-flows/canvas-authoring-controls.md`. | Retains the core 0.75 pt/px math equivalence invariants (37.5pt = 50px, 9.259% height fraction), but updates the badge check to verify that SPEC-20 replaced the manual overflow badge with automatic bounding box synchronization (`serializeCanvas` auto-sync). |
| `tests/artifact-editor-layout.test.mjs` | Lines 278–285 (Item 4b) | Checks for `alignItemWithTrigger={false}`, `side="bottom"`, and `align="start"`. | Updates font dropdown positioning checks for Popover: asserts `PopoverContent` has `side="bottom"` and `align="start"`. |
| `.how/registry/06-flows/canvas-authoring-controls.md` | § Canvas overflow feedback | Documents manual badge warning instructing operator to manually resize textboxes. | Updates explanation: textboxes automatically calculate and synchronize `h` to encompass rendered text lines upon save, eliminating manual resizing friction. |

### 2.2 Suite Execution Commands

Every test run must pass the full suite:

1. **New SPEC-20 Smoke Suite**:
   ```bash
   node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/smoke-spec-20.test.mjs
   ```
2. **Prior Smoke Regressions (SPEC-19, SPEC-18, etc.)**:
   ```bash
   node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/smoke-spec-19.test.mjs
   node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/smoke-spec-18.test.mjs
   ```
3. **Public Repo Guard**:
   ```bash
   node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/public-repo-guard.test.mjs
   ```
4. **Layout & Controls Regression**:
   ```bash
   node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/artifact-editor-layout.test.mjs
   node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/artifact-editor-controls.test.mjs
   ```
5. **Full Test Suite**:
   ```bash
   npm test
   ```

---

## 3. Manual Verification Checklist (Dev Environment)

1. **Font Search Combobox (SPEC-20-01)**:
   - [ ] Open `/admin/artifacts` and select a text element.
   - [ ] Click the Font Family trigger; verify popover anchors neatly directly below the trigger.
   - [ ] Type "mont" or "arial" into the search box. Verify all characters, including spacebar and backspace, type naturally without focus jumping or popover closing.
   - [ ] Verify font list filters instantly.
   - [ ] Click a font from the list; verify it immediately applies to the selected canvas text and popover closes cleanly.

2. **Drag-to-Draw Live Rubberband (SPEC-20-02)**:
   - [ ] Click the Add Rectangle ("Square") button on toolbar row 1.
   - [ ] Click and drag across the canvas; verify a live dashed rectangle expands in real-time under the cursor.
   - [ ] Release the mouse; verify the permanent shape is created at that exact size and position with no lingering dashed lines.
   - [ ] Repeat with the Add Text ("T") tool; verify dashed text bounding frame follows drag.
   - [ ] Start dragging and press Escape; verify preview is cancelled immediately.

3. **Stage Layout Stability (SPEC-20-03)**:
   - [ ] In the Deck Sequence list, click between a General Slide and a Song Set entry.
   - [ ] Verify the left Deck Sequence sidebar maintains a steady, fixed height without jumping or shrinking.
   - [ ] Verify the right column displays an aspect-video 16:9 stage card explaining that song lyrics are dynamically loaded from Song Registry.
   - [ ] Verify no second window scrollbar appears.

4. **True WYSIWYG Auto-Height & Auto-Shrink Parity (SPEC-20-04)**:
   - [ ] Create a text element with font size 60px or 100px. Notice no manual stretching of box handles is required and no warning badge appears.
   - [ ] Click Save to save the slide.
   - [ ] Open Presentation View (`/presenter`) or download PPTX deck.
   - [ ] Verify text renders at full authored scale, matching the canvas visual design 100% without unexpected font shrinking.
