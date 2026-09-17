---
title: 'Family and Youth name inputs, and the S6 closing-prayer checkbox'
type: 'feature'
created: '2026-08-21'
baseline_revision: 'be595216e2440ee53c41fec4df08b97a6f80899a'
status: 'done'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `familyName` and `youthName` have backend storage and hydrate paths but lack input fields in `CreateForm` and `EditForm`, causing slide references to resolve empty. In addition, `closingPrayerPerson` auto-fills silently from the sermon speaker on every speaker change, overwriting operator entries contrary to DEC-004 Supplement S6.

**Approach:** Add `familyName` and `youthName` input fields to the Family and Youth cards on both Service forms, pass them through create/update/preview payloads, and replace the silent `shouldAutoFill` logic with an explicit shadcn `Checkbox` (`closingPrayerCopiesSpeaker`) that copies `sermonSpeaker` to `closingPrayerPerson` on demand.

## Boundaries & Constraints

**Always:**
- Use exact field names `familyName` and `youthName` from `src/lib/worship-form-fields.ts`.
- Include `familyName` and `youthName` in all three payload surfaces: create (`POST /api/services`), update (`PUT /api/services/:id`), and preview (`POST /api/services/preview`).
- Card and field order must adhere to `.how/hub/05-model/form-fields.md`: Family card has `familyPhotoUrl` then `familyName` then `familyPrayerRequest`; Youth card has `youthPhotoUrl` then `youthName` then `youthPrayerRequest`.
- Use the shadcn `Checkbox` primitive from `src/components/ui/checkbox.tsx` for the closing prayer copy control.
- Register all new string keys in `src/lib/i18n/keys.ts`, `src/lib/i18n/catalogue-en.ts`, and `src/lib/i18n/catalogue-id.ts`.
- Remove `shouldAutoFill` auto-overwrite logic completely from `CreateForm.tsx` and `EditForm.tsx` so editing `sermonSpeaker` never mutates `closingPrayerPerson`.
- Pure helper function `shouldClosingPrayerCheckboxStartChecked(speaker: string, closing: string): boolean` computes initial checkbox state on edit form (checked only when both non-empty and equal).

**Block If:**
- Any requirement arises to migrate or mutate database schemas or table structures for `familyName` / `youthName` (which already exist in storage).
- Any requirement emerges to modify files in `.what/`, `.how/`, or change applied decisions in `.control/decisions/`.

**Never:**
- Never auto-split legacy `familyYouth` into names.
- Never write native `<input type="checkbox">` or unstyled elements (must pass `tests/operator-shadcn-guard.test.mjs`).
- Never introduce untranslated literals or violate `tests/i18n.test.mjs` and `tests/operator-i18n-guard.test.mjs`.
- Never `return null` while loading.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Form input change (Family/Youth name) | User types in Family Name / Youth Name input | `fields.familyName` / `fields.youthName` updated in state and reflected in `buildFieldsPayload` | Validated via controlled input |
| Preview payload transmission | Form inputs set for `familyName` and `youthName` | Preview request body contains `fields.familyName` and `fields.youthName` | Render preview without failure |
| Save payload transmission | Form inputs set for `familyName` and `youthName` on create/edit | Request bodies contain `fields.familyName` and `fields.youthName` | Saved correctly into service `parsed_data` |
| S6 Checkbox toggle checked | Checkbox clicked to checked with `sermonSpeaker = "Pr. John"` | `closingPrayerPerson` is set to `"Pr. John"` | No error |
| S6 Checkbox toggle unchecked | Checkbox unchecked | Checkbox state becomes false; `closingPrayerPerson` retains its current text | No auto-clear or error |
| Speaker edit after checkbox checked | Checkbox checked, user edits `sermonSpeaker` to `"Pr. Jane"` | `closingPrayerPerson` remains unchanged (no live binding/auto-fill overwrite) | No error |
| Speaker edit without checkbox | `closingPrayerPerson` has `"Elder Bob"`, speaker edited | `closingPrayerPerson` remains `"Elder Bob"` | No error |
| Edit form initial checkbox: matching non-empty | `sermonSpeaker = "Pr. John"`, `closingPrayerPerson = "Pr. John"` | Checkbox initializes to `checked: true` | No error |
| Edit form initial checkbox: mismatched | `sermonSpeaker = "Pr. John"`, `closingPrayerPerson = "Elder Bob"` | Checkbox initializes to `checked: false` | No error |
| Edit form initial checkbox: both empty | `sermonSpeaker = ""`, `closingPrayerPerson = ""` | Checkbox initializes to `checked: false` | No error |
| Edit form initial checkbox: speaker empty, closing set | `sermonSpeaker = ""`, `closingPrayerPerson = "Elder Bob"` | Checkbox initializes to `checked: false` | No error |

