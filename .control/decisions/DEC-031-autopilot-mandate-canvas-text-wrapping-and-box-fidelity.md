---
type: mandate
id: DEC-031
status: accepted
accepted_by: 'kodesh87 (2026-09-14)'
touches:
  - .control/memlog/autopilot-DEC-031.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-29-canvas-text-wrapping-and-box-fidelity/SPEC.md
supersedes: null
superseded_by: null
created: '2026-09-14'
---

# DEC-031 — Autopilot mandate for Canvas Text Whole-Word Wrapping, Box Fidelity & Safe Overflow Alignment (SPEC-29)

## Decision

> The owner grants an autonomous execution mandate to implement Canvas Text Whole-Word Wrapping, Box Fidelity & Safe Overflow Alignment under SPEC-29 (tickets SPEC-29-01 through SPEC-29-03), covering:
> 1) SPEC-29-01: Trusted whole-word wrap snapshots — pure exported validator/canonicalizer for `text` plus candidate `wrapLines` used in `serializeCanvas`, PPTX text resolution, and wrap line counting;
> 2) SPEC-29-02: Font-size commit and box coherence — keeping width as explicit author geometry while reconciling `handleFontSizeCommit`, `applyFabricTextFit`, live editor state, and serialization so the authored box and effective fitted text agree;
> 3) SPEC-29-03: Conditional safe vertical overflow — actual overflow detection in the browser text element and corresponding PPTX estimate branch, preserving middle/bottom alignment when fitting but top-anchoring when content overflows;
> carrying implementation through G5 Release with autonomous code execution, dual review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review),
> and automated smoke testing in the dedicated run branch `autopilot/DEC-031`.

## Why

Owner testing on 2026-09-14 identified layout failures with 180px text such as `Bandung\nInternational\nCommunity`, including character-level wrap fragmentation reaching PPTX, editor/persisted geometry mismatches, and CSS flex centering causing first-line ascender clipping. This mandate guarantees whole-word wrap validation across all serialization and rendering boundaries, explicit author width preservation, and safe vertical top-anchoring during overflow.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-031.md`).
Architectural invariants (AD-N) and public repo data cleanliness remain strictly preserved.
