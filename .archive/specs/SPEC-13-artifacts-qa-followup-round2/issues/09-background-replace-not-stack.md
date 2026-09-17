# 09: Adding a background replaces the existing one (DEC-014)

**What to build:** Choosing "Change Background" replaces the canvas's current background element,
for every template kind (`general`, `songset-*`), instead of adding a new layer on top of it.

**Blocked by:** 08

**Status:** open — gated by `DEC-014` (`status: accepted`, already satisfied; this ticket proceeds)

- [ ] Ordinary implementation work, no debugging pass needed — the desired behaviour is explicit
      ("harusnya dia bisa diganti-ganti, bukan malah ditumpuk").
- [ ] Find the background-add path and change it to remove/replace the existing background element
      for that role before inserting the new one, rather than appending. Identify "the existing
      background element" by its own role/kind marker, independent of ticket 08's seeded-element
      protection flag (which ticket 08 removes) — confirm during implementation that background
      identification does not depend on that flag, since ticket 09 runs after ticket 08 removes it.
- [ ] If inserting the new background fails after the old one has already been removed (bad asset
      reference, network error), the prior background is restored or kept rather than leaving the
      canvas with none — the remove-then-insert is not left half-done on failure.
- [ ] Confirm this applies to a seeded background too, consistent with `DEC-014` treating seeded
      content as ordinary editable content (ticket 08's scope, same decision).
- [ ] A test proves that adding a second background after a first one results in exactly one
      background element on the canvas, seen failing (two elements/layers) against current code
      before the fix, then passing after.
