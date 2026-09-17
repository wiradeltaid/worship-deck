# SPEC-22-02 — Persist Canvas Wrap-Line Snapshot

**Status:** ready-for-agent

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**:
  - `src/lib/registry/canvas-utils.ts` (`serializeCanvas`)
  - `src/lib/artifacts/runtime-contract.ts` (type extension)
- **Tests**: `tests/smoke-spec-22.test.mjs` (T-22-03, T-22-04)

## Context

Fabric `Textbox.textLines` holds the authoritative whole-word wrap result on the 960×540 reference canvas. PPTX and `estimateTextFitScale` cannot reproduce this without either identical font metrics or a persisted snapshot. Saving `wrapLines` at serialize time makes Canvas the line-break authority without mutating operator `content`.

## Implementation Requirements

1. Extend `CanvasElement` / `ResolvedElement` text shape with optional `wrapLines?: string[]`.
2. In `serializeCanvas`, when `isText` and Fabric object exposes `textLines`:
   ```typescript
   const lines = (obj as fabric.Textbox).textLines;
   if (Array.isArray(lines) && lines.length > 0) {
     next.wrapLines = lines.map(String);
   }
   ```
3. Omit `wrapLines` from JSON when absent or when identical to single-line `content` with no soft-wrap (optional size optimisation — document choice in commit).
4. Legacy elements without `wrapLines` MUST load and render unchanged.

## Acceptance Criteria

- [ ] Save persists `wrapLines` for Bandung fixture matching `['Bandung', 'international', 'community']`.
- [ ] T-22-03 and T-22-04 pass.
- [ ] Hydration path tolerates unknown/extra fields (no strict schema rejection).
