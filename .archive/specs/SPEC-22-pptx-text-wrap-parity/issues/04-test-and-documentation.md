# SPEC-22-04 — Test, OOXML Guard & Documentation

**Status:** ready-for-agent

## Component & Scope

- **Component**: `registry`
- **Satisfies**: `UC-14`
- **Files**:
  - `tests/smoke-spec-22.test.mjs` (new)
  - `tests/artifact-render-model.test.mjs`
  - `.how/registry/06-flows/canvas-authoring-controls.md`
  - `package.json` (test script inclusion if needed)
- **Tests**: T-22-01 through T-22-09 per TEST-PLAN.md

## Implementation Requirements

1. Create `tests/smoke-spec-22.test.mjs` with all T-22-* cases.
2. Extend `artifact-render-model.test.mjs` per TEST-PLAN Section 3.
3. Update `canvas-authoring-controls.md`:
   - PPTX `margin: 0` content-box parity
   - `wrapLines` snapshot at save
   - Canvas as line-break authority for export
   - Legacy template best-effort note
4. Register SPEC-22 in `.control/registry/specs.yaml`.
5. Prove absence guards per AGENTS.md (inject margin removal, verify T-22-01/02 fail, revert).

## Acceptance Criteria

- [ ] All T-22-* automated tests green.
- [ ] Defect injection proof documented in test comments or memlog.
- [ ] Documentation guard T-22-08 passes.
- [ ] Full `npm test` green.
