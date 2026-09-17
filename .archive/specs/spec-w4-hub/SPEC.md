---
id: SPEC-w4-hub
companions:
  - ../../../.what/hub/SRS-hub.md
  - ../../../.how/hub/SDD-hub.md
  - ../../../.how/hub/05-model/form-fields.md
  - ../../../.what/registry/04-usecases/UC-20-deck-matches-payload.md
  - ../../../.control/decisions/DEC-004-nested-artifact-registries.md
  - ../../../.constitution/project/codebase-stack-guide.md
sources:
  - ../../../.control/registry/requirements.yaml
  - ../../../.control/registry/usecases.yaml
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.
>
> **Projection, not authorship.** This file projects `.what/hub/`, `.how/hub/` and DEC-004 onto wave W4. It introduces no `FR`, `UC`, `BR` or `AD`. A gap found while building is landed in the corpus by the skill that owns that layer — never patched in here.

# W4 × Hub — FR-6: Family/Youth name inputs and the S6 closing-prayer checkbox

## Why

**A pain to solve, and a defect to remove.**

DEC-004 Supplement S1 split the old combined text into a name and a request: `family_name` +
`family_request`, `youth_name` + `youth_request`. The request halves have inputs on the Service form.
The name halves do not. Their catalog keys exist, their weekly storage exists, and both hydrate paths
read them — all of that landed in `f393bfd` — so a slide authored with `{family_name}` resolves
correctly to an empty string every single week, because there is no field anywhere for the Operator to
put a name in. The deck promises a name it can never be told.

Separately, S6 says the Closing Prayer person stays its own field and the form gains **a checkbox that
copies the sermon speaker into it**. What the form actually does today is copy silently: `shouldAutoFill`
overwrites `closingPrayerPerson` whenever the sermon speaker changes. An Operator who types a
different name for the closing prayer, then corrects the speaker's spelling, loses what they typed and
is not told. That is the opposite of what S6 asks for, and it destroys entered data.

## Capabilities

- **CAP-2**
  - **intent:** Operator can enter every weekly variable value the Deck renders, and nothing the form
    does overwrites a value they entered.
  - **success:** The `FR-6` proof of done holds for Family and Youth: a name typed on the Service form
    appears on the Family & Youth slide of the generated deck, through both the preview and the PPTX.
    Copying the sermon speaker into the closing-prayer person happens only when the Operator asks for
    it, and never as a side effect of editing another field.

## Constraints

- **Storage is already built; do not rebuild it.** `familyName` and `youthName` exist in
  `WorshipFormFields`, in `structuredKeys`, in both parsed-data structs, and in both hydrate paths as of
  `f393bfd`. This wave adds inputs and request-body wiring. Read the field names from
  `src/lib/worship-form-fields.ts` rather than inventing them.
- **The values MUST reach all three request bodies** — create, update, **and** preview. A field that
  reaches create but not preview makes the Live Slide Preview lie about the deck the Operator is about
  to generate.
- **Both name fields start empty on a parsed rundown.** S1 is explicit that the legacy combined
  `familyYouth` text cannot be split automatically; it stays in `family_request` and is cleaned up by
  hand. No backfill, no migration, and no guessing a name out of the parse.
- **The checkbox is the only copy path.** Unchecked means nothing writes to `closingPrayerPerson`
  except the Operator. The `shouldAutoFill` machinery goes; leaving it behind alongside a checkbox
  would mean two writers for one field.
- **The copy fires once, at check time.** Checking the box writes the sermon speaker into the
  closing-prayer person then; it does not track the speaker afterwards, so editing the speaker later
  leaves the closing-prayer person as it stands. Unchecking the box leaves the copied value in place
  rather than reverting it — the Operator remains the field's only other writer.
- **The edit form infers the checkbox from stored values** — checked only when the stored closing-prayer
  person already equals the stored sermon speaker, and **unchecked when both are empty**, so a fresh
  Service does not present a link the Operator never asked for. The rule lives in
  `shouldClosingPrayerCheckboxStartChecked` as a pure function so it is testable on its own.
- **Card order stays as `form-fields.md` states it**: Bible Talk → Divine Worship → Sermon → Family of
  the Week → Youth of the Week. Each name sits with its own request, above it, because that is the
  reading order of the slide it fills.
- **The repo-wide build rules apply, from `.constitution/project/codebase-conventions-guide.md` and the
  guards under `tests/`, and are not restated here.** One is worth naming because it bit W3 twice: an
  absence criterion needs a guard that scans what it claims, proved by injecting the defect.
- **The checkbox primitive is `src/components/ui/checkbox.tsx`** — this wave's only new UI primitive.
- **The corpus is not the builder's to change.** No worker edits `.what/`, `.how/`, or an `applied`
  `DEC-`. A deviation is reported and becomes a `DEC-` through `wdi-decision`.

## Non-goals

- **Any change to the predefined-field catalog.** S1's keys were completed in `f393bfd`; this wave
  consumes them.
- **Splitting the legacy `familyYouth` text.** Named as manual cleanup by S1 itself.
- **The Registry side of `dec004-completion`.** That is W3.

## Success signal

An Operator preparing Sabbath types the family's name and the youth's name once, sees both on the
Family & Youth slide in the Live Slide Preview, and downloads a PPTX carrying them. Later they correct
the sermon speaker's spelling and the closing-prayer name they typed earlier is still exactly what they
typed.

## Open Questions

- Nothing blocking. One bound is deferred rather than invented: neither name field carries a length
  limit while sibling fields are bounded 1–120 — filed as OQ-46.
