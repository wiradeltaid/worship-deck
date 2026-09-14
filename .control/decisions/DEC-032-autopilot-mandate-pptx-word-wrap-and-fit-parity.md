---
type: mandate
id: DEC-032
status: applied
accepted_by: 'kodesh87 (2026-09-14)'
touches:
  - .control/memlog/autopilot-DEC-032.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-30-pptx-word-wrap-and-fit-parity/SPEC.md
  - src/lib/artifacts/render-model.ts
  - src/lib/pptx-draw.ts
  - tests/smoke-spec-30.test.mjs
  - tests/smoke-spec-23.test.mjs
  - tests/pptx-content.test.mjs
  - package.json
supersedes: null
superseded_by: null
created: '2026-09-14'
---

# DEC-032 — Autopilot mandate for PPTX Whole-Word Fallback Wrapping and Fit Parity (SPEC-30)

## Decision

> The owner grants an autonomous execution mandate to implement PPTX Whole-Word Fallback Wrapping and Fit Parity under SPEC-30 (tickets SPEC-30-01 through SPEC-30-03), covering:
> 1) SPEC-30-01: Shared deterministic token-width fallback and line partitioner — shared headless character-advance token measurement and line partitioner for unmeasured or invalidated text elements, deriving fallback scale and line count;
> 2) SPEC-30-02: Coupled scale-and-wrap loop — iterative reconciliation of line count and effective scale, bounded by iteration limits, with floor preservation and top-anchoring residual overflow policy;
> 3) SPEC-30-03: PPTX DrawingML soft-break emission and headless regression harness — emitting `softBreakBefore` (`<a:br/>`) between whole tokens while strictly preserving explicit `\n` paragraphs as DrawingML paragraph boundaries (`<a:p>`), backed by comprehensive headless test suites and absence-guards;
> carrying implementation through G5 Release with autonomous code execution, dual review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review),
> and automated smoke testing in the dedicated run branch `autopilot/DEC-032`.

## Why

Owner testing on 2026-09-14 confirmed that large unmeasured text (e.g. 180px text without trusted `wrapLines` or matching `longestWordPx`) wraps whole words on web Canvas and Presenter but is character-fragmented by PowerPoint export (`Bandung / internationa / l community`). This mandate establishes a shared deterministic fallback layout contract in `render-model.ts` and `pptx-draw.ts` so PowerPoint emits whole-token soft breaks matching browser behavior without character truncation.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-032.md`).
Architectural invariants (AD-N) and public repo data cleanliness remain strictly preserved.
