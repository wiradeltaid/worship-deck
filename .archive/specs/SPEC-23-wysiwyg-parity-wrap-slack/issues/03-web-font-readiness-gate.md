# SPEC-23-03 — Web-Font Readiness Gate (Editor and Presenter)

**Status:** closed

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`, `UC-6`
- **Files**: `src/components/admin/ArtifactEditor.tsx`, `src/components/artifacts/ArtifactSlide.tsx`
- **Tests**: `tests/smoke-spec-23.test.mjs` (T-23-06, T-23-07)
- **Blocked by**: SPEC-23-04

## Context

The Google stylesheet loads with `display=swap` (`spa/index.html:9`, `spa/projected.html:9`) and there is
no `document.fonts.ready` anywhere in `src/` or `spa/`. Two independent defects follow.

**Editor.** If Fabric builds a `Textbox` before the face arrives, every measurement it takes — `textLines`,
`dynamicMinWidth`, and the `w` that `serializeCanvas` persists — is taken against the fallback. SPEC-23-01
makes that stored width load-bearing, so a wrong measurement becomes wrong data permanently.

**Presenter.** `applyFit` runs once in `useLayoutEffect` and is re-run only by a `ResizeObserver` watching
the **box** (`ArtifactSlide.tsx:96-104`). A font swap does not resize the box, so a fit scale computed
against the wrong face is never corrected. This is visible on the projected screen and is not a
PPTX-parity issue at all.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Editor**: await `document.fonts.ready` before constructing Fabric text objects, and before
   `serializeCanvas` writes geometry. While waiting, the canvas MUST show its normal loading state rather
   than a half-measured slide.
2. **Presenter**: re-run `applyFit` on the `document.fonts` `loadingdone` event, in addition to the
   existing `ResizeObserver`. Remove the listener in the effect cleanup.
3. Both call sites MUST tolerate the API being absent (`typeof document.fonts === 'undefined'`) and a
   rejected promise — a font that never loads degrades to today's behaviour, it does not blank the slide
   or throw. Server rendering has no `document`; the existing `typeof ResizeObserver === 'undefined'`
   guard is the pattern to follow.
4. `applyFit` is already documented as idempotent (each pass searches from scratch). Do not weaken that:
   the extra invocation MUST NOT be able to walk the size down over successive font events.
5. **`ready` is not enough on its own.** `document.fonts.ready` resolves once the fonts requested
   *so far* have settled. The moment the operator picks a face the page has not used yet, the
   promise is already resolved and the new face is still loading — so a measurement taken right
   after the pick is taken against the fallback, which is the very defect this ticket exists to
   close. The font-picker handler MUST therefore await
   `document.fonts.load(`${fontSize}px "${family}"`)` for the newly chosen face before it marks the
   element dirty or lets `serializeCanvas` run.
6. **Test harness.** `document.fonts` does not exist under `node --test`. Follow the harness these
   components' existing tests already use (`tests/artifact-editor-*.test.mjs`,
   `tests/artifact-preview.test.mjs`) and extend it with a `document.fonts` stub exposing `ready`
   and `addEventListener`; do not introduce a second test harness for this ticket.

## Acceptance Criteria

- [x] No Fabric text object is constructed before `document.fonts.ready` resolves.
- [x] `serializeCanvas` cannot run against unloaded fonts.
- [x] The presenter recomputes its fit scale on `loadingdone` with no box resize involved.
- [x] A second `applyFit` on already-loaded fonts produces the identical scale — proven by test, not by
      inspection.
- [x] Both surfaces render correctly when `document.fonts` is undefined and when the font promise rejects.
- [x] Choosing a face the page has not loaded before does not persist a measurement taken against the
      fallback — proven by injecting the missing `document.fonts.load` await and watching the guard
      go red.
- [x] The listener is removed on unmount.

## Comments

- Awaited `document.fonts.ready` in `mountCanvas` before constructing and painting elements, and in `handleSave` before `serializeCanvas`.
- Added `document.fonts.load` await in `handleFontFamilyChange` across unique active font sizes before setting family and marking dirty.
- Added `loadingdone` and `document.fonts.ready` listeners in `ArtifactSlide.tsx` with unmount guard and listener cleanup.
- Reviewed by agent and `cursor-agent composer-2.5`; addressed feedback on save font loading, per-object font size derivation, unmount cancellation, and distance guards in test harness.
- Verified with T-23-06, T-23-07, and stub/injection proofs in `tests/smoke-spec-23.test.mjs`.

