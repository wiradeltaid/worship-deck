---
title: 'Insert image, explicit layer order, and bold/italic on the Registry canvas'
type: 'feature'
created: '2026-08-21'
status: 'done'
baseline_revision: 'f393bfd4274930bb85ebdadeb3f44a252e2f81d7'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '.how/_platform/ARCHITECTURE-SPINE.md'
  - '.what/registry/SRS-registry.md'
  - '.how/registry/SDD-registry.md'
  - '_bmad-output/specs/spec-w3-registry/SPEC.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** The Registry ArtifactEditor canvas can only insert text and rectangle shapes, lacking controls for inserting images, adjusting explicit layer stacking order (`zIndex`), and toggling bold or italic styles for text elements, even though the backend validation and persistence schemas already support `imageRef`, `zIndex`, `fontWeight`, and `fontStyle`.

**Approach:** Add image insertion (reusing the existing upload flow with `POST /api/upload`), layer reordering controls (Move Up / Move Down / Bring to Front / Send to Back with deterministic dense `zIndex` assignment), and bold/italic toggle buttons to `ArtifactEditor.tsx`, while adhering strictly to `validate_artifact.go` allowed keys, omitting default styles to avoid polluting untouched seed layouts, keeping shared image references intact, and providing comprehensive unit tests.

## Boundaries & Constraints

**Always:**
- Persist only keys that exist in `allowedElementKeys` (`id`, `type`, `required`, `x`, `y`, `w`, `h`, `zIndex`, `content`, `placeholderKey`, `imageRef`, `style`) and `allowedStyleKeys` (`fontFamily`, `fontSize`, `fontColor`, `fontWeight`, `fontStyle`, `textAlign`, `verticalAlign`, `objectFit`, `fillColor`, `opacity`) in `internal/plan/validate_artifact.go`.
- Adhere to `serializeTextStyle`'s `setIfMeaningful` discipline: `fontStyle` and `fontWeight` MUST only be written when explicitly set/modified off construction defaults, and NEVER written as undefined or unconditionally written to untouched seed layouts.
- Maintain dense, deterministic `zIndex` integer ordering (no duplicates or gaps) across all elements, reconciling Fabric canvas object order with serialized payload element order.
- Delete operations on canvas image elements must only remove the element reference from the layout definition; deleting an element MUST NEVER delete the referenced file on disk or call delete upload endpoints.
- Ensure all newly introduced user-facing strings are keyed and translated in `src/lib/i18n/keys.ts`, `src/lib/i18n/catalogue-en.ts`, and `src/lib/i18n/catalogue-id.ts`.
- Retain existing `ArtifactEditor.tsx` dirty-guard contracts, unsaved changes confirmation prompts, and adapter contracts.

**Block If:**
- Persisting any new style key not present in `internal/plan/validate_artifact.go` is requested (e.g., `textDecoration` / underline).
- Any requirement arises to alter backend schema or delete underlying uploads on element removal.

**Never:**
- Never add underline controls (`textDecoration` is absent from Go validator `allowedStyleKeys`).
- Never delete uploaded image files when deleting an image element or template.
- Never write `fontStyle` unconditionally or bake default font styles into untouched seed elements.
- Never import or use raw/unregistered UI controls outside shadcn / project conventions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Insert Image | Admin clicks Add Image / uploads image file or provides existing upload URL | New `image` element added to canvas with valid `imageRef`, centered/cascaded position, highest `zIndex`, marked dirty | Displays error toast if upload request fails; canvas remains untouched |
| Layer Reorder (Move Up / Down / Top / Bottom) | Admin selects element and clicks layer reorder action | Canvas object stacking adjusts immediately in Fabric and updates dense integer `zIndex` (0..N-1) across elements, marking editor dirty | Action disabled if no element selected or element already at boundary |
| Bold / Italic Toggle | Admin selects text element and toggles Bold (`fontWeight: 'bold'` vs `'normal'`) or Italic (`fontStyle: 'italic'` vs `'normal'`) | Fabric text object updates immediately, `serializeTextStyle` writes `fontWeight` / `fontStyle` only if meaningful, marks dirty | Disabled when selected element is not text |
| Untouched Seed Layout Save | Admin opens a seed layout without bold/italic and saves without modifying text styles | Serialized payload contains no newly introduced `fontWeight` or `fontStyle` keys | Normal save flow |

