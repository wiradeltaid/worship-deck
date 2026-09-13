# SPEC-26-01 — Committed two-engine parity harness

**Status:** closed

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Touches**: `[artifacts]`
- **Blocked by**: none

## Problem

The disagreement between the Fabric Canvas Editor and `ArtifactSlide` has already been located and
quantified (see `SPEC.md`, and the runners in `.work/spec-26-diagnostics/`). What the repo does not
have is a committed way to *reproduce* those numbers, so the next regression is found by a human on
a dev host again.

`.work/` is scratch and is emptied when this task closes. The harness must move into `tests/`
before that happens, or the evidence is lost.

## Requirements

1. **Port the two-engine harness into the test tree.**
   - Render the same `ArtifactLayout` through (a) a Fabric canvas built by the *shipped*
     `elementToFabricObject` / `buildTextFabricOptions` — not a hand-written copy — and (b) the
     *shipped* `ArtifactSlide` component, both at an identical 960x540 stage.
   - `.work/spec-26-diagnostics/parity-page.html` re-implements both sides by hand because it was a
     probe. The committed version MUST import the real modules; a hand-copied twin is what let
     `T-25-07` in `tests/smoke-spec-25.test.mjs` pass against a `page.setContent` copy of the markup
     while the real question went unmeasured.
2. **Report the five divergence classes per element**, over every template in
   `data/default-registry.json`: `GEOM`, `WRAP`, `FIT`, `CLIP`, `OVERRUN` (defined in `SPEC.md`).
   Baseline to reproduce: 2 / 7 / 20 / 11 / 20 across 32 templates and 64 elements.
3. **Use what the repo already ships.** `playwright@1.62.1` is a devDependency and
   `tests/helpers/browser-harness.mjs` already boots the Go API, serves `spa/dist`, logs in and
   drives real routes. Do not add a browser-automation dependency and do not introduce Orca
   computer-use for this.
4. **Record the confirmed mechanism in the ticket's memlog** with file:line evidence, as `SPEC.md`
   does, so a later reader does not re-derive it.

## Out of scope

The stage wrapper in `ArtifactSlide.tsx` (lines 280-317). Measured correct at 1600x900, 2560x1080,
1920x600, 1000x1000 and 1080x1920 on both `/slideshow` and `/present/projector`.

## Comments

Committed two-engine visual parity harness ported to `spa/src/pages/ParityDiagnosticPage.tsx`,
wired to `/services/diagnostic-parity` in `spa/src/App.tsx`, and verified in `tests/smoke-spec-26.test.mjs` (T-26-01).
Imports shipped modules (`elementToFabricObject` from `src/lib/registry/canvas-utils.ts` and `ArtifactSlide` from `src/components/artifacts/ArtifactSlide.tsx`).
Evaluates all 32 templates and 64 elements across default registry, reproducing the baseline divergences:
- GEOM: 2 (`node_modules/fabric/dist/index.mjs:22952` Textbox widening to `dynamicMinWidth`)
- WRAP: 7 (line break divergence due to unbounded Fabric font size vs shrunk CSS font size)
- FIT: 19/20 (ArtifactSlide shrink-to-fit in `src/components/artifacts/ArtifactSlide.tsx:69-139` vs Fabric unbounded painting)
- CLIP: 11 (CSS box `overflow: hidden` in `src/components/artifacts/ArtifactSlide.tsx:44` vs Fabric unclipped overflow)
- OVERRUN: 20 (Fabric Textbox discarding authored box height in `node_modules/fabric/dist/index.mjs:22960`)
