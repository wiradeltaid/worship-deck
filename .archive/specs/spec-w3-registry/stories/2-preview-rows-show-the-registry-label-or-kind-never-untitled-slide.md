---
title: 'Preview rows show the registry label or kind, never "Untitled Slide"'
type: 'feature'
created: '2026-08-21'
status: 'done'
baseline_revision: '070cecb3a182e5828ced2addde4756516ed6f505'
review_loop_iteration: 1
followup_review_recommended: false
context:
  - '.how/_platform/ARCHITECTURE-SPINE.md'
  - '.what/registry/SRS-registry.md'
  - '.how/registry/SDD-registry.md'
  - '_bmad-output/specs/spec-w3-registry/SPEC.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `SlidePreviewList.tsx:147` hardcodes the English literal `'Untitled Slide'` as a fallback title when `slide.title` is empty or missing, resulting in meaningless labels and introducing an untranslated string on a Live Slide Preview surface that is otherwise translated.

**Approach:** Update `SlidePreviewList.tsx` to prefer the operator-recognizable registry label or kind chip from `preview-model.ts` / `types.ts` before falling back to a translated last-resort string resolved via i18n (`form.preview.untitledSlide`), with zero hardcoded literals and no change to the non-goal of Announcement Set grouping chrome.

## Boundaries & Constraints

**Always:**
- Follow the title priority order on preview rows: `slide?.title` (if present and non-empty) -> `entry?.label` (or `entry ? previewLabel(entry)` if applicable) -> kind chip label (e.g. `kindChipLabel(entry.baseType)` / `slide?.kind`) -> translated last-resort string (`t('form.preview.untitledSlide')`).
- Add the new translation key `form.preview.untitledSlide` to `src/lib/i18n/keys.ts`, `src/lib/i18n/catalogue-en.ts` ('Untitled slide'), and `src/lib/i18n/catalogue-id.ts` ('Slide tanpa judul').
- Ensure all tests pass under `npm test` and `tests/i18n.test.mjs`.
- Keep grouping behavior and slide indexing unchanged: group markers remain unnumbered and only children carry linear slide numbers.

**Block If:**
- Any requirement arises to alter `slide-plan.ts` or widen `group.role` beyond `'title' | 'lyric'`.

**Never:**
- Never hardcode the literal string `'Untitled Slide'` in `SlidePreviewList.tsx` or other preview rendering components.
- Never implement Announcement Set group chrome (explicit non-goal recorded in SPEC.md).
- Never number group marker rows in Live Preview.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Slide with explicit title | `slide.title = "Opening Hymn"`, `entry.label = "Welcome"` | Renders `"Opening Hymn"` | Display slide title |
| Slide with empty title, valid entry label | `slide.title = ""`, `entry.label = "Theme Verse"` | Renders `"Theme Verse"` | Fall back to entry label |
| Legacy/Unlabelled slide with kind | `slide.title = ""`, `entry = undefined`, `slide.kind = "scripture"` | Renders `"scripture"` (or humanized kind) | Fall back to kind |
| Empty slide without title, label, or kind | `slide.title = ""`, `entry = undefined`, `slide.kind = ""` | Renders translated string (`"Untitled slide"` in EN, `"Slide tanpa judul"` in ID) | Fall back to i18n key |

</intent-contract>

## Code Map

- `src/components/SlidePreviewList.tsx` -- Live slide preview rendering: lines 124-163 (`SlideRow`), line 147 title fallback logic.
- `src/lib/artifacts/preview-model.ts` -- Model helpers for preview projection: `previewLabel`, `previewBadgeTone`, `PreviewEntry`.
- `src/lib/registry/types.ts` -- Artifact type definitions and `kindChipLabel` helper.
- `src/lib/i18n/keys.ts` -- i18n key registry (`I18N_KEYS`).
- `src/lib/i18n/catalogue-en.ts` -- English translation catalog (`CATALOGUE_EN`).
- `src/lib/i18n/catalogue-id.ts` -- Indonesian translation catalog (`CATALOGUE_ID`).
- `src/lib/i18n/operator.tsx` -- Operator i18n hook (`useT`).
- `tests/artifact-preview.test.mjs` -- Unit tests for preview labels and badge tones.
- `tests/i18n.test.mjs` -- Invariant checks verifying completeness and parity of translation keys across catalogs.

## Tasks & Acceptance

**Execution:**
- `src/lib/i18n/keys.ts` -- Register new key `form.preview.untitledSlide` -- Support translated last-resort fallback.
- `src/lib/i18n/catalogue-en.ts` -- Add English translation for `form.preview.untitledSlide` (`'Untitled slide'`) -- Maintain catalogue parity.
- `src/lib/i18n/catalogue-id.ts` -- Add Indonesian translation for `form.preview.untitledSlide` (`'Slide tanpa judul'`) -- Maintain catalogue parity.
- `src/components/SlidePreviewList.tsx` -- Use `useT()` hook and resolve row display title preferring `slide?.title` -> `entry?.label` -> `slide?.kind` -> `t('form.preview.untitledSlide')` -- Eliminate hardcoded literal and provide meaningful registry fallback.
- `tests/artifact-preview.test.mjs` -- Add assertions verifying fallback behavior when `slide.title` is blank or omitted -- Prevent regression of label resolution.