</intent-contract>

## Code Map

- `src/components/admin/ArtifactEditor.tsx` -- Main canvas editor component: insert element toolbar, layer reordering handlers & UI controls, bold/italic text styling controls, canvas object to Fabric mapping (`elementToFabricObject`), text serialization (`serializeTextStyle`), and canvas serialization (`serializeCanvas`).
- `internal/plan/validate_artifact.go` -- Authoritative Go validation rules (`allowedElementKeys`, `allowedStyleKeys`). Read-only reference for valid keys.
- `src/lib/i18n/keys.ts` -- i18n key registry for new button labels, tooltips, and hints.
- `src/lib/i18n/catalogue-en.ts` -- English strings for new artifact editor controls.
- `src/lib/i18n/catalogue-id.ts` -- Indonesian strings for new artifact editor controls.
- `tests/canvas-dirty-guard.test.mjs` -- AST and behavioral assertions for editor dirty tracking and guard invariants.
- `tests/copy-paste-share-by-reference.test.mjs` -- Invariant checks verifying image reference preservation and non-deletion of files.
- `tests/artifact-editor-controls.test.mjs` -- New unit test suite verifying image element insertion, layer ordering dense zIndex logic, and bold/italic conditional serialization.
- `package.json` -- Test runner script registration for new test files.

## Tasks & Acceptance

**Execution:**
- `src/lib/i18n/keys.ts` -- Add translation keys for Add Image, Layer Reorder (Bring Forward, Send Backward, Bring to Front, Send to Back), Bold, and Italic controls. -- Ensure UI internationalization completeness.
- `src/lib/i18n/catalogue-en.ts` -- Provide English translations for all new artifact editor keys. -- Fulfill i18n contract.
- `src/lib/i18n/catalogue-id.ts` -- Provide Indonesian translations for all new artifact editor keys. -- Fulfill i18n contract.
- `src/components/admin/ArtifactEditor.tsx` -- Implement image element insertion with file upload modal/trigger, layer reordering logic ensuring dense `zIndex` assignment (0..N-1), and bold/italic toggle buttons integrated with `serializeTextStyle`. -- Fulfill CAP-9/DEC-004 requirements.
- `tests/artifact-editor-controls.test.mjs` -- Add automated test suite validating image element insertion, dense layer `zIndex` ordering, conditional `fontStyle`/`fontWeight` serialization, and non-destruction of untouched seed styles. -- Verify implementation invariants and edge cases.
- `package.json` -- Register `tests/artifact-editor-controls.test.mjs` in the `scripts.test` list. -- Ensure new tests are executed in `npm test` and CI.

**Acceptance Criteria:**
- Given an Admin on the Artifact Editor with an editable template, when they insert an image, then an image element with valid `imageRef` appears on canvas, assigned the highest `zIndex`, and marks the canvas dirty.
- Given an Admin with an element selected, when they click Bring Forward, Send Backward, Bring to Front, or Send to Back, then the element's visual stack position updates in Fabric and its serialized `zIndex` is densely and deterministically recomputed without duplicates or gaps.
- Given an Admin with a text element selected, when they toggle Bold or Italic and save, then `fontWeight: 'bold'` or `fontStyle: 'italic'` is serialized and accepted by `validate_artifact.go`.
- Given an Admin opening a seed template with default styles, when they save without touching bold/italic, then the serialized output introduces no new `fontWeight` or `fontStyle` keys.
- Given a layout containing an image element, when the Admin deletes the element from the canvas, then the image element is removed from the layout definition and the uploaded file at `imageRef` remains intact.
- Given a seed template whose stored `zIndex` values are not dense (e.g. `[1, 1, 1]`), when the Admin opens it and saves without moving or reordering anything, then the serialized `zIndex` values are byte-identical to the stored ones.

## Spec Change Log

### 2026-08-21 — coordinator review, return trip 1

**Finding (must-fix): serializing `zIndex: canvasIndex` unconditionally rewrites 40 seed layouts on any save.**

`serializeCanvas` now writes `zIndex: canvasIndex` on every element. At HEAD it wrote no `zIndex` at
all — it carried the stored value through `...source`, and the comment above it said why in as many
words: *"the stored array keeps template order so that `hydrate`'s source-order tie-break — and diffs
against the seed — stay put."* That comment was removed with the change.

