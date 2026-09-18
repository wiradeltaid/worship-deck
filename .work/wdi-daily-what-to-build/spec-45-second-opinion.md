# Advisory Review Packet — SPEC-45 Triage

## 1. Drafted Specification & Tickets
- Spec path: `.scratch/SPEC-45-announcement-slot-layout-and-upload-persistence/SPEC.md`
- Tickets path: `.scratch/SPEC-45-announcement-slot-layout-and-upload-persistence/issues/`
  - `01-operator-runsheetpage-announcement-inserts-hydration-fix.md`
  - `02-single-row-announcement-slot-input-layout.md`
  - `03-end-to-end-persistence-smoke-verification-and-absence-guards.md`

## 2. Original Raw Notes (Verbatim)
```
announcement slot itu harusnya jangan berbentuk 2 item per baris, tapi 1 item per baris
sekarang upload announcement kenapa seperti tidak tersave?
```

## 3. Touches & Blocked By Declarations
- `SPEC-45-01`:
  - Component: `hub`
  - Satisfies: `[UC-4, UC-5]`
  - Touches: `[services]`
  - Blocked By: `[]`
- `SPEC-45-02`:
  - Component: `hub`
  - Satisfies: `[UC-4]`
  - Touches: `[services]`
  - Blocked By: `["SPEC-45-01"]`
- `SPEC-45-03`:
  - Component: `hub`
  - Satisfies: `[UC-4, UC-5]`
  - Touches: `[services]`
  - Blocked By: `["SPEC-45-02"]`

## 4. Preflight Validator Output
```
RED — 1 findings across 1 validators
  review-trace specs.yaml:SPEC-45: carries no `reviewed` trace with a date and sha
(parallel-tickets-blocked: clean, 0 findings)
```

## 5. Reviewer Mandate (Strictly Advisory / Read-Only)
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
