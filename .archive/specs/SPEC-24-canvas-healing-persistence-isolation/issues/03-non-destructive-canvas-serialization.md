# SPEC-24-03 — Non-Destructive Canvas Serialization

**Status:** open

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `src/lib/registry/canvas-utils.ts`
- **Tests**: `tests/smoke-spec-24.test.mjs` (T-24-04, T-24-05, T-24-06, T-24-08)
- **Blocked by**: SPEC-24-02

## Context

In `src/lib/registry/canvas-utils.ts`, lines 387–453 implemented `isHealing` destructively:
```ts
const computedX = isHealing || left === authoredLeft ? source.x : pxToPct(left, CANVAS_WIDTH);
const computedY = isHealing || top === authoredTop ? source.y : pxToPct(top, CANVAS_HEIGHT);
if (isText) {
  if (isHealing) {
    if (source.content !== undefined) next.content = source.content;
  }
  if (isHealing) {
    if (source.style) next.style = { ...source.style };
  }
}
```
Whenever `isHealingSave: true` was passed, any element that was moved, had its text changed, or had its typography modified
was forcibly overwritten with `source.*` (the original values prior to the edit).
The database was updated with the original values, and on reload `setTemplate(data)` reloaded those values, causing
elements to snap back to their initial state (BUG-32).

SPEC-23-05 Req 3 only required that healing saves avoid auto-expanding `h` to Fabric's measured text height
(`Math.max(source.h, measuredTextHeightPct)`) and avoid rewriting `zIndex` unless the user reordered layers.
It never intended to overwrite user-edited coordinates or content.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Never Overwrite Modified Coordinates.** In `serializeCanvas`:
   - `computedX` MUST evaluate to `left === authoredLeft ? source.x : pxToPct(left, CANVAS_WIDTH)`.
   - `computedY` MUST evaluate to `top === authoredTop ? source.y : pxToPct(top, CANVAS_HEIGHT)`.
   - `isHealingSave` MUST NOT force `computedX = source.x` or `computedY = source.y` if `left` or `top` has moved.
2. **Never Overwrite Modified Text Content.** In `serializeCanvas`:
   - `next.content` MUST capture the live text from the Fabric object (`obj.text`) if content was modified or present.
   - `isHealingSave` MUST NOT discard user-edited text.
3. **Never Overwrite Modified Visual Styles.** In `serializeCanvas`:
   - `next.style` MUST serialize live styling from `serializeTextStyle(source, obj)`.
   - `isHealingSave` MUST NOT discard user-edited font family, size, color, bold, italic, or shadow.
4. **Preserve Intended SPEC-23-05 Invariant.** When `isHealingSave: true`:
   - If the element was not manually resized in height, preserve `source.h` (do not auto-expand `h`).
   - If layers were not manually reordered, preserve `source.zIndex`.
   - Apply wrap slack to `w` if dynamicMinWidth requires widening.
   - Stamp `longestWordPx`, `wrapLines`, and `measuredWith` accurately.
