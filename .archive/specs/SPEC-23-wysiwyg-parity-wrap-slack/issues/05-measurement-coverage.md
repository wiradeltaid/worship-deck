# SPEC-23-05 — Measurement Coverage

**Status:** closed

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`, `UC-6`
- **Files**: `src/lib/registry/canvas-utils.ts`, `src/components/admin/ArtifactEditor.tsx`,
  `src/lib/artifacts/hydrate.ts`, `src/lib/artifacts/render-model.ts`
- **Tests**: `tests/smoke-spec-23.test.mjs` (T-23-11, T-23-12, T-23-13)
- **Blocked by**: SPEC-23-03

## Context

A byte scan of `data.db` and both `default-registry.json` files returns zero occurrences of `wrapLines`:
SPEC-22's machinery has never run on a real element (SPEC.md §1.2 E1). `longestWordPx` from SPEC-23-01
inherits the same property — it exists only on elements saved after it ships.

A data migration cannot close that. Both fields are font measurements, and there is no trustworthy font
measurement on the server: no shaping engine on the PPTX path, and no guarantee a Node process has the
Google faces installed. A migration would measure against whatever face `node-canvas` resolved and write
the result in permanently — the exact wrong-font failure SPEC-23-03 exists to prevent, and worse than
measuring nothing. So the measurement stays where the fonts are, in the browser, and this ticket adds a
way to reach every element without asking an admin to hand-edit each one.

## Implementation Requirements

Numbered steps are the work; MUST / MUST NOT marks a constraint the finished code has to satisfy.

1. **Healing pass on open.** When the editor opens a template, measure any text element that is
   unmeasured — lacking `wrapLines` or `longestWordPx`, or carrying a `measuredWith` that no longer
   matches its style — from the Fabric object just built, after the `document.fonts.ready` gate from
   SPEC-23-03, and mark it dirty so the next save persists the fields. Reuse the existing `markDirty`
   mechanism; do not invent a second one.

2. **Re-measure action.** Add an explicit admin action that opens every template in turn, runs the
   healing pass, and saves each template the pass marked dirty. A template the pass left clean is **not**
   re-saved. It is one deliberate click, not a per-element chore, and it MUST report how many elements it
   measured and how many it skipped.

3. **The healing save MUST NOT carry other geometry with it.** `serializeCanvas` re-derives `h` from the
   Fabric object under SPEC-20-04, so a save triggered purely to record a measurement would silently
   resize every legacy element it touched. When the only dirty fields on an element are the measurement
   fields, `serializeCanvas` MUST carry `source.h` and `source.zIndex` through untouched. Widening `w` is
   SPEC-23-01's job and rides along deliberately; nothing else does.

4. **Placeholders are measured in the browser, not at hydrate.** Their text is unknown at authoring time,
   so the authoring-time exclusion stays. But hydrate has no text measurement either, so it MUST NOT be
   asked to produce one: hydrate computes no `wrapLines` and no `longestWordPx` for a substituted
   element, and a `placeholderKey` element therefore takes SPEC-23-02's unmeasured fallback on every
   export. Say so in the code, so the next reader does not think it was forgotten.

   Measuring substituted text is real work with no home yet — it needs the browser, and the browser does
   not see a hydrated instance. It is **out of scope here** and named in SPEC.md §2.7.

5. **Guard visibility.** When the `wrapLines` coherence guard rejects a set, log it once per element with
   the element id and both flattened strings. Console only; no new telemetry surface, and no congregation
   text in any persisted log.

6. **Unmeasured elements keep working.** An element with neither field MUST export exactly as it does
   today. Measurement is an improvement, not a precondition — SPEC.md §1.4.

## Residual

Templates never opened and never re-measured keep today's PPTX behaviour, and so does every
`placeholderKey` element. That is a real limit, named rather than hidden: SPEC-23-02's fallback makes
those elements produce the deck they produce now, not a worse one, and the re-measure action turns
closing the template half of the gap into one action the owner takes when they choose to.

## Acceptance Criteria

- [x] Opening a template with unmeasured text elements marks them dirty; opening an already-measured
      template marks nothing dirty and saves nothing.
- [x] The re-measure action run twice produces the same registry as running it once.
- [x] A healing save changes only `wrapLines`, `longestWordPx`, `measuredWith` and (via SPEC-23-01) `w`.
      `h`, `zIndex`, `x`, `y`, `content` and `style` are byte-identical before and after — proven by
      injecting an `h` rewrite and watching T-23-11 go red.
- [x] An element whose style changed since its `measuredWith` is re-measured on the next open.
- [x] Hydrate writes no `wrapLines` and no `longestWordPx`; a `placeholderKey` element exports through the
      unmeasured fallback.
- [x] The coherence guard logs on rejection, with no congregation text written to disk.
- [x] An unmeasured element exports byte-identical slide XML to before this spec, at run level — see
      SPEC-23-04 for what `bodyPr` changes for every shape by design.
- [x] `tests/public-repo-guard.test.mjs` stays green — no real data enters the repo through a fixture.

## Comments

- Implemented `isElementUnmeasured` and `healTemplate` in `canvas-utils.ts`.
- Integrated healing save mode (`isHealingSave: true`) in `serializeCanvas` so `h`, `zIndex`, `x`, `y`, `content`, and `style` are preserved byte-identical.
- Added `handleRemeasureAll` action and button in `ArtifactEditor.tsx` with i18n keys across English and Indonesian catalogues.
- Added coherence mismatch warning log in `resolveWrapLineCount` (`render-model.ts`).
- Dual-reviewed by agent and `cursor-agent composer-2.5`; verified with T-23-11, T-23-12, T-23-13, coherence guard in `tests/smoke-spec-23.test.mjs` and `tests/public-repo-guard.test.mjs`.