`data/default-registry.json` has **40 layouts whose `zIndex` is not already dense `0..N-1`** —
`[1, 1, 1]`, `[1]`, `[0, 0, 1, 1]` and so on. Opening any of them and pressing Save, touching nothing,
now renumbers them. Rendering is unaffected (the canvas is built sorted by `zIndex` with a source-order
tie-break, so relative order survives), but the payload is silently mutated, which is exactly the class
of change AC-04 exists to prevent — AC-04 guards `fontWeight` and `fontStyle` and nothing guarded this.
`tests/registry-seed-conformance.test.mjs` passes throughout, so it does not cover it either.

**Required fix.** Apply the same `setIfMeaningful` discipline to `zIndex` that already governs the
style keys: persist a new `zIndex` only when the operator actually reordered something. When the
canvas order already agrees with the stored ordering's rank, carry the stored value through untouched.
Reordering MUST still persist — that is AC-02 — so the test for AC-02 must keep passing.

**New acceptance criterion, AC-06.** Given a seed template whose stored `zIndex` values are not dense
(use one of the 40, e.g. a layout with `[1, 1, 1]`), when the Admin opens it and saves without moving
or reordering anything, then the serialized `zIndex` values are byte-identical to the stored ones.
This test MUST be seen to fail against the current implementation before the fix, and the failure
reported.

Also restore the removed comment (wherever the serialize logic now lives) so the next agent learns the
invariant from the code rather than from this log.

### 2026-08-21 — coordinator review, return trip 2 (found by the edge-case lens during wdi-review)

**Finding (must-fix): inserting an element renumbers every `zIndex` in the layout, including the 40
non-dense seed layouts.**

Return trip 1 made `zIndex` conditional, and AC-06 pins the case it was written for: a seed layout
saved without moving or reordering anything keeps its stored values. But the condition is

```
const isOrderModified = hasReorderedExisting || hasAddedElements;
```

so **adding** an element — the insert-image control this very story shipped, or Add text, or Add
rectangle — sets `isOrderModified` and every element in the layout is rewritten to `zIndex: canvasIndex`.
Insert one image into any of the 40 layouts whose stored `zIndex` is `[1,1,1]` or `[0,0,1,1]` and all of
them are renumbered. Same silent seed mutation as return trip 1, reached through a different trigger,
and AC-06 does not cover it because AC-06 only exercises the untouched-save path.

This is also a regression against HEAD, which assigned a new element `maxZ + 1` and left every existing
element's `zIndex` alone.

**Required fix.** An insert MUST NOT renumber siblings. A newly added element takes a `zIndex` above the
current maximum; existing elements keep their stored values. Renumbering stays reserved for an actual
reorder of existing elements — `hasReorderedExisting` — which is the only case where the stored values
genuinely no longer describe the order.

**New acceptance criterion, AC-07.** Given a seed template whose stored `zIndex` values are not dense
(one of the 40, e.g. `[1, 1, 1]`), when the Admin inserts an image, a text box, or a shape and saves
without reordering anything, then every pre-existing element keeps its stored `zIndex` byte-identical and
the new element carries a `zIndex` above the previous maximum. Exercise **all three** insert controls —
a guard that probes only the image path does not cover the set this story shipped.

Confirm AC-07 fails against the current implementation before fixing it, and report that failure output.
AC-02 (reordering persists) and AC-06 (untouched save preserves) MUST both stay green.

## Review Triage Log

### 2026-08-21 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 0, low 2)
- defer: 0
- reject: 10
- addressed_findings:
  - `[low]` `[patch]` Reset status to idle on unmounted canvas during image insertion in `src/components/admin/ArtifactEditor.tsx:632`
  - `[low]` `[patch]` Memoize bold and italic toggle handlers with useCallback in `src/components/admin/ArtifactEditor.tsx:915`

### 2026-08-21 — Return trip 1 review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1: (high 0, medium 0, low 1)
- defer: 0
- reject: 12
- addressed_findings:
  - `[low]` `[patch]` Guard initialOrder against surviving element subset to prevent false-positive reorder detection during element deletion in `src/lib/registry/canvas-utils.ts:183`

## Auto Run Result

