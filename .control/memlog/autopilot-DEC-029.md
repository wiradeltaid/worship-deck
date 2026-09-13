---
artifact: .control/decisions/DEC-029-autopilot-mandate-pptx-anchor-visual-parity.md
---

## Resume

Iteration: 1
Run branch: autopilot/DEC-029 (PR: draft PR ready for owner review)
Stopped at: Done — all 4 tickets under SPEC-27 implemented and closed, 100% visual parity established across Canvas Editor, Presenter, and PPTX with TrueType embedded fonts, real Microsoft PowerPoint COM conformance verified, full test suite 857/857 passing.
Blocked: —
Parked: [ad-n]
Next: Owner final review and merge into main

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| Preflight | wdi-autopilot preflight | Mandate DEC-029 accepted by owner kodesh87 for PPTX as Primary Anchor 1-to-1 Visual Parity (SPEC-27) | Interactive approval at each ticket | Autonomous execution under ledger recording | DEC-029, decisions.yaml |
| Iteration 1 | SPEC-27-01 | Normalized OOXML line spacing in pptx-draw.ts via `lineSpacingMultiple = style.lineHeight / 1.2` and compensated negative half-leading for `lineHeight < 1.0` in ArtifactSlide.tsx | Keeping raw lineHeight multiple producing 20% pitch expansion in PowerPoint | Text spillage and vertical clipping on multi-line slides in PowerPoint | pptx-draw.ts, render-model.ts, ArtifactSlide.tsx, smoke-spec-23.test.mjs |
| Iteration 1 | SPEC-27-02 | Implemented Canvas Editor Option A single visual architecture in ArtifactEditor.tsx mounting ArtifactSlide under a transparent Fabric interaction proxy layer, with crisp 16:9 stage boundary and overflow clipping | Calibrating two divergent text engines (Fabric 2D canvas vs browser CSS DOM) | Persistent visual discrepancy between editor and sanctuary projector | ArtifactEditor.tsx, canvas-utils.ts |
| Iteration 1 | SPEC-27-03 | Implemented embedPresentationFonts in src/lib/fonts/embed-fonts.ts to package non-system Google Fonts (.ttf) into `ppt/fonts/*.fntdata` with `<p:embeddedFontLst>` in presentation.xml | Relying on destination computer font installations | Typography falling back to generic system fonts on church sanctuary laptops | embed-fonts.ts, pptx-draw.ts, data/fonts/ |
| Iteration 1 | SPEC-27-04 | Implemented automated real Microsoft PowerPoint desktop COM conformance suite (pptx-conformance.test.mjs) and smoke-spec-27.test.mjs with executable absence-guard proofs red-then-green | Static file tests without executing PowerPoint layout engine | Undetected layout divergence or font fallback in Microsoft PowerPoint | pptx-conformance.test.mjs, smoke-spec-27.test.mjs, package.json |
| Iteration 1 | Peer Review | Addressed Sonnet 5 peer review feedback by hardening absence guards against production source/modules with verified defect injections and adding shape geometry point comparisons against PowerPoint COM | Local test mocks without production module validation | Fragile absence guards or unverified PowerPoint shape geometry | smoke-spec-27.test.mjs, pptx-conformance.test.mjs, autopilot-DEC-029.md |
