# SPEC-24-02 — Reset Healing Ref on User Interactions

**Status:** open

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `src/components/admin/ArtifactEditor.tsx`
- **Tests**: `tests/smoke-spec-24.test.mjs` (T-24-03)
- **Blocked by**: SPEC-24-01

## Context

In `ArtifactEditor.tsx`, `isHealingOnlyRef.current` was set to `true` on mount when unmeasured elements were found.
However, there was no code anywhere in `ArtifactEditor.tsx` to reset `isHealingOnlyRef.current = false` when an operator
interacted with the canvas.
As a result, when an operator moved an element, edited text, changed font styles, added an element, or reordered layers,
`isHealingOnlyRef.current` remained `true`. On clicking "Save", `handleSave` passed `{ isHealingSave: true }` to
`serializeCanvas`, tricking the serializer into treating a manual user edit as a background healing pass (BUG-32).

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Atomic User Mutation Guard.** Create a centralized helper `markUserDirty()` in `ArtifactEditor.tsx` that:
   - Calls `markDirty()` to transition the editor form state to dirty.
   - Clears `isHealingOnlyRef.current = false` immediately.
2. **Hook Canvas Mutation Events.** Ensure all Fabric canvas mutation listeners invoke `markUserDirty()`:
   - `object:modified`
   - `object:moving`
   - `object:scaling`
   - `object:resizing`
   - `text:changed`
   - All events in `CANVAS_MUTATION_EVENTS`
3. **Hook Direct Editor Actions.** Ensure all direct handler functions in `ArtifactEditor.tsx` reset
   `isHealingOnlyRef.current = false`:
   - `handleTextContentChange`
   - `applyTextStyle`
   - `handleFontSizeInput`
   - `handleFontColorChange`
   - `handleToggleBold`, `handleToggleItalic`, `handleToggleUnderline`
   - `handleLineHeightChange`, `handleToggleTextShadow`
   - `handleAddElement`
   - `handleDeleteSelected`
   - `handleBringForward`, `handleSendBackward`, `handleSendToBack`, `handleBringToFront`
   - Background replacement / image update handlers
4. **Invariant.** If the operator has altered any visual property or coordinate on the canvas, `handleSave`
   MUST NOT pass `{ isHealingSave: true }`.
