---
artifact: .control/decisions/DEC-038-autopilot-mandate-font-import-variant-association-pptx-embedding.md
---

# Autopilot Ledger — DEC-038

## Resume

- Iteration: 4 (final)
- Run branch: autopilot/DEC-038
- Stopped at: Done (mandate applied, all FR-20 tickets in SPEC-36 closed and verified green)
- Blocked: —
- Parked: —
- Next: Finish — owner merges PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-1 (start) | mandate | Start autopilot mandate DEC-038 for SPEC-36 | waiting for interactive dispatch | low | .control/decisions/DEC-038-autopilot-mandate-font-import-variant-association-pptx-embedding.md |
| I-2 (T-36-01) | ArtifactEditor / font-catalog | Add reusable Font Import in Toolbar Row 1 and Popover header with multi-file input reset, custom category priority, case-insensitive one-family rule, text-only apply guard, and localized progress feedback | single unacquired-only button with hardcoded text | medium | src/components/admin/ArtifactEditor.tsx, src/lib/registry/font-catalog.ts, tests/smoke-spec-36.test.mjs |
| I-2 (peer-review) | font-catalog / ArtifactEditor | Prevent catalog mutation on FontFace load failure, guard toolbar state on selection shift, and enforce text-only element updates (Terra review) | allowing unhydrated fonts into catalog | medium | src/lib/registry/font-catalog.ts, src/components/admin/ArtifactEditor.tsx |
| I-3 (T-36-02) | backend & font-catalog | Implement SFNT & OS/2 metadata parsing, case-insensitive (family, weight, style) conflict & transactional replacement, migration safety, and variant badges in editor | naive filename grouping and unconstrained duplicates | high | internal/httpapi/fonts.go, internal/pptximport/font_extract.go, internal/db/migrate.go, src/lib/registry/font-catalog.ts, src/components/admin/ArtifactEditor.tsx |
| I-3 (peer-review) | backend & DB | Canonicalize case across all three columns, protect PPTX import from unique collisions, and replace browser FontFace cleanly on URL change (Terra review) | crash on PPTX import or stale browser font cache | high | internal/httpapi/fonts.go, internal/httpapi/pptx_import.go, internal/db/migrate.go, src/lib/registry/font-catalog.ts |
| I-4 (T-36-03) | embed-fonts & pptx-draw | Package fonts with ECMA-376 Part 2 §8.5.2 key derivation & XOR obfuscation under ppt/fonts/{GUID}.odttf, register standard MIME type, map represented variant slots (<p:regular>, <p:bold>, <p:italic>, <p:boldItalic>), and preserve exact usage triples | legacy .fntdata and fabricated regular slot | high | src/lib/fonts/embed-fonts.ts, src/lib/pptx-draw.ts, tests/smoke-spec-27.test.mjs, tests/smoke-spec-36.test.mjs |
| I-4 (peer-review) | embed-fonts & tests | Enforce notesSz < embeddedFontLst < defaultTextStyle schema sequence, merge existing embedded font lists, eliminate loose manifest variant fallback, and add deobfuscation roundtrip proofs (Terra review) | schema sequence corruption in PowerPoint or wrong face slot | high | src/lib/fonts/embed-fonts.ts, src/lib/pptx-draw.ts, internal/httpapi/fonts_test.go, tests/smoke-spec-36.test.mjs |
