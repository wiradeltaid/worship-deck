# SPEC-24-01 — Decouple Background Healing from Navigation Guard

**Status:** open

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `src/components/admin/ArtifactEditor.tsx`
- **Tests**: `tests/smoke-spec-24.test.mjs` (T-24-01, T-24-02, T-24-07)
- **Blocked by**: —

## Context

In SPEC-23-05, a healing pass was added to `mountCanvas` in `ArtifactEditor.tsx`. If any text element lacked
`longestWordPx`, `wrapLines`, or `measuredWith`, it invoked `markDirty()`:
```tsx
const hasUnmeasured = layout.elements.some(isElementUnmeasured);
if (hasUnmeasured) {
  markDirty();
  isHealingOnlyRef.current = true;
}
```
Because legacy templates in the database initially lack these fields, `hasUnmeasured` is `true` for nearly all slides.
Calling `markDirty()` on load marks the form dirty before any user action. Consequently, whenever the user clicks another
slide in the sidebar, `mayDiscard(isDirty && isEditable)` intercepts navigation and prompts the operator to confirm
discarding changes on every single slide change (BUG-31).

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Remove `markDirty()` from the unmeasured template mount path.** In `ArtifactEditor.tsx`, inspecting `layout.elements`
   with `isElementUnmeasured` MUST NOT invoke `markDirty()`.
2. **Preserve Clean Navigation State.** Loading and viewing an unmeasured template MUST leave `isDirty: false`. Operators
   switching between slides in `Deck Sequence`, `Song Sets`, and `Announcement Sets` MUST NOT encounter the
   `DISCARD_ON_SWITCH_CONFIRMATION` modal dialog unless they have actually modified the slide.
3. **In-Memory Measurement Retention.** When unmeasured elements exist, their measurements may still be evaluated and
   cached in memory, so that if the user subsequently performs an intentional edit and saves, the measurements are
   included in that save.
4. **Batch Healing Remains Explicit.** Batch re-measuring of legacy templates continues to be served by the dedicated
   "Re-measure all" button (`admin.artifacts.remeasureAll`) in the header toolbar, which explicitly iterates and saves
   templates on demand.
