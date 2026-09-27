# 02: Song-Set Lyric Action Dedicated Row Placement

**What to build:** In `src/operator/DynamicFormBody.tsx`, relocate the lyric toggle and save-to-book action buttons to a dedicated action row below the selector inputs:
1. In `SongSetSlotRenderer`:
   - Keep the selector controls row strictly for:
     - Song Number Input (`values.songNumber`)
     - Book Code Dropdown (`Select values.songBookCode`)
     - Background Dropdown (`Select values.background`)
   - Remove the lyric toggle buttons container from the selector controls row.
   - Insert a dedicated action row immediately below the selectors row:
     - `<div className="flex items-center gap-2 pt-1.5" data-testid="song-set-action-row">`
     - Render `Edit Lyrics / Close Lyrics` button in this row when `hasValidNum` is true.
     - When `isLyricOpen` and `isLyricsDirty` are true, render `Save to Book` button beside `Close Lyrics` in this same dedicated action row.
   - Below this dedicated action row, render the expanded `<Textarea>` when `isLyricOpen` is true.
2. Stability and ergonomics:
   - Ensure that typing in the textarea and toggling dirty state never shifts the upper selector row or causes button jumping.
   - Maintain the dirty comparison lifecycle and empty-string safety guard established in SPEC-85-01.
3. Write automated unit and regression tests in `tests/song-set-lyric-button-layout.test.mjs` verifying:
   - Lyric action buttons (`Edit Lyrics / Close Lyrics` and `Save to Book`) reside in a dedicated action row separate from selector inputs.
   - Toggling dirty state preserves selector layout without horizontal shifting.
   - Absence/injection test proving that putting lyric buttons back in the selector input flex row fails the layout separation assertion.

Satisfies `FR-34` and `UC-28`.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `src/operator/DynamicFormBody.tsx`.
- [ ] In `src/operator/DynamicFormBody.tsx`:
      - Remove lyric action buttons from selector inputs row.
      - Add dedicated action row below inputs for `Edit/Close Lyrics` and `Save to Book`.
- [ ] In `tests/song-set-lyric-button-layout.test.mjs`:
      - Test that selector inputs and lyric action buttons occupy separate rows.
      - Test dirty state transition does not alter selector inputs layout.
      - Inject defect and prove absence guard fails.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/song-set-lyric-button-layout.test.mjs` and `npm run typecheck`.
