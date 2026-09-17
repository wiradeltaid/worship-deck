# SPEC-24 — Canvas Healing Dirty-State & Persistence Isolation

> **Relationship to SPEC-23**: SPEC-23 shipped web font readiness, wrap slack, width-aware fit estimation,
> OOXML soft breaks, and automated measurement healing on mount (SPEC-23-05). Owner UAT on `presenter-dev.bic.my.id`
> (2026-09-11) identified two critical defects introduced by the healing mechanism:
> 1. Switching slides in the left sidebar continuously triggers unsaved-changes confirmation dialogs on clean slides.
> 2. Saving user canvas edits fails to persist; elements repeatedly snap back to their initial positions.
> SPEC-23's font and wrap math remains valid. This specification isolates background measurement healing from
> user dirty state and eliminates destructive property overwrites in serialization.

---

## 1. Problem Statement

### 1.1 Observed Defects (Owner UAT, 2026-09-11, Dev Environment)

**Defect 1 — Slide Navigation Blocked by Spurious Dirty State**
- When opening any slide in the editor (`Deck Sequence`, `Song Sets`, or `Announcement Sets`), the header status
  immediately flags unsaved changes.
- Clicking any other slide in the sidebar triggers the navigation guard dialog:
  `"You have unsaved changes to this template. Switching to another template will discard them. Continue?"`
- The operator is blocked on every slide switch despite not performing any edit on the canvas.

**Defect 2 — Canvas Edits Revert to Initial Position on Save**
- When an operator drags an element to a new coordinate, alters text content, resizes a box, or changes typography
  styles, and then clicks **Save** (`Simpan`):
  - The save operation completes, but the changes are not persisted to the database.
  - The canvas reloads the template response and elements visually snap back to their original positions and content.
  - Subsequent edits continue to snap back repeatedly.

---

### 1.2 Root Cause Analysis

Systematic debugging traced both issues to two tightly coupled flaws in `src/components/admin/ArtifactEditor.tsx`
and `src/lib/registry/canvas-utils.ts`.

#### Flaw A — Premature `markDirty()` on Canvas Mount (`ArtifactEditor.tsx:834-842`)
```tsx
// SPEC-23-05: Healing pass on open.
const hasUnmeasured = layout.elements.some(isElementUnmeasured);
if (hasUnmeasured) {
  markDirty();
  isHealingOnlyRef.current = true;
}
```
1. All templates currently stored in the database are legacy templates that lack SPEC-23 measurement fields
   (`longestWordPx`, `wrapLines`, `measuredWith`).
2. `isElementUnmeasured(el)` evaluates to `true` for every legacy text element.
3. As a result, `hasUnmeasured` is `true` on the first render of virtually every slide, immediately invoking
   `markDirty()`.
4. `isDirty` becomes `true` before any operator interaction.
5. In sidebar slide lists, item clicks are guarded by:
   ```tsx
   const proceed = mayDiscard(
     isDirty && isEditable,
     DISCARD_ON_SWITCH_CONFIRMATION,
     (message) => window.confirm(message)
   );
   if (!proceed) return;
   ```
   Because `isDirty` is unconditionally `true`, `mayDiscard` interrupts every slide switch.

#### Flaw B — Sticky `isHealingOnlyRef` in `ArtifactEditor.tsx`
`isHealingOnlyRef.current` was set to `true` on mount when `hasUnmeasured` was detected.
However, **no user interaction handlers** (`object:modified`, `object:moving`, `object:scaling`, `text:changed`,
`applyTextStyle`, `setFontFamily`, `setFontSize`, `setFontColor`, `handleToggleBold`, `handleToggleItalic`,
`handleAddElement`, `handleDeleteSelected`, `handleBringForward`, etc.) reset `isHealingOnlyRef.current` back to `false`.
When the user clicked "Save", `handleSave` evaluated `const isHealingSave = isHealingOnlyRef.current` (which remained `true`)
and forwarded `{ isHealingSave: true }` to `serializeCanvas`.

#### Flaw C — Destructive Healing Overwrite in `serializeCanvas` (`canvas-utils.ts:387-453`)
`serializeCanvas` implemented `isHealingSave` by forcefully reverting coordinates, content, and styles to `source.*`:
```ts
const computedX = isHealing || left === authoredLeft ? source.x : pxToPct(left, CANVAS_WIDTH);
const computedY = isHealing || top === authoredTop ? source.y : pxToPct(top, CANVAS_HEIGHT);

if (isText) {
  if (isHealing) {
    if (source.content !== undefined) next.content = source.content; // Edits discarded!
  }
  if (isHealing) {
    if (source.style) next.style = { ...source.style }; // Styles discarded!
  }
}
```
Maksud asal SPEC-23-05 Req 3 hanya membatasi agar healing otomatis tidak memicu pemekaran tinggi `h` secara liar
(`Math.max(source.h, measuredTextHeightPct)`) dan tidak mengacak `zIndex`. Implementasi yang terpasang justru
menimpa seluruh posisi `x`, `y`, isi `content`, dan format `style` kembali ke data `source` yang lama.
Data lama inilah yang dikirim ke backend Go dan disimpan ke database. Setelah server merespons, `setTemplate(data)`
memuat kembali data lama tersebut sehingga elemen melompat kembali ke posisi awal.

---

## 2. Technical Solution & Architecture

