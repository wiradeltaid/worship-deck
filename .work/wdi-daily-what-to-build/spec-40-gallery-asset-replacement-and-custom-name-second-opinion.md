# Review Packet: SPEC-40 — Gallery Asset In-Place Replacement, Category Reconciliation, and Ergonomic Custom Naming

## 1. Drafted Spec & Tickets Under Review
- Spec path: `.scratch/SPEC-40-gallery-asset-replacement-and-custom-name/SPEC.md`
- Tickets:
  - `.scratch/SPEC-40-gallery-asset-replacement-and-custom-name/issues/01-schema-migration-replace-api-and-category-reconciliation.md`
  - `.scratch/SPEC-40-gallery-asset-replacement-and-custom-name/issues/02-gallery-input-ergonomics-category-badging-and-replace-ui.md`
  - `.scratch/SPEC-40-gallery-asset-replacement-and-custom-name/issues/03-canvas-editor-picker-alignment-and-smoke-tests.md`
- Registry configuration: `.control/registry/specs.yaml` (entry `SPEC-40`)

## 2. Original Raw Notes (Verbatim & Unedited)
```
replace image di gallery, tapi mempertahankan id/slug path, tujuannya agar kita gak perlu lagi ubah2 yang sudah ada di main deck (sequence), udah terhubung langsung karena sebelumnya sudah terhubung. Tinggal replace.

Lalu juga typenya:
General
Background
Announcement -> rename dari flyer

Flyer gak ada disini, pasti ditaruh di announcement secara situasional.

Lalu cara inputnya juga kurang pas, kenapa typenya terlalu jauh dari input box, begitu juga tombol uploadnya. Dan mana type yang terpilih juga gak kelihatan bedanya. Satu lagi, image ini bisa direname harusnya, agar ada custom name.
```

## 3. Structural & Validator Context
- Component: `registry`
- Touches: `[uploads, db]` for 01; `[artifacts, uploads]` for 02; `[artifacts]` for 03.
- Dependencies: `02` blocked by `01`; `03` blocked by `02`.
- Preflight validator output:
```
RED — 1 findings across 1 validators
  review-trace specs.yaml:SPEC-40: carries no `reviewed` trace with a date and sha
```
(No `parallel-tickets-blocked` or schema conflicts found).

## 4. Standing Mandate for Reviewer
You are the independent advisory reviewer for this daily triage pass, not the implementer or author.
Review the named draft against the verbatim notes and the cited corpus only. Return a structured written
assessment in markdown:
- **Verdict**: `accept` | `accept-with-changes` | `reject`
- **Findings**: numbered; categorized as `blocking` vs `non-blocking`
- **Notes vs Draft**: specific gaps, misinterpretations, or scope creep relative to raw notes
- **Stamp Recommendation**: lenses to use (must include `edge-case-hunter`), readiness for trace stamping,
  and blockers that must be resolved first

You MUST NOT edit, create, delete, rename, or mutate any repository file. You MUST NOT invoke `wdi-review`,
MUST NOT write `spec_reviewed` in `specs.yaml`, and MUST NOT modify frontmatter. Stamping is the
coordinator's sole responsibility upon folding your feedback; this dispatch is advisory feedback only.
