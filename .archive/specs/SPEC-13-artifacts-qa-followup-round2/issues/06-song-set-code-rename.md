# 06: Song Set code (variableName) gets a Rename control

**What to build:** A Rename affordance next to the Song Set's code (`variableName`/slug) field,
the same way its title already has one.

**Blocked by:** 05

**Status:** done

- [x] Ordinary implementation work, no debugging pass needed.
- [x] Closes `BUG-15`'s reopened sub-item: SPEC-12 ticket 07 claimed this as done; round-2 QA
      confirms it is not present. Build it for real this time, and confirm live before marking the
      checklist item done — this defect's own history is the reason to actually click through it.
- [x] Follows the `[Rename] | Canvas: [Reset] [Save]`-style grouping `DEC-011` already established
      elsewhere in this editor, scoped to the code field.
- [x] **Verified data-safety gap (found in this SPEC's `wdi-review`, edge-case-hunter lens):**
      `song_set_inputs` (`internal/db/schema.sql`) is keyed by `(service_id, variable_name)`, and
      `src/operator/EditForm.tsx` reads/writes per-service song-set data (song number, book,
      background, lyric override) by that same `variableName`. Renaming a Song Set entry's code
      changes the key every existing service's already-entered data is stored under — those rows
      do not move on their own. Before implementing, decide and state explicitly which of two
      shapes this rename takes: (a) the rename also re-keys/migrates existing `song_set_inputs`
      rows from the old `variableName` to the new one, or (b) it does not, and data entered under
      the old code becomes inert going forward — the same posture `AD-19` already takes for a
      binding whose slot row has been deleted ("inert, not an error"). Either is acceptable; leaving
      it undecided is not, because a service that already has this week's hymn entered for this
      slot silently losing access to it is a real regression a rename should not cause by accident.
- [x] A test proves the Rename control is present and functional (PATCHes the code field, handles
      the conflict/validation paths `SongSetEntriesPanel.tsx`'s existing title-rename code already
      handles) — reusing that existing rename flow's test coverage as the pattern, not inventing a
      new one.