```
+---------------------------------------------------------------------------------------+
|                                    ArtifactEditor                                     |
|                                                                                       |
|   1. Mount Canvas / Open Template                                                     |
|      - Run measurement checks & cache in memory.                                      |
|      - DO NOT call markDirty().                                                       |
|      - isDirty stays FALSE -> Slide switching clean (No dialog!).                     |
|                                                                                       |
|   2. User Interactions (Drag, Resize, Type Text, Change Font/Color, Add, Delete)       |
|      - Call markDirty() (isDirty -> TRUE).                                            |
|      - IMMEDIATELY set isHealingOnlyRef.current = FALSE.                              |
|                                                                                       |
|   3. Click "Save" (handleSave)                                                        |
|      - Passes options: { isHealingSave: isHealingOnlyRef.current }.                   |
|      - If user touched anything, isHealingSave is FALSE.                              |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            v
+---------------------------------------------------------------------------------------+
|                               serializeCanvas (canvas-utils)                          |
|                                                                                       |
|   - Respects user coordinates:                                                        |
|     computedX = pxToPct(left, CANVAS_WIDTH)                                           |
|     computedY = pxToPct(top, CANVAS_HEIGHT)                                           |
|   - Respects user text & styles:                                                      |
|     next.content = obj.text                                                           |
|     next.style = serializeTextStyle(...)                                              |
|   - isHealingSave: true ONLY guards:                                                  |
|     1. Preserves source.h if not manually resized.                                    |
|     2. Preserves source.zIndex if layers were not reordered.                          |
|     3. Applies wrap slack to w and stamps longestWordPx, wrapLines, measuredWith.     |
+---------------------------------------------------------------------------------------+
```

### 2.1 Decouple Healing from Form Dirty State (BUG-31)
1. In `ArtifactEditor.tsx` `mountCanvas`, remove `markDirty()` from the unmeasured element check.
2. Opening an unmeasured template MUST leave `isDirty: false`. Operators browsing through slides MUST NOT be
   prompted to discard changes when switching slides.
3. Measurement fields calculated on mount are held in memory. If the operator makes an edit and saves, those
   measurements are serialized naturally alongside the user's edits.
4. If an admin wishes to batch-heal all unmeasured templates in the database without manually editing them,
   they use the dedicated **Re-measure all** (`admin.artifacts.remeasureAll`) action button in the toolbar.

### 2.2 Reset Healing Flag on Any User Mutation (BUG-32 Part 1)
1. Ensure `isHealingOnlyRef.current` is cleared to `false` whenever any user interaction occurs:
   - Canvas Fabric events: `object:modified`, `object:moving`, `object:scaling`, `object:resizing`, `text:changed`.
   - Direct handler calls: `handleTextContentChange`, `applyTextStyle`, `handleFontSizeInput`,
     `handleFontColorChange`, `handleToggleBold`, `handleToggleItalic`, `handleToggleUnderline`, `handleLineHeightChange`,
     `handleToggleTextShadow`, `handleAddElement`, `handleDeleteSelected`, `handleBringForward`, `handleSendBackward`,
     `handleSendToBack`, `handleBringToFront`, and background replacements.
2. A single utility helper or event hook `markUserDirty()` in `ArtifactEditor.tsx` guarantees that marking dirty
   and resetting `isHealingOnlyRef.current = false` happen atomically.

### 2.3 Non-Destructive Canvas Serialization in `canvas-utils.ts` (BUG-32 Part 2)
1. `serializeCanvas` MUST NEVER revert an element's position `x` or `y` if `left !== authoredLeft` or
   `top !== authoredTop`.
2. `serializeCanvas` MUST NEVER discard edited `content` or `style`.
3. In `serializeCanvas`, `isHealingSave: true` is strictly restricted to:
   - Preventing un-resized text boxes from expanding `h` to Fabric's measured height (keeping `source.h`).
   - Retaining `source.zIndex` unless layer reordering occurred.
   - Enabling wrap slack widening on `w` and capturing `longestWordPx`, `wrapLines`, and `measuredWith`.

---

## 3. Scope & Ticket Breakdown

| Ticket | Component | Summary | Target Files |
|---|---|---|---|
| **SPEC-24-01** | `registry` | Decouple background healing from navigation guard & dirty state | `src/components/admin/ArtifactEditor.tsx` |
| **SPEC-24-02** | `registry` | Reset healing flag on all user interactions & mutations | `src/components/admin/ArtifactEditor.tsx` |
| **SPEC-24-03** | `registry` | Non-destructive serialization for healing saves in `serializeCanvas` | `src/lib/registry/canvas-utils.ts` |
| **SPEC-24-04** | `registry` | Regression test suite, absence guards & automated verification | `tests/smoke-spec-24.test.mjs`, `tests/artifact-editor-controls.test.mjs` |

---

## 4. Acceptance Criteria & Invariants

1. **AC 1 (Seamless Navigation)**: Opening any legacy or unmeasured template does not trigger `markDirty()`. Clicking
   between slides in `Deck Sequence`, `Song Sets`, and `Announcement Sets` switches slides immediately with zero
   `window.confirm` dialogs.
2. **AC 2 (Persistent Positioning)**: Dragging any element on the canvas and clicking Save persists the new `x` and `y`
   coordinates in the database. When the template reloads after save, elements remain at their new positions and do not
   snap back.
3. **AC 3 (Persistent Content & Styling)**: Editing text content, font family, font size, color, or styles and clicking
   Save persists the changes faithfully.
4. **AC 4 (Non-Destructive Healing Invariant)**: Calling `serializeCanvas` with `{ isHealingSave: true }` writes
   `longestWordPx`, `wrapLines`, and `measuredWith`, while keeping `h` and `zIndex` stable, and MUST NOT discard
   modified coordinates or content.
5. **AC 5 (Absence Guard Proofs)**: Test suite proves via defect injection that spurious dirtying on mount and coordinate
   overwrites in `serializeCanvas` fail the test suite red before being restored.
