# SPEC-25-01 — Reuse elementToFabricObject in healTemplate (Fixes Crash + Style Corruption)

**Status:** open

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**: `src/lib/registry/canvas-utils.ts`, `src/components/admin/ArtifactEditor.tsx` (only to extract the
  shared construction function — no behaviour change at its existing call site)
- **Tests**: `tests/smoke-spec-25.test.mjs` (SPEC-25-02)
- **Blocked by**: —

## Context

`healTemplate()` builds an offscreen Fabric canvas to measure unmeasured text elements, then serializes the
result with `serializeCanvas(canvas, layout, new Map(), { isHealingSave: true })`. For a **text** element it
constructs a real `fabric.Textbox`, but a *partial* one — no `fill`, `textAlign`, `lineHeight`, `underline`, or
`shadow` — never the full option set `elementToFabricObject()` (`ArtifactEditor.tsx:149`, the construction path
the interactive canvas already uses) supplies. For every **non-text** element (shape, image,
image-placeholder) it does not construct a Fabric instance at all:

```ts
} else {
  canvas.add({ ...common, type: element.type });
}
```

This is a bare object literal, never a `fabric.Object` subclass instance. `fabric.Canvas`'s internal
`_onObjectAdded(obj)` unconditionally calls `obj._set('canvas', this)` on every object passed to
`canvas.add(...)` (`node_modules/fabric/dist/index.node.mjs:3192-3198`, fabric `6.6.1`). A plain object has no
`_set` method, so the moment "Re-measure all" (`admin.artifacts.remeasureAll` → `handleRemeasureAll` in
`ArtifactEditor.tsx` → `healTemplate()`) reaches a legacy template with an unmeasured text element *and* a
shape or image element in the same template, it throws `TypeError: t._set is not a function` and aborts the
batch. (`isElementUnmeasured()` returns `false` for every non-text type, so a template of only shapes/images
never reaches the crash — it is the combination that triggers it.) Filed as BUG-33.

Reproducing this needs no real browser: `await import('fabric')` (or `fabric/node`) plus a `StaticCanvas`
reproduces the identical crash in plain Node in well under a second — confirmed independently.

Filed into this same ticket, not separately, at the same root cause — fixing the crash by constructing a
real Fabric instance without also carrying full style options corrupts data. A `new fabric.Rect({...common})`
with no `fill`/`opacity` specified defaults to `fill: 'rgb(0,0,0)'`, `opacity: 1` — `serializeCanvas`'s
`toStrictHexColor` then writes that back as `#000000`, repainting every unstyled shape black. A `new
fabric.Textbox(text, {...common, fontSize, fontFamily, fontWeight, fontStyle})` (today's partial text
construction) strips `fontColor`, resets `textAlign` to Fabric's own default, and drops
`lineHeight`/`underline`/`textShadow` on write-back — verified against a realistic fixture: white, centred,
underlined, drop-shadowed text healed into black, left-aligned, plain text. `handleRemeasureAll` loops over
and **saves** every template it changes, so this is not cosmetic — it is the BUG-32 class of damage (SPEC-24)
recurring at a different call site, and exactly what the owner's own checklist wording guards against
("elemen yang tidak diedit tidak boleh bergeser/berubah visual"). The crash above currently masks most of it
by aborting the batch before most templates save.

This is not a SPEC-24 regression: `git log -S'canvas.add({ ...common'` traces the crash-causing line to
`fe8b1f5` (SPEC-23-05), and the text branch's partial construction has been there just as long. It surfaced
only now because no test or manual pass had exercised "Re-measure all" against a template combining an
unmeasured text element with a shape/image element until this UAT round.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **One construction path, not two.** `healTemplate()` MUST NOT grow a second, parallel way to build a Fabric
   object per element type. Extract `elementToFabricObject()`'s construction logic (currently private to
   `ArtifactEditor.tsx`) into a shared function `src/lib/registry/canvas-utils.ts` can import, and have both
   `ArtifactEditor.tsx`'s interactive-canvas mount path and `healTemplate()` call the same function. The
   interactive canvas's existing behaviour (what it constructs, with what options) MUST NOT change as a result
   of this extraction — this is a move, not a rewrite.
