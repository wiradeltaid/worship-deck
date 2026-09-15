---
artifact: .control/decisions/DEC-038-autopilot-mandate-font-import-variant-association-pptx-embedding.md
---

# Autopilot Ledger — DEC-038

## Resume

- Iteration: 3
- Run branch: autopilot/DEC-038
- Stopped at: Done (T-36-02 closed, tested green, peer reviewed with Terra revisions applied)
- Blocked: —
- Parked: —
- Next: SPEC-36-03 — ECMA-376 font obfuscation, OpenXML face-slot packaging, and executable plus PowerPoint Desktop conformance proof

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-1 (start) | mandate | Start autopilot mandate DEC-038 for SPEC-36 | waiting for interactive dispatch | low | .control/decisions/DEC-038-autopilot-mandate-font-import-variant-association-pptx-embedding.md |
| I-2 (T-36-01) | ArtifactEditor / font-catalog | Add reusable Font Import in Toolbar Row 1 and Popover header with multi-file input reset, custom category priority, case-insensitive one-family rule, text-only apply guard, and localized progress feedback | single unacquired-only button with hardcoded text | medium | src/components/admin/ArtifactEditor.tsx, src/lib/registry/font-catalog.ts, tests/smoke-spec-36.test.mjs |
| I-2 (peer-review) | font-catalog / ArtifactEditor | Prevent catalog mutation on FontFace load failure, guard toolbar state on selection shift, and enforce text-only element updates (Terra review) | allowing unhydrated fonts into catalog | medium | src/lib/registry/font-catalog.ts, src/components/admin/ArtifactEditor.tsx |
| I-3 (T-36-02) | backend & font-catalog | Implement SFNT & OS/2 metadata parsing, case-insensitive (family, weight, style) conflict & transactional replacement, migration safety, and variant badges in editor | naive filename grouping and unconstrained duplicates | high | internal/httpapi/fonts.go, internal/pptximport/font_extract.go, internal/db/migrate.go, src/lib/registry/font-catalog.ts, src/components/admin/ArtifactEditor.tsx |
| I-3 (peer-review) | backend & DB | Canonicalize case across all three columns, protect PPTX import from unique collisions, and replace browser FontFace cleanly on URL change (Terra review) | crash on PPTX import or stale browser font cache | high | internal/httpapi/fonts.go, internal/httpapi/pptx_import.go, internal/db/migrate.go, src/lib/registry/font-catalog.ts |