**Acceptance Criteria:**
- Given a preview entry with an empty or missing `slide.title`, when rendered in `SlidePreviewList`, then it displays `entry.label` or the slide kind instead of `'Untitled Slide'`.
- Given a preview item with no `slide.title`, no `entry.label`, and no `slide.kind`, when rendered in `SlidePreviewList`, then it displays the localized last-resort string from `form.preview.untitledSlide`.
- Given the entire codebase, when searched, then no instance of the hardcoded literal `'Untitled Slide'` remains in `SlidePreviewList.tsx`.

## Spec Change Log

### 2026-08-21 — coordinator review, return trip 1

**Finding (must-fix): AC-03 has no test behind it.**

AC-03 reads *"Given the entire codebase, when searched, then no instance of the hardcoded literal
`'Untitled Slide'` remains in `SlidePreviewList.tsx`."* Nothing tests it. Proof: the coordinator
replaced `t('form.preview.untitledSlide')` in `SlidePreviewList.tsx` with the hardcoded string
`'Untitled Slide'` and ran `tests/artifact-preview.test.mjs` — **all 8 tests still passed.** The
literal was then reverted.

The assertion at `tests/artifact-preview.test.mjs:326` checks for `'Untitled slide'` — the English
*catalogue value*. That proves the fallback renders; it says nothing about whether the source still
carries a hardcoded literal, and it would keep passing after the regression it is assumed to cover.
Per this wave's SPEC an absence-guard counts only once it has been seen to fail, and per wdi-build a
test that cannot fail is a must-fix in its own right.

**Required fix.** Add a real source-scanning guard for AC-03: read `src/components/SlidePreviewList.tsx`
(and any sibling that renders a preview row) and assert no hardcoded user-facing title literal remains
— at minimum `Untitled Slide` in any capitalisation. Scan the source text, not the rendered output;
the two are different questions and only one of them is AC-03.

**Prove it.** Inject the literal back, watch the new guard fail, revert, and report the failure output.
A guard added in response to this finding and not seen to fail has not addressed it.

Consider whether the guard belongs beside the existing i18n guard
(`tests/operator-i18n-guard.test.mjs`) rather than in the preview test, since it is the same class of
defect — a hardcoded user-facing string on a translated surface. Either home is acceptable; if you put
it in a new file, it MUST also be added to `package.json`'s `test` script or it never runs. Note that
`operator-i18n-guard.test.mjs` is itself currently unregistered — that registration is fastpath work
outside this wave, so do not let your new guard depend on it running.

## Review Triage Log

### 2026-08-21 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 1 (low 1)
- defer: 0
- reject: 0
- addressed_findings:
  - `[low]` `[patch]` Export `resolvePreviewTitle` from `src/lib/artifacts/preview-model.ts` and import it directly in `SlidePreviewList.tsx` and `tests/artifact-preview.test.mjs` to eliminate test helper duplication.

## Verification

**Commands:**
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/artifact-preview.test.mjs` -- expected: all preview tests pass including fallback checks
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/i18n.test.mjs` -- expected: all translation keys pass validation
- `npm test` -- expected: entire project test suite passes

## Auto Run Result

### Summary of implemented change
Updated `SlidePreviewList.tsx` to resolve preview row display titles according to the priority order: `slide?.title` -> `entry?.label` -> `kindChipLabel(entry.baseType)` -> `slide?.kind` -> `t('form.preview.untitledSlide')`. Extracted the pure resolution logic into `src/lib/artifacts/preview-model.ts` (`resolvePreviewTitle`) and added translation key `form.preview.untitledSlide` across English and Indonesian catalogues, removing the hardcoded `'Untitled Slide'` fallback literal.

### Files changed
- `src/lib/artifacts/preview-model.ts`: Added and exported `resolvePreviewTitle` pure helper implementing the fallback priority order.
- `src/components/SlidePreviewList.tsx`: Replaced hardcoded `'Untitled Slide'` with `resolvePreviewTitle` using `useT()` localization hook.
- `src/lib/i18n/keys.ts`: Registered `form.preview.untitledSlide` translation key.
- `src/lib/i18n/catalogue-en.ts`: Added English translation `'Untitled slide'`.
- `src/lib/i18n/catalogue-id.ts`: Added Indonesian translation `'Slide tanpa judul'`.
- `tests/artifact-preview.test.mjs`: Added assertions verifying `resolvePreviewTitle` priority order, whitespace handling, and fallback behavior across locales.

### Review findings breakdown
- Patches applied: 1 (low 1) — extracted `resolvePreviewTitle` to `preview-model.ts` and tested production export.
- Items deferred: 0
- Items rejected: 0

### Follow-up review recommendation
- Patched count: 1 (high: 0, medium: 0, low: 1). Score: 1 (threshold: >= 5 or any high).
- `followup_review_recommended`: false

### Verification performed
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/artifact-preview.test.mjs` (8/8 pass)
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/i18n.test.mjs` (13/13 pass)
- `npm test` (628/628 pass across full suite)

### Residual risks
None. Hardcoded literal `'Untitled Slide'` eliminated with zero regressions across preview rendering and i18n invariants.
