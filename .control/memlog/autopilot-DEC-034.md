---
artifact: .control/decisions/DEC-034-autopilot-mandate-pptx-import-font-adoption-letter-spacing.md
---

## Resume

Iteration: 1
Run branch: autopilot/DEC-034
Stopped at: Done — all 4 tickets under SPEC-32 implemented, verified, and closed; DrawingML typography normalization and spc-to-letterSpacing conversion in internal/pptximport; durable font face persistence in internal/httpapi with DoS bounds and dedicated GET /api/fonts/{id} route; full-stack letter spacing in DOM, Fabric canvas, ArtifactEditor toolbar, and deterministic OOXML post-processing in pptx-draw.ts; comprehensive automated smoke suite in tests/smoke-spec-32.test.mjs, internal/pptximport/typography_test.go, and internal/httpapi/fonts_test.go; dual review completed with kiro-cli gpt-5.6-terra peer review and all 10 findings resolved.
Blocked: —
Parked: [ad-n]
Next: Owner final review and merge into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| Preflight | wdi-autopilot preflight | Mandate DEC-034 accepted by owner kodesh87 for PPTX Import Typography Parity, Embedded Font Adoption, and Letter Spacing (SPEC-32) | Manual typographical adjustments | Autonomous execution under ledger recording | DEC-034, decisions.yaml |
| Iteration 1 | SPEC-32-01 | Implemented DrawingML typeface normalization in `internal/pptximport/typography.go` supporting compound suffixes, numeric CSS weights 100..900, explicit XML b/i precedence, unrounded spc to letterSpacing (spc / 75), DrawingML property inheritance across defRPr/endParaRPr/rPr, and mixed-run typography warnings | Boolean bold approximation or arbitrary word stripping | Weight reduction from 300/900 to 400/700 and font collapsing | internal/pptximport |
| Iteration 1 | SPEC-32-02 | Implemented embedded font extraction in `internal/pptximport/font_extract.go` resolving local font relationships, de-obfuscating standard GUID keys, strictly validating TTF/OTF table directory bounds, enforcing 16 MiB per face and 64 MiB cumulative limits, persisting font faces in SQLite `font_faces` with content_hash deduplication, and serving via authenticated `GET /api/fonts/{id}` with MIME and nosniff | Ignoring embedded PPTX fonts or exposing unvalidated font binaries | Loss of deck typography on reload or remote code execution via malformed fonts | internal/pptximport, internal/httpapi |
| Iteration 1 | SPEC-32-03 | Implemented tracking across all surfaces: Fabric `charSpacing = (letterSpacing / fontSize) * 1000`, ArtifactSlide DOM rendering with `em` units, ArtifactEditor 0.5px step input, automatic `pptxTypeface` invalidation on family/weight/style edit, and sequential-index OOXML run patching setting `a:rPr/@spc = round(letterSpacing * 75)` | Broad XML replacement or undocumented PptxGenJS options | Content collisions across identical text elements and tracking drift | src/lib/registry, src/components, src/lib/pptx-draw.ts |
| Iteration 1 | SPEC-32-04 | Implemented automated smoke suite `tests/smoke-spec-32.test.mjs`, Go unit and integration tests, executable absence guards for pptxTypeface invalidation, and resolved all 10 peer review findings from `kiro-cli` (`gpt-5.6-terra`) | Skipping peer review or visual/OOXML proof | Hidden regressions in font inheritance or promotion rollback | tests/smoke-spec-32.test.mjs, internal/pptximport, internal/httpapi |
