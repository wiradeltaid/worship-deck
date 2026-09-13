---
type: mandate
id: DEC-026
status: applied
accepted_by: 'kodesh87 (2026-09-12)'
touches:
  - .control/memlog/autopilot-DEC-026.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - src/components/admin/ArtifactEditor.tsx
  - src/lib/registry/canvas-utils.ts
  - tests/smoke-spec-24.test.mjs
  - package.json
  - .scratch/SPEC-24-canvas-healing-persistence-isolation/SPEC.md
supersedes: null
superseded_by: null
created: '2026-09-12'
---

# DEC-026 — Autopilot mandate for Canvas Healing Dirty-State & Persistence Isolation (SPEC-24)

## Decision

> The owner grants an autonomous execution mandate to implement Canvas Healing Dirty-State & Persistence Isolation under SPEC-24 (tickets SPEC-24-01 through SPEC-24-04), covering:
> 1) Decoupling background healing from navigation guard: removing `markDirty()` on mount when unmeasured elements are detected, ensuring clean navigation across slides without spurious discard confirmation dialogs,
> 2) Resetting healing ref on user interactions: introducing atomic `markUserDirty()` to reset `isHealingOnlyRef.current = false` across all canvas mutations and direct editor controls,
> 3) Non-destructive canvas serialization: ensuring `serializeCanvas` preserves user-edited coordinates (`x`, `y`), content, and typography styles even during healing saves, while maintaining height and zIndex preservation for untouched elements,
> 4) Comprehensive automated smoke testing (`tests/smoke-spec-24.test.mjs` covering T-24-01..T-24-08) including verified absence-guard failure proofs,
> carrying implementation through G5 Release with autonomous code execution, dual review (self-review + Sonnet 5 peer review),
> and automated smoke testing in the dedicated run branch `autopilot/DEC-026`.

## Why

1. **Slide Navigation Discard Dialog Regression (SPEC-24-01, BUG-31)**:
   SPEC-23-05 introduced automatic measurement healing on canvas mount, calling `markDirty()` whenever legacy unmeasured elements were found. This permanently dirtied the form on open, causing the navigation guard dialog to intercept every slide switch in the sidebar even when the operator made no edits.
2. **Edits Snapping Back to Initial Position on Save (SPEC-24-02, SPEC-24-03, BUG-32)**:
   Because `isHealingOnlyRef.current` was never cleared on user interactions, and `serializeCanvas` destructively forced `computedX = isHealing ? source.x : ...` along with overwriting `content` and `style`, manual edits were treated as background healing saves and overwritten with initial template values on save.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-026.md`).
Architectural invariants (AD-N) and public repo data cleanliness remain strictly preserved.
