---
artifact: .control/decisions/DEC-042-daily-autopilot-mandate-continuous-engineering-routine.md
---

# Autopilot Ledger — DEC-042

## Resume

- Iteration: 2
- Run branch: autopilot/DEC-042
- Stopped at: Ticket SPEC-39-02 closed and verified green across test suites
- Blocked: —
- Parked: —
- Next: Iteration 3 — implement Ticket SPEC-39-03 (Dynamic announcement placeholders and weekly service hydration)

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-0 (start) | mandate | Start daily autopilot mandate DEC-042 for SPEC-39 continuous engineering routine | waiting for interactive dispatch | low | .control/decisions/DEC-042-daily-autopilot-mandate-continuous-engineering-routine.md |
| I-1 (SPEC-39-01) | media-gallery & ArtifactEditor | Provide categorized media library API, embed Media Gallery in RegistryAdmin, and integrate gallery picker into ArtifactEditor with missing asset fallbacks | duplicate uploads or broken historical decks | medium | internal/httpapi/background_library.go, src/components/admin/ArtifactEditor.tsx, src/components/admin/BackgroundLibraryPanel.tsx, src/components/artifacts/ArtifactSlide.tsx, tests/smoke-spec-39.test.mjs |
| I-1 (peer-review) | httpapi, ArtifactSlide & tests | Preserve isDefault on category-only PATCH, reset loadFailed on imageUrl change, and expand absence guard defect injection to openGalleryDialog with behavioral tests (Terra review) | unexpected global default mutations, sticky broken image states, or incomplete absence guards | high | internal/httpapi/background_library.go, src/components/artifacts/ArtifactSlide.tsx, tests/smoke-spec-39.test.mjs |
| I-2 (SPEC-39-02) | PresenterOperator & presenter-model | Implement section-bounded announcement carousel loop with interval selector, boundary wrap, and manual override disarm guards | manual repetitive clicking or global deck wrap into liturgy | medium | src/operator/present/presenter-model.ts, src/operator/present/PresenterOperator.tsx, tests/smoke-spec-39.test.mjs |
| I-2 (peer-review) | PresenterOperator & tests | Disarm loop on remote session navigation, synchronously reset isLoopingRef to prevent stale timer races, and add defect injection for manual override disarm (Terra review) | remote operator loop overrides, stale timer advance race, or untested disarm guards | high | src/operator/present/PresenterOperator.tsx, tests/smoke-spec-39.test.mjs |