### Summary of implemented change
- Implemented image element insertion on the Registry canvas editor using the existing `POST /api/upload` endpoint.
- Implemented layer reordering controls (`Bring Forward`, `Send Backward`, `Bring to Front`, `Send to Back`) in `ArtifactEditor.tsx` with dense deterministic integer `zIndex` assignment (`0..N-1`) preserved upon serialization.
- Added Bold and Italic toggle buttons in the editor text styling toolbar adhering strictly to `serializeTextStyle`'s `setIfMeaningful` discipline, ensuring untouched seed layouts do not introduce superfluous style keys.
- Implemented `setIfMeaningful` discipline for `zIndex` in `serializeCanvas`: preserves stored `zIndex` on untouched seed layouts and only writes renumbered `zIndex` when elements were added or reordered (fulfilling AC-06).
- Restored invariant documentation comment in `serializeCanvas`.
- Added full i18n translation keys in English and Indonesian across `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`.
- Added unit and invariant test suite in `tests/artifact-editor-controls.test.mjs` including AC-06 test coverage and registered it in `package.json`.

### Files changed
- `src/components/admin/ArtifactEditor.tsx`: Added image upload input/handlers, layer reordering buttons and dispatchers, bold/italic toolbar controls and state handlers.
- `src/lib/registry/canvas-utils.ts`: Extracted canvas utilities, pure `serializeCanvas` with `setIfMeaningful` `zIndex` discipline, `serializeTextStyle`, and coordinate helpers for modular testability.
- `src/lib/registry/canvas-adapters.ts`: Exported `uploadImageFile` helper for artifact image uploads.
- `src/lib/i18n/keys.ts`: Registered new translation keys for artifact editor canvas controls.
- `src/lib/i18n/catalogue-en.ts`: Added English translations for artifact editor canvas controls.
- `src/lib/i18n/catalogue-id.ts`: Added Indonesian translations for artifact editor canvas controls.
- `tests/artifact-editor-controls.test.mjs`: Test suite covering image insertion, dense zIndex reordering, conditional bold/italic serialization, AC-06 non-dense zIndex preservation, and validator conformance.
- `package.json`: Registered `tests/artifact-editor-controls.test.mjs` in the `npm test` script.

### Review findings breakdown
- Patches applied: 1 (low severity: surviving element subset alignment in `serializeCanvas`).
- Items deferred: 0.
- Items rejected: 12 (out-of-scope feature additions or noise).

### Follow-up review recommendation
- Count: 0 high, 0 medium, 1 low (score: 1 < 5).
- Recommendation: `false`.

### Verification performed
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/artifact-editor-controls.test.mjs` (PASSED - 5/5)
- `npm test` (PASSED - 630/630)
- `npm run spa:build` (PASSED)

### Residual risks
- None.

## Design Notes

1. **Dense zIndex Management & setIfMeaningful Discipline:**
When moving an element up or down in the stack:
- Fabric canvas object order is adjusted using `canvas.bringObjectForward(obj)`, `canvas.sendObjectBackwards(obj)`, `canvas.bringObjectToFront(obj)`, or `canvas.sendObjectToBack(obj)`.
- In `serializeCanvas`, `zIndex` retains the stored element `zIndex` untouched unless elements were added or the relative ordering of surviving elements changed. When modified, dense contiguous indices `0..N-1` are written.

2. **Conditional Style Serialization:**
`serializeTextStyle` already enforces:
```ts
setIfMeaningful('fontWeight', textObj.fontWeight === undefined ? undefined : String(textObj.fontWeight), 'normal');
setIfMeaningful('fontStyle', textObj.fontStyle, 'normal');
```
We preserve this exact pattern so setting to 'normal' or leaving unset does not serialize superfluous style keys on seed layouts.

3. **Image Insertion UX:**
A hidden file input or dialog triggers file selection, uploads via `POST /api/upload`, and upon receiving `{ url }`, creates an element:
```ts
{
  id,
  type: 'image',
  required: false,
  x, y, w, h,
  zIndex: maxZ + 1,
  imageRef: url
}
```

## Verification

**Commands:**
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/canvas-dirty-guard.test.mjs` -- expected: all dirty guard AST checks pass
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/i18n.test.mjs` -- expected: all i18n keys and translations align
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/copy-paste-share-by-reference.test.mjs` -- expected: share by reference and deletion tests pass
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/artifact-editor-controls.test.mjs` -- expected: new canvas control tests pass
- `npm test` -- expected: entire project test suite passes
