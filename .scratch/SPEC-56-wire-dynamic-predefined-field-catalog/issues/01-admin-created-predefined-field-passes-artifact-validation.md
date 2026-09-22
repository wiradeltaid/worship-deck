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

**Status:** ready-for-agent

- [ ] Read `internal/plan/validate_artifact.go` in full first, to map exactly which functions check
      `placeholderKey` membership (`checkLayoutPlaceholders`) versus type (`parsePlaceholder`'s
      `catalogKeys[ph.Key]` lookup) before writing any test — they may be two different checks with
      two different fixes needed.
- [ ] Saving a template (`PUT /api/admin/artifacts/{id}`) with an image element bound to a
      `placeholderKey` that exists in the `predefined_fields` table (`field_type: "image"`), but is
      not one of the 17 built-in keys, succeeds.
- [ ] Saving a template with a `placeholderKey` that exists in neither the 17 built-in keys nor a
      current `predefined_fields` row still fails with the existing rejection — the check is widened,
      not removed.
- [ ] A Predefined Field that existed when an earlier template was saved, then was deleted from the
      catalog, does not retroactively invalidate that already-saved template, but a **new** save
      referencing the now-deleted key is rejected exactly as if the key had never existed. State the
      test for this explicitly — it is the case a naive "just add to the map and never remove"
      approach silently fails.
- [ ] Whatever the type-checking path (`parsePlaceholder`) actually does for the 17 built-in keys
      today — confirmed by reading the code, not assumed — is extended the same way for
      admin-authored keys, using `predefined_fields.field_type` as the source of truth. If the
      existing check turns out not to enforce type matching at all, say so in the ticket's own
      completion note rather than inventing a new type-mismatch rule that the raw notes never asked
      for.
- [ ] The 17 built-in catalog keys keep working exactly as before — this is additive, not a
      replacement.
