# Review Packet: SPEC-46 Configurable Form Layout, Grouping Cards, and Predefined Fields

## 1. Drafted Spec and Ticket Paths
- Spec: `.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/SPEC.md`
- Tickets:
  - `.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/issues/01-schema-migration-and-adaptive-seeder-backend.md`
  - `.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/issues/02-dynamic-field-service-persistence-and-backfill-migration.md`
  - `.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/issues/03-dynamic-canvas-token-hydration-in-go-slide-plan.md`
  - `.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/issues/04-dynamic-regex-extraction-engine-for-fields-and-song-sets.md`
  - `.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/issues/05-dynamic-form-shell-and-card-grouping-engine-in-react.md`
  - `.scratch/SPEC-46-configurable-form-layout-and-predefined-fields/issues/06-admin-layout-builder-predefined-fields-management-and-regression-guards.md`

## 2. Original Raw Notes (Verbatim)
```
sekaligus diskusikan dengan composer dan terra, serta sonnet untuk membuat spek/tiket atas fitur2 yang sudah kita diskusikan, perhatikan jangan membuat broken apa yang sudah bagus.
```

Preceding discussion context from user:
- User dislikes current rigid rundown parsing and hardcoded form layout.
- Worship Presenter View (`RunSheetPage` / `EditForm`) should be where visual layout is managed.
- Fixed default layout:
  1. Rundown top-left textarea
  2. Live Slide Preview top-right panel (sticky)
  3. Below rundown: configurable area organized by Groupings (Cards)
- Predefined fields & dynamic items in groupings:
  1. Song books / song sets (dynamic, row input with book selector, hymn AC, background, lyrics editor, save-to-book, and its own configurable extraction regex for number and book).
  2. Announcement Set Weekly Slots (1..4 slots bindable into any grouping card).
  3. Predefined fields (text with length, text area with initial lines, image with standardized 3-column renderer).
  4. Regex extraction: Every text-based field (including song sets) has its own extraction regex configured by admin. Date and worship title remain hardcoded/standard.
  5. Seeder: `Seed Default Predefined Field` is adaptive/idempotent (fills gaps without overwriting user customization).
  6. Canvas Slide Hydration: Dynamic token `{variable_name}` replacement without hardcoded Go structs.
  7. Non-destructive: Do not break what is already good (zero regression on existing services, slide deck generation, PPTX export).

## 3. Declarations and Validator Output
- Component: `hub`
- Touches: `[services, db, hymns, slide-plan, artifacts]`
- Ticket dependency ordering: strictly directed chain: `01` -> `02` -> `03` -> `04` -> `05` -> `06`
- Preflight validator output:
  `parallel-tickets-blocked`: PASSED (0 findings)
  `review-trace`: 1 finding (`specs.yaml:SPEC-46: carries no reviewed trace with a date and sha` - awaiting this review pass)

## 4. Standing Reviewer Mandate (Advisory / Read-Only)
You are the independent advisory reviewer for this daily triage pass, not the implementer or author.
Review the named draft against the verbatim notes and the cited corpus only. Return a structured written assessment in markdown:
- **Verdict**: `accept` | `accept-with-changes` | `reject`
- **Findings**: numbered; categorized as `blocking` vs `non-blocking`
- **Notes vs Draft**: specific gaps, misinterpretations, or scope creep relative to raw notes
- **Stamp Recommendation**: lenses to use (must include `edge-case-hunter`), readiness for trace stamping, and blockers that must be resolved first

You MUST NOT edit, create, delete, rename, or mutate any repository file. You MUST NOT invoke `wdi-review`, MUST NOT write `spec_reviewed` in `specs.yaml`, and MUST NOT modify frontmatter. Stamping is the coordinator's sole responsibility upon folding your feedback; this dispatch is advisory feedback only.