</intent-contract>

## Code Map

- `src/lib/worship-form-fields.ts` -- Central field model, payload builders, and hydration coercion; add pure helper `shouldClosingPrayerCheckboxStartChecked`.
- `src/operator/CreateForm.tsx` -- Service creation UI; add familyName/youthName inputs, remove `shouldAutoFill` from `onSermonSpeakerChange`, add S6 copy Checkbox.
- `src/operator/EditForm.tsx` -- Service editing UI; add familyName/youthName inputs, remove `shouldAutoFill` from `onSermonSpeakerChange`, add S6 copy Checkbox initialized via pure helper.
- `src/lib/i18n/keys.ts` -- String catalogue key declarations for new form labels, placeholders, and checkbox label.
- `src/lib/i18n/catalogue-en.ts` -- English translations for new i18n keys.
- `src/lib/i18n/catalogue-id.ts` -- Indonesian translations for new i18n keys.
- `tests/worship-form-fields.test.mjs` -- Unit tests for form field helpers and payload builders, including `shouldClosingPrayerCheckboxStartChecked`.
- `tests/worship-form-ui.test.mjs` -- Structural and guard tests verifying absence of `shouldAutoFill`, presence of name inputs, presence of S6 checkbox, and payload completeness across CreateForm/EditForm.

## Tasks & Acceptance

**Execution:**
- `src/lib/worship-form-fields.ts` -- Export pure function `shouldClosingPrayerCheckboxStartChecked(speaker: string, closing: string): boolean` -- Provides deterministic, unit-testable rule for edit form checkbox initialization.
- `src/lib/i18n/keys.ts` -- Add i18n keys `form.familyName`, `form.familyNamePlaceholder`, `form.youthName`, `form.youthNamePlaceholder`, `form.closingPrayerSameAsSpeaker` -- Ensure catalog coverage for all new UI text.
- `src/lib/i18n/catalogue-en.ts` -- Add English translations for the new keys -- Complete English dictionary.
- `src/lib/i18n/catalogue-id.ts` -- Add Indonesian translations for the new keys -- Complete Indonesian dictionary.
- `src/operator/CreateForm.tsx` -- Add `familyName` & `youthName` inputs; remove `shouldAutoFill` in `onSermonSpeakerChange`; add S6 Checkbox to copy speaker to closing prayer -- Wire UI controls according to form-fields specification.
- `src/operator/EditForm.tsx` -- Add `familyName` & `youthName` inputs; remove `shouldAutoFill` in `onSermonSpeakerChange`; add S6 Checkbox initialized via helper -- Wire UI controls and maintain state independence.
- `tests/worship-form-fields.test.mjs` -- Add tests for `shouldClosingPrayerCheckboxStartChecked` edge cases (both empty, matching, non-matching, whitespace) -- Verify pure business logic.
- `tests/worship-form-ui.test.mjs` -- Create test file verifying `shouldAutoFill` absence guard (scans CreateForm and EditForm for absence of `shouldAutoFill`), verifies `familyName` and `youthName` inputs exist in both forms, and verifies checkbox wiring -- Prevent regression and enforce absence guarantees.
- `package.json` -- Register `tests/worship-form-ui.test.mjs` in the `test` script -- Ensure all test suites run during `npm test`.

**Acceptance Criteria:**
- Given a Service creation form (`CreateForm.tsx`), when rendered, then it contains text inputs for `familyName` (above `familyPrayerRequest`) and `youthName` (above `youthPrayerRequest`).
- Given a Service edit form (`EditForm.tsx`), when loaded with existing `familyName` and `youthName`, then those values populate their respective inputs and survive saving and preview.
- Given `CreateForm.tsx` or `EditForm.tsx`, when inspecting source code, then zero references to `shouldAutoFill` exist.
- Given an operator entering a `sermonSpeaker` on either form, when typing, then `closingPrayerPerson` is not automatically modified or overwritten.
- Given `shouldClosingPrayerCheckboxStartChecked`, when passed empty strings for both speaker and closing prayer, then it returns `false`.
- Given `shouldClosingPrayerCheckboxStartChecked`, when passed identical non-empty names, then it returns `true`.
- Given the S6 checkbox on either form, when checked by the operator, then `sermonSpeaker` value is copied into `closingPrayerPerson`.

## Spec Change Log

_None._

## Review Triage Log

