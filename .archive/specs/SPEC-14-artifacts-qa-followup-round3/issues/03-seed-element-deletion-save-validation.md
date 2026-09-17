# 03: Seed element deletion backend & store save validation (BUG-18 residual / DEC-014)

**What to build:** Allow templates with deleted, renamed, or modified seed elements to be saved successfully without validation errors from the Go backend or client-side registry store, fully implementing `DEC-014`'s mandate that seeded elements are ordinary editable and deletable elements.

**Blocked by:** none

**Status:** open

**Done when:**
- Saving an artifact template where a seed element (e.g., `e1`) has been deleted passes validation in both the Go backend and the client-side store without throwing or returning a 400 error.
- Existing tests asserting seed element retention in `tests/registry.test.mjs` are inverted to assert that seed deletion is accepted and persisted.
- `AD-11` in `.how/_platform/ARCHITECTURE-SPINE.md` reflects that seed elements are not locked against deletion, per `DEC-014`.

### Implementation Steps

- [ ] Inspect Go backend validation in `internal/plan/validate_artifact.go` at `AssertStableAgainstSeed` (~L648):
  - Remove the check enforcing `for _, seedEl := range seedLayout.Elements { if !ok { return failf("element %s is part of the shipped template and cannot be removed or renamed in layout %s", ...) } }`.
  - Remove the check enforcing `if incomingEl.Required != baseline.Required { return failf("element %s is part of the shipped template and its required flag cannot be changed in layout %s", ...) }`.
  - Retain structural validation (valid IDs, no duplicates, layout names, valid style/geometry).
- [ ] Inspect client-side store validation in `src/lib/registry/store.ts` at `assertStableAgainstSeed` (~L294):
  - Remove the check throwing `RegistryValidationError: element ${seedElement.id} is part of the shipped template and cannot be removed or renamed in layout ${layoutKey}`.
  - Remove the check throwing `RegistryValidationError: element ${seedElement.id} is part of the shipped template and its required flag cannot be changed in layout ${layoutKey}`.
  - Update the legacy comment referencing Story 16.5 ("shipped skeleton must survive every save") to record that `DEC-014` retired this restriction.
- [ ] Invert and update existing regression tests in `tests/registry.test.mjs`:
  - `save cannot remove seeded element ids` (~L240): Invert to verify that saving without a seeded element ID succeeds.
  - `save rejecting a seeded element removal leaves the row unchanged` (~L354): Update to assert that removing `e1` saves and modifies the row as expected.
  - `save cannot flip a seeded element required flag` (~L371): Update to verify required flag mutation is accepted on seed elements.
- [ ] Verify Go backend tests in `internal/plan/` and HTTP tests in `tests/registry-go-http.test.mjs` to ensure the Go save endpoint accepts templates with deleted seed elements.
- [ ] Verify `AD-11` clause in `.how/_platform/ARCHITECTURE-SPINE.md` aligns with `DEC-014` regarding seeded element mutability.
