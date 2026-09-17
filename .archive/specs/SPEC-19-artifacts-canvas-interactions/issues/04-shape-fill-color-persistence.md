# Ticket SPEC-19-04 — Shape Fill Color & Opacity Serialization Persistence

**Status:** ready-for-agent

## Component
`registry` (`src/lib/registry/canvas-utils.ts`, `src/components/admin/ArtifactEditor.tsx`)

## Dependencies
`blocked_by: ["SPEC-19-03"]`

## Problem
In `ArtifactEditor.tsx`, when an operator selects a shape (`type: 'shape'`) and changes its fill color via the color picker (`Fill Color:` input), the shape updates in real-time on the canvas. However, upon clicking Save and reloading the slide, the shape reverts back to the default brown (`#5C2E16`).

## Root Cause
In `src/lib/registry/canvas-utils.ts`, `serializeCanvas` only serializes `style` for text objects:
```typescript
if (isText) {
  const text = obj.text ?? '';
  if (source.content !== undefined || text !== '') {
    next.content = text;
  }
  const style = serializeTextStyle(source, obj);
  if (style) {
    next.style = style;
  } else {
    delete next.style;
  }
}
```
For shapes (`source.type === 'shape'`), `next` simply spreads `...source` without reading `obj.fill` or `obj.opacity`. As a result, the live fill color on the Fabric rectangle is never written to `next.style`, so the saved JSON retains the stale authored color (`#5C2E16`).

## Requirements
1. In `src/lib/registry/canvas-utils.ts`:
   - Update `serializeCanvas` to handle `source.type === 'shape'`:
     ```typescript
     if (source.type === 'shape') {
       const fill = typeof (obj as any).fill === 'string' ? (obj as any).fill : undefined;
       const opacity = typeof (obj as any).opacity === 'number' ? (obj as any).opacity : undefined;
       next.style = {
         ...source.style,
         ...(fill ? { fillColor: fill } : {}),
         ...(opacity !== undefined ? { opacity } : {}),
       };
     }
     ```
2. Automated Unit & Smoke Tests:
   - Add a test case in `tests/smoke-spec-19.test.mjs` verifying shape serialization where live `obj.fill = '#2563EB'` differs from `source.style.fillColor = '#5C2E16'`, asserting that the serialized element contains `style.fillColor: '#2563EB'`.
   - Verify that `validateArtifactTemplate` validates the serialized template containing custom `fillColor`.

## Acceptance Criteria
- Changing shape fill color to any hex color (e.g. `#2563EB`, `#10B981`) and clicking Save persists the color in the template payload.
- Reloading the page displays the shape with the saved custom color.
- Unit test explicitly asserts serialization where `obj.fill !== source.style.fillColor`.
- After save and reload, PPTX export draws the shape with the custom fill color.
