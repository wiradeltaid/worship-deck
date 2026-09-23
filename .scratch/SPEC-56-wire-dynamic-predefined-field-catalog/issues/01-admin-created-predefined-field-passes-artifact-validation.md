# 01: An Admin-created image Predefined Field passes artifact validation

**What to build:** Today, binding an image element's `placeholderKey` to an Admin-created Predefined
Field and saving the template is rejected by the server with "unknown placeholderKey" / "not in the
catalog" — only the 17 built-in keys are recognized. This is checked against the `predefined_fields`
table's live, deletion-aware state, not against a process-global map that only ever grows: two
functions already exist for widening this check (`RegisterCatalogToken` / `IsValidCatalogToken` in
`internal/plan`), but neither reads the database and neither has a way to un-recognize a key once
registered — deleting a Predefined Field would not actually revoke its ability to save on a new
template. This ticket makes the check read the current admin-authored catalog at validation time
(or from a cache that is invalidated on create/delete), not a map that can only accumulate.

**Note on scope:** inline `{token}` text content is a **separate, TypeScript-only, non-blocking**
check (`findUnknownPredefinedFieldTokens`) — the Go artifact validator does not check inline tokens
at all today, and this ticket does not add that. This ticket is scoped to the formal
`placeholderKey` / `placeholders` array path only, the one that actually rejects a save.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `internal/plan/validate_artifact.go` in full first, to map exactly which functions check
      `placeholderKey` membership (`checkLayoutPlaceholders`) versus type (`parsePlaceholder`'s
      `catalogKeys[ph.Key]` lookup) before writing any test — confirmed `checkLayoutPlaceholders` checks
      element key membership against the template's declared `placeholders`, and the `general` baseType
      switch checks catalog membership and placeholder type matching.
- [x] Saving a template (`PUT /api/admin/artifacts/{id}`) with an image element bound to a
      `placeholderKey` that exists in the `predefined_fields` table (`field_type: "image"`), but is
      not one of the 17 built-in keys, succeeds.
- [x] Saving a template with a `placeholderKey` that exists in neither the 17 built-in keys nor a
      current `predefined_fields` row still fails with the existing rejection — the check is widened,
      not removed.
- [x] A Predefined Field that existed when an earlier template was saved, then was deleted from the
      catalog, does not retroactively invalidate that already-saved template, but a **new** save
      referencing the now-deleted key is rejected exactly as if the key had never existed. Tested
      in `TestPutArtifact_DynamicPredefinedFieldImageValidation`.
- [x] Whatever the type-checking path (`parsePlaceholder`) actually does for the 17 built-in keys
      today — confirmed type matching (`image` vs `text`) is enforced by `ValidateArtifactTemplate` —
      extended for admin-authored keys using `predefined_fields.field_type` as source of truth.
- [x] The 17 built-in catalog keys keep working exactly as before — this is additive, not a
      replacement.
