---
artifact: .control/decisions/DEC-036-autopilot-mandate-deck-sequence-multi-select-bulk-delete.md
---

# Autopilot Ledger — DEC-036

## Resume

- Iteration: 1 (final)
- Run branch: autopilot/DEC-036
- Stopped at: Done (mandate applied, all FR-21 tickets in SPEC-34 closed and verified green)
- Blocked: —
- Parked: —
- Next: Finish — owner merges PR

## Decisions

| When | Where | Decided | Instead of | Cost if wrong | Landed in |
|---|---|---|---|---|---|
| I-1 (start) | mandate | Start autopilot mandate DEC-036 for SPEC-34 | waiting for interactive dispatch | low | .control/decisions/DEC-036-autopilot-mandate-deck-sequence-multi-select-bulk-delete.md |
| I-1 (T-34-01) | slide-selection | Implement pure File Explorer-style pointer selection and block move engine | coupling selection logic to React state | low | src/lib/registry/slide-selection.ts, tests/slide-selection.test.mjs |
| I-1 (T-34-01) | ArtifactEditor | Wire list-scoped focus, keyboard navigation, modifier clicks, and block DnD move | plain single-slide active selection | medium | src/components/admin/ArtifactEditor.tsx, tests/smoke-spec-34.test.mjs |
| I-1 (T-34-02) | runBulkDelete | Sequential bulk deletion with fresh updatedAt token refreshment and 404/409 halting | token reuse causing optimistic locking failures | high | src/lib/registry/slide-selection.ts, tests/slide-selection.test.mjs |
| I-1 (T-34-02) | ArtifactEditor / i18n | Single confirmation dialog with dirty active slide warning, nearest active replacement, and i18n keys | separate confirmation prompts per slide | medium | src/components/admin/ArtifactEditor.tsx, src/lib/i18n/ |
| I-1 (peer-review) | peer-review | Address Terra peer review by preserving selection on unselected drag, catching thrown errors in bulk runner, and clearing active template on final deselect | leaving subtle edge-case state inconsistencies | medium | src/components/admin/ArtifactEditor.tsx, src/lib/registry/slide-selection.ts |
| I-1 (smoke) | smoke-test | Verify FR-21 proof of done via automated test suite across pure helpers, source guards, and public repo guard (PASS) | manual operator click-testing | low | tests/slide-selection.test.mjs, tests/smoke-spec-34.test.mjs |
