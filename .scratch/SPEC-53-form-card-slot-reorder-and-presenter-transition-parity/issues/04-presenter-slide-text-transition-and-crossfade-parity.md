# 04: Presenter Slide Text Transition Smoothness & Automated Regression Suite

**What to build:**
Eliminate slide text linger / ghosting ("teks nyangkut bentar") during presenter projection slide changes and author the automated smoke test suite:
1. Observable Acceptance Scenario & Visual Contract:
   - Scenario: Two successive text-dense slides (e.g. Song Verse 1 -> Song Verse 2, or Sermon Title -> Scripture) on both `ProjectorClient` and `SlideshowClient`.
   - Visual Contract:
     - Outgoing text must not linger at full 100% opacity beneath incoming text.
     - As the incoming slide fades in, the outgoing slide layer fades out smoothly and proportionally.
     - Settled frame: Only incoming slide content is rendered; no double-text or ghosted fragments remain visible.
2. Smooth Crossfade Transition Contract:
   - In `src/lib/transitions.ts`:
     - Update `CROSSFADE` specification for the `outgoing` layer:
       Change `outgoing: { from: { opacity: 1 }, to: { opacity: 1 } }`
       to `outgoing: { from: { opacity: 1 }, to: { opacity: 0 } }`.
     - Retain 500ms duration and standard cubic-bezier easing curve.
3. Element Lifecycle Isolation & Slide Identity Keys:
   - In `src/components/artifacts/ArtifactSlide.tsx` and presentation layer wrappers:
     - Ensure each rendered slide has an explicit unique slide-instance key (e.g. `key={instance.instanceId || `${instance.templateId}-${index}`}`) on the root container.
     - Prevent React DOM node recycling between disjoint slides so `TextElement` measurement effects and font-fit scales (`FIT_SCALE_VAR`) do not flash stale text layout before `applyFit` settles.
4. Automated Smoke Regression Suite (`tests/smoke-spec-53.test.mjs`):
   - Assert `Header.tsx` renders `New Workspace Mockup` for the `/new` navigation link.
   - Assert `FormLayoutAdminPanel.tsx` and `DynamicFormBody.tsx` submit full sequential arrays for card and slot reordering.
   - Assert `transitions.ts` defines `outgoing` transition opacity fading from 1 to 0.
   - Assert `ArtifactSlide.tsx` root container incorporates slide-instance identity.
   - Execute physical defect injection tests with mutation and reversion to prove guards catch regressions.
   - Register `"test:smoke-spec-53"` script in `package.json`.

**Satisfies:** UC-11, UC-12, FR-15, FR-16

**Touches:** present-channel, artifacts

**Blocked by:** SPEC-53-03

**Status:** closed

- [x] Update `CROSSFADE` transition specification in `src/lib/transitions.ts` so outgoing layer opacity fades smoothly from 1 to 0.
- [x] Enforce slide-instance identity keys on `ArtifactSlide.tsx` to prevent DOM element recycling and text layout flicker.
- [x] Verify clean transition rendering across `ProjectorClient`, `SlideshowClient`, and `PresenterOperator`.
- [x] Author `tests/smoke-spec-53.test.mjs` with comprehensive assertions and defect injection proofs.
- [x] Register `"test:smoke-spec-53"` script in `package.json` and verify clean execution.
