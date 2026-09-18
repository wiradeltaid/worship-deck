---
artifact: .control/decisions/DEC-043-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-043

## Resume

- Iteration: 1
- Run branch: autopilot/DEC-043
- Stopped at: Done (SPEC-40 gallery asset replacement, custom name, and category reconciliation closed)
- Blocked: —
- Parked: —
- Next: Iteration 2 — SPEC-41 announcement set hierarchy and grouping

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-043 for continuous engineering routine (SPEC-40, SPEC-41, SPEC-42) | waiting for interactive dispatch | low | .control/decisions/DEC-043-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-1 (SPEC-40-01) | media-library & schema | Add name column, migrate flyer to announcement, and implement atomic in-place replace API preserving URL and ID | re-uploading and breaking connected slide links | high | internal/db/schema.sql, internal/db/migrate.go, internal/httpapi/background_library.go, internal/httpapi/uploads.go, src/lib/db/index.ts |
| I-1 (peer-review) | httpapi & tests | Enforce strict /api/uploads/ hex filename validation, acquire DB CAS lock before disk rename to eliminate race conditions, and normalize legacy flyer rows on PATCH (Terra review) | directory traversal vulnerabilities, race-condition file overwrites on 409 conflict, or un-migrated flyer rows | high | internal/httpapi/background_library.go, internal/httpapi/background_library_test.go |
| I-1 (SPEC-40-02) | BackgroundLibraryPanel | Implement high-contrast category badges, custom name input on upload, inline rename, and in-place replacement with instant cache-busting | low-contrast category tabs and manual re-linking of slide assets | medium | src/components/admin/BackgroundLibraryPanel.tsx, src/lib/i18n/keys.ts, src/lib/i18n/catalogue-en.ts, src/lib/i18n/catalogue-id.ts |
| I-1 (SPEC-40-03) | ArtifactEditor & smoke | Align gallery picker categories to announcement, render custom names on thumbnails, and verify end-to-end with smoke tests and defect injection | mismatched picker categories or broken custom name visibility | medium | src/components/admin/ArtifactEditor.tsx, src/lib/registry/canvas-adapters.ts, tests/smoke-spec-40.test.mjs, tests/smoke-spec-39.test.mjs |
