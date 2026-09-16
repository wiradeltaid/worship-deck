---
artifact: .control/decisions/DEC-039-autopilot-mandate-font-availability-parity-unacquired-status-reconciliation.md
---

# Autopilot Ledger — DEC-039

## Resume

- Iteration: 4 (final)
- Run branch: autopilot/DEC-039
- Stopped at: Done (mandate applied, all FR-20 tickets in SPEC-37 closed and verified green)
- Blocked: —
- Parked: —
- Next: Finish — owner merges PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-1 (start) | mandate | Start autopilot mandate DEC-039 for SPEC-37 | waiting for interactive dispatch | low | .control/decisions/DEC-039-autopilot-mandate-font-availability-parity-unacquired-status-reconciliation.md |
| I-2 (T-37-01) | ArtifactEditor & pptx_import | Decouple unacquired badge from stale property, reconcile live element fontStatus on batch upload and template mount, and recognize pre-imported SQLite fonts during PPTX import | leaving stale false unacquired warnings on canvas and imported templates | medium | src/components/admin/ArtifactEditor.tsx, internal/httpapi/pptx_import.go, internal/httpapi/pptx_import_test.go, tests/smoke-spec-37.test.mjs |
| I-2 (peer-review) | ArtifactEditor & pptx_import | Match both family and source_typeface case-insensitively against SQLite, clean up slide/result aggregate warnings, preserve exact text-only guard pattern for T-36-Absence-Guard 4, and add end-to-end HTTP behavioral test (Terra review) | missing source_typeface matches or regression in T-36 absence guard | high | src/components/admin/ArtifactEditor.tsx, internal/httpapi/pptx_import.go, internal/httpapi/pptx_import_test.go, tests/smoke-spec-37.test.mjs |
| I-3 (T-37-02) | App, Operator, Projector & font-catalog | Implement single-flight promise deduplication in hydrateImportedFonts(), boot hydration in App.tsx, and mount hydration in PresenterOperator and ProjectorClient | redundant network queries on multi-context mount and unhydrated projector window | medium | src/lib/registry/font-catalog.ts, spa/src/App.tsx, src/operator/present/PresenterOperator.tsx, src/projected/ProjectorClient.tsx, tests/smoke-spec-37.test.mjs |
| I-3 (peer-review) | font-catalog & tests | Register FontFace in document.fonts before awaiting load() so browser emits loadingdone lifecycle event, add Playwright event probe proof, and clean up EOF whitespace (Terra review) | missing automatic text refit in ArtifactSlide upon dynamic font hydration | high | src/lib/registry/font-catalog.ts, tests/smoke-spec-37.test.mjs |
| I-4 (T-37-03) | embed-fonts & pptx-draw | Canonicalize typeface resolution across DrawingML and usedFonts using resolveFontFamily(), add license-aware fallback embedding preferring regular face, and respect restricted fonts | silent font substitution in PowerPoint Desktop or missing embedded variants | high | src/lib/fonts/embed-fonts.ts, src/lib/pptx-draw.ts, tests/smoke-spec-37.test.mjs |
| I-4 (peer-review) | fonts.go, embed-fonts & tests | Include SourceTypeface in FontManifestEntry, skip catalog fall-through when all manifest candidates are restricted, and add end-to-end generatePptxFromPlan typeface parity assertion (Terra review) | missing sourceTypeface in worker manifest and illegal catalog font embedding | high | internal/httpapi/fonts.go, src/lib/fonts/embed-fonts.ts, tests/smoke-spec-37.test.mjs |