2. **Every element kind gets a real instance with full style fidelity**, via the shared function:
   - `shape` → `fabric.Rect` carrying `fill: element.style?.fillColor ?? '#5C2E16'`,
     `opacity: element.style?.opacity ?? 1` — the same defaults `elementToFabricObject` already uses, not a
     fresh Fabric default.
   - `text` → `fabric.Textbox` carrying `fill` (font colour), `textAlign`, `lineHeight`,
     `underline` (from `textDecoration`), `shadow` (from `textShadow`/`textShadowBlur`), `fontWeight`,
     `fontStyle` — the full option set `elementToFabricObject`'s text branch already assembles, not the
     geometry-plus-font-size-and-family subset `healTemplate()` builds today.
   - `image` / `image-placeholder` → a real `fabric.Object` subclass instance. `healTemplate()` never needs
     actual pixel content for these — only geometry participates in `serializeCanvas()` — so a lightweight real
     `fabric.Rect`-shaped stand-in is acceptable in place of `elementToFabricObject`'s full `fabric.FabricImage`
     construction, but it MUST still be a genuine Fabric instance, never a plain object literal.
3. **Guard pattern preserved.** Construction MUST still check for the real Fabric class's availability (as the
   text branch already does via `typeof fabric?.Textbox === 'function'`) and fall back to today's plain-object
   path only when the real class is unavailable — never as the default when a real `fabric` module is present.
4. **Watch `computedX`/`computedY` for the image stand-in.** `serializeCanvas`'s `computedX`/`computedY`
   (~line 384) has no `isHealing` guard, unlike `w`, `h`, and `zIndex`. If the image construction choice in
   requirement 2 produces a `left`/`top` that differs from `authoredLeft`/`authoredTop` (as
   `elementToFabricObject`'s real `fabric.FabricImage` branch can, since it fit-scales), healing would silently
   move image elements. Either construct the stand-in so its `left`/`top` always equals the authored geometry
   exactly (straightforward for a plain `Rect` stand-in — do this, do not add an `isHealing` branch to
   `computedX`/`computedY` as a workaround), or state explicitly why a position drift is acceptable. Silence on
   this point is not acceptable — SPEC-24 exists because a previous "isHealing" special case in this exact
   function silently overwrote user data.
5. **No unrelated change to `serializeCanvas()`'s reading side.** Beyond requirement 4's specific check, the
   rest of `serializeCanvas()` MUST NOT change — it already reads `obj.left`/`obj.top`/`obj.width`/
   `obj.height`/`fill`/`opacity` generically off whatever `canvas.getObjects()` returns.
6. **Invariant.** For a shape, image, or text element that required no measurement change, healing MUST
   produce byte-identical stored geometry *and* style (position, size, `fillColor`/`opacity` for shapes;
   `fontColor`, `textAlign`, `lineHeight`, `textDecoration`, `textShadow`/`textShadowBlur` for text) to what it
   held before healing. This is stronger than SPEC-23-05's original guarantee (which only covered text) and is
   the actual fix: making that guarantee hold for every element kind, and for every style field, not only
   geometry.
7. **Placeholder/token text elements are in scope too.** The construction loop in `healTemplate()` iterates
   over every element in `layout.elements`, not only unmeasured ones — a text element carrying a
   `placeholderKey` or a `{token}` in its content passes through the same shared construction function. The
   fix MUST confirm (and the test in SPEC-25-02 MUST assert) that a placeholder/token text element's style
   survives healing identically to a hydrated one — it MUST NOT be assumed correct by extension.
8. **Data-remediation check, not just a forward fix.** Before this ticket is considered done, confirm whether
   "Re-measure all" has ever been run to completion (or partway) against the live `presenter-dev` database
   before today's crash was discovered — text elements heal "successfully" today with no crash, only silent
   style loss (`fontColor`/`textAlign`/`lineHeight`/`underline`/`textShadow`), so any such prior run may have
   already saved corrupted templates that this fix does not detect or repair going forward. If a prior run is
   confirmed or cannot be ruled out, file the remediation (an audit + restore pass, or an accepted risk if the
   affected set is empty/known) via `wdi-question` or a follow-up ticket — it MUST NOT be silently assumed
   away.
