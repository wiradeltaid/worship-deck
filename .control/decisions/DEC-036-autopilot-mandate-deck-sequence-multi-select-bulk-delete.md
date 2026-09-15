---
type: mandate
id: DEC-036
status: applied
accepted_by: 'kodesh87 (2026-09-15)'
touches:
  - .control/memlog/autopilot-DEC-036.md
  - .control/registry/specs.yaml
  - .control/registry/decisions.yaml
  - .scratch/SPEC-34-deck-sequence-multi-select-and-bulk-delete/SPEC.md
  - src/lib/registry/slide-selection.ts
  - src/components/admin/ArtifactEditor.tsx
  - tests/slide-selection.test.mjs
  - tests/smoke-spec-34.test.mjs
supersedes: null
superseded_by: null
created: '2026-09-15'
---

# DEC-036 — Autopilot mandate for Deck Sequence Multi-Select and Bulk Delete (SPEC-34)

## Decision

> The owner grants an autonomous execution mandate to implement Deck Sequence Multi-Select and Bulk Delete under SPEC-34, covering:
> 1) Pure File Explorer-style pointer and keyboard multi-selection in `src/lib/registry/slide-selection.ts` and `src/components/admin/ArtifactEditor.tsx` without checkboxes: single click selects, Ctrl/Cmd click toggles individual selection, Shift click selects contiguous ranges anchored by `anchorId`, and Ctrl/Cmd+Shift unions ranges; keyboard shortcuts Ctrl/Cmd+A (select all) and Escape (clear to active slide);
> 2) List-scoped Delete/Backspace shortcuts and explicit bulk delete button with single confirmation dialog;
> 3) Concurrency and optimistic locking safety: fresh token refresh during deletion loop, active slide reconciliation (fallback to nearest remaining slide or empty state), and canvas dirty-state preservation for unselected slides;
> 4) Comprehensive synthetic test suite with executable absence guards, dual code review (coordinator self-review + `kiro-cli` `gpt-5.6-terra` peer review), and public repository cleanliness;
> carrying implementation through G5 Release in the dedicated run branch `autopilot/DEC-036`.

## Why

Slide management currently requires deleting slides one-by-one with confirmation per slide. Operators need standard desktop file explorer interaction patterns to select multiple slides quickly and delete or manage batches in a single operation without visual clutter of checkboxes.

## Cost

Operational decisions are recorded in the autopilot ledger (`.control/memlog/autopilot-DEC-036.md`).
Architectural invariants (AD-N), Go API process boundaries (AD-30), schema limits, and public repository cleanliness remain strictly preserved.
