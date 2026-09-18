---
artifact: .control/decisions/DEC-043-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-043

## Resume

- Iteration: 3 (final)
- Run branch: autopilot/DEC-043 (Draft PR #80: https://github.com/wiradeltaid/worship-presenter-web/pull/80)
- Stopped at: Done (mandate applied, all tickets in SPEC-40, SPEC-41, and SPEC-42 closed and verified green across all test suites)
- Blocked: —
- Parked: —
- Next: Finish — owner merges PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-043 for continuous engineering routine (SPEC-40, SPEC-41, SPEC-42) | waiting for interactive dispatch | low | .control/decisions/DEC-043-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-1 (SPEC-40-01) | media-library & schema | Add name column, migrate flyer to announcement, and implement atomic in-place replace API preserving URL and ID | re-uploading and breaking connected slide links | high | internal/db/schema.sql, internal/db/migrate.go, internal/httpapi/background_library.go, internal/httpapi/uploads.go, src/lib/db/index.ts |
| I-1 (peer-review) | httpapi & tests | Enforce strict /api/uploads/ hex filename validation, acquire DB CAS lock before disk rename to eliminate race conditions, and normalize legacy flyer rows on PATCH (Terra review) | directory traversal vulnerabilities, race-condition file overwrites on 409 conflict, or un-migrated flyer rows | high | internal/httpapi/background_library.go, internal/httpapi/background_library_test.go |
| I-1 (SPEC-40-02) | BackgroundLibraryPanel | Implement high-contrast category badges, custom name input on upload, inline rename, and in-place replacement with instant cache-busting | low-contrast category tabs and manual re-linking of slide assets | medium | src/components/admin/BackgroundLibraryPanel.tsx, src/lib/i18n/keys.ts, src/lib/i18n/catalogue-en.ts, src/lib/i18n/catalogue-id.ts |
| I-1 (SPEC-40-03) | ArtifactEditor & smoke | Align gallery picker categories to announcement, render custom names on thumbnails, and verify end-to-end with smoke tests and defect injection | mismatched picker categories or broken custom name visibility | medium | src/components/admin/ArtifactEditor.tsx, src/lib/registry/canvas-adapters.ts, tests/smoke-spec-40.test.mjs, tests/smoke-spec-39.test.mjs |
| I-2 (SPEC-41-01) | slide-plan & runtime-contract | Emit structured group nodes for ann-set-marker with collision-safe IDs, unique child IDs, and strictly typed role union | flat ungrouped announcement slides and colliding repeated markers | high | src/lib/artifacts/runtime-contract.ts, src/lib/artifacts/preview-model.ts, src/lib/slide-plan.ts, internal/plan/plan.go, internal/plan/snapshot.go, internal/plan/types.go |
| I-2 (peer-review) | plan & presenter-model | Type GroupRole enum in Go, prioritize role over convention in groupKind detection, and add dark-theme contrast defect injection proof (Terra review) | untyped string roles in Go, brittle ID-pattern group discrimination, or untested contrast floors | high | internal/plan/types.go, internal/plan/plan.go, src/operator/present/presenter-model.ts, src/components/SlidePreviewList.tsx, tests/smoke-spec-41.test.mjs |
| I-2 (SPEC-41-02) | PresenterOperator | Implement dynamic group header badging for announcement vs song-set with purple tone and indented child slides | hardcoding Song Set badge for announcement groups or flat list | medium | src/operator/present/PresenterOperator.tsx, src/operator/present/presenter-model.ts, tests/presenter-model.test.mjs |
| I-2 (SPEC-41-03) | SlidePreviewList & smoke | Group announcement sets with [Announcement] header and theme-safe contrast, and verify with smoke tests and defect injection | mismatched preview structure or illegible badges in dark theme | medium | src/components/SlidePreviewList.tsx, tests/smoke-spec-41.test.mjs, tests/announcement-sets.test.mjs |
| I-3 (SPEC-42-01) | ArtifactEditor & i18n | Expose unconditional per-row delete button for song set slides in deck sequence with informative confirmation copy | inability to delete song set slides from main spine or confusing delete warnings | medium | src/components/admin/ArtifactEditor.tsx, src/lib/i18n/keys.ts, src/lib/i18n/catalogue-en.ts, src/lib/i18n/catalogue-id.ts |
| I-3 (peer-review) | smoke & tests | Strengthen regex absence guard in smoke-spec-42 to verify entire button block without baseType suppression (Terra review) | understated absence guard proofs or undetected conditional regressions | high | tests/smoke-spec-42.test.mjs |
| I-3 (SPEC-42-02) | song-set-entries & smoke | Verify exact master data invariance and multi-instance independence on deck sequence deletion via Go and Node smoke suites | accidental master catalog mutations when adjusting slide order | high | internal/httpapi/song_set_entries_test.go, tests/smoke-spec-42.test.mjs, package.json |
