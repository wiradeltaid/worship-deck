# 08: Canvas Reset becomes discard-unsaved-changes; seeded elements become deletable (DEC-014)

**What to build:** The canvas "Reset" button discards the current unsaved edits back to the last
Saved state. It no longer restores a template from the filesystem seed, and there is no other
in-UI control that does. An element the seeder created can be deleted like any other element — the
`"shipped and required elements are part of the template"` refusal is removed.

**Blocked by:** 07

**Status:** open — gated by `DEC-014` (`status: accepted`, already satisfied; this ticket proceeds)

- [ ] Read `DEC-014` in full (`.control/decisions/DEC-014-canvas-reset-becomes-discard-unsaved-changes.md`)
      before writing any code — it names the exact cost being accepted and the exact spine clause
      to edit.
- [ ] Read `tests/registry-reseed.test.mjs` and `tests/registry-three-kind-reset.test.mjs` in full
      before writing implementation. Both currently pin the OLD Reset-from-seed behaviour. Rewrite
      the assertions that describe the button's product behaviour to match discard-unsaved-changes;
      any assertion that is really about a *different* mechanism (e.g. AD-17's "a deleted row stays
      deleted through a plan build", which this ticket does not touch) must survive unchanged —
      read closely enough to tell the two apart.
- [ ] Remove the `refused`/`deleteHintShipped` code path in the delete handler
      (`ArtifactEditor.tsx` ~L992-1004) and its i18n string
      (`admin.artifacts.deleteHintShipped` in `catalogue-en.ts`) — a seeded element deletes the
      same way an admin-added one does.
- [ ] Implement "Reset" as discard: revert the in-memory canvas state to the last-Saved template,
      not to the filesystem seed.
- [ ] Define the never-Saved case explicitly: a template that has been edited but never Saved (a
      fresh seed, first opened, never Saved even once) has no "last Saved state" to discard back to.
      State and implement one specific behaviour (a no-op, or a one-time fallback to the seed for
      this case only, or clearing the canvas) — do not leave this undefined, since an undefined
      fallback is exactly where a restore-from-seed regression would silently creep back in against
      `DEC-014`.
- [ ] Guard Reset against a Save that is still in flight when it is clicked: either disable Reset
      while a Save request is pending, or define the ordering explicitly (the in-flight Save must
      not complete after the discard and silently reintroduce the edits the admin just discarded).
- [ ] Edit `AD-11` in `.how/_platform/ARCHITECTURE-SPINE.md`: the "Reset restores one selected
      template from that seed" clause now describes discard-unsaved-changes, not restore-from-seed.
      This is the one edit in this spec that touches an `AD-N`, per `DEC-014`. **`AD-22`/`AD-33`
      correction (found in this SPEC's `wdi-review`, edge-case-hunter lens):** the `songset-*`
      override-record clause DEC-014 originally also named does not need editing — it lived in
      `AD-22`, already superseded by `AD-33` (2026-08-20, DEC-004), which made Song Set layouts a
      free canvas with nothing held outside it. `AD-33`'s own text — "Reset on a Song Set layout
      behaves exactly as Reset on a General" — is a cross-reference to `AD-11`, not a restatement of
      it, so it stays correct automatically once `AD-11` is edited. Read `AD-33` once after editing
      `AD-11` to confirm that cross-reference still makes sense; it should need no edit of its own.
- [ ] The regression suite change (registry-reseed / registry-three-kind-reset) is seen reflecting
      the OLD behaviour failing against the NEW code before the rewrite is accepted as correct —
      i.e. confirm the tests actually exercised the old Reset-from-seed path, not something
      incidental, before rewriting them.