### 2026-08-21 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2: (high 0, medium 2, low 0)
- defer: 0
- reject: 10
- addressed_findings:
  - `[medium]` `[patch]` Added `fieldsRef.current` update in `onSermonSpeakerChange` and re-evaluated checkbox state via `shouldClosingPrayerCheckboxStartChecked` on hydrate/parse in `CreateForm` and `EditForm`.
  - `[medium]` `[patch]` Added `buildFieldsPayload` roundtrip test for `familyName` and `youthName` in `tests/worship-form-ui.test.mjs`.

## Design Notes

The both-empty decision: When both `sermonSpeaker` and `closingPrayerPerson` are empty strings (e.g. on new forms or unpopulated records), `shouldClosingPrayerCheckboxStartChecked` evaluates to `false`. Initializing to `false` ensures that the checkbox represents an affirmative, deliberate opt-in by the operator rather than an ambiguous default.

```typescript
export function shouldClosingPrayerCheckboxStartChecked(
  speaker: string | null | undefined,
  closing: string | null | undefined
): boolean {
  const s = (speaker ?? '').trim();
  const c = (closing ?? '').trim();
  if (!s || !c) return false;
  return s === c;
}
```

## Verification

**Commands:**
- `npm run lint` -- expected: Clean lint run with 0 errors.
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/worship-form-fields.test.mjs` -- expected: All unit tests pass.
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/i18n.test.mjs` -- expected: i18n keys and catalogues fully synchronized.
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/operator-shadcn-guard.test.mjs` -- expected: Shadcn primitives compliance.
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/worship-form-ui.test.mjs` -- expected: Absence guard and UI invariants pass.
- `npm test` -- expected: Full test suite passes without regressions.

## Auto Run Result

### Summary of implemented change
Added `familyName` and `youthName` inputs to the Family of the Week and Youth of the Week cards on both `CreateForm` and `EditForm`. Completely removed the silent `shouldAutoFill` logic so editing `sermonSpeaker` never mutates `closingPrayerPerson`. Added an explicit S6 copy `Checkbox` (`closingPrayerCopiesSpeaker`) that copies `sermonSpeaker` to `closingPrayerPerson` on demand, and initialized it on edit forms with the pure helper `shouldClosingPrayerCheckboxStartChecked`.

### Files changed
- `src/lib/worship-form-fields.ts`: Exported `shouldClosingPrayerCheckboxStartChecked` helper.
- `src/operator/CreateForm.tsx`: Added `familyName`/`youthName` inputs, removed `shouldAutoFill`, added S6 copy Checkbox.
- `src/operator/EditForm.tsx`: Added `familyName`/`youthName` inputs, removed `shouldAutoFill`, added S6 copy Checkbox initialized via helper.
- `src/lib/i18n/keys.ts`: Added string keys for new form labels, placeholders, and checkbox.
- `src/lib/i18n/catalogue-en.ts`: Added English translations for new keys and updated closing prayer placeholder.
- `src/lib/i18n/catalogue-id.ts`: Added Indonesian translations for new keys and updated closing prayer placeholder.
- `tests/worship-form-fields.test.mjs`: Added unit tests for `shouldClosingPrayerCheckboxStartChecked`.
- `tests/worship-form-ui.test.mjs`: Added AC-03 absence guard for `shouldAutoFill`, form input presence tests, and payload transformation assertions.
- `package.json`: Registered `tests/worship-form-ui.test.mjs` in the `test` script.
- `.control/registry/waves.yaml`: Stamped W4 epic/story metadata.

### Review findings breakdown
- Patches applied: 2 (medium 2, low 0)
- Items deferred: 0
- Items rejected: 10 (reactive continuous binding requests rejected per DEC-004 S6 one-off copy spec)
- Follow-up review recommendation score: 2 * 3 = 6 -> `false` (no high severity patches, within threshold)

### Verification performed
- `npm run lint` PASSED (0 errors)
- `node --import ./tests/register-ts-resolve.mjs --test --experimental-strip-types tests/worship-form-ui.test.mjs tests/worship-form-fields.test.mjs tests/i18n.test.mjs tests/operator-shadcn-guard.test.mjs tests/operator-i18n-guard.test.mjs` PASSED (39/39 tests pass)
- Injected `shouldAutoFill` reference into `CreateForm.tsx` to prove AC-03 absence guard: `tests/worship-form-ui.test.mjs` failed with `AssertionError: Found shouldAutoFill references in forms: src/operator/CreateForm.tsx:368 [shouldAutoFill-reference] const shouldAutoFill = false;`, then reverted and verified clean pass.
- `npm test` PASSED (644/644 tests pass, 0 failures across 62 suites)

### Residual risks
None. Fully backward-compatible and guarded by automated absence and invariant tests.
