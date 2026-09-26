# 01: Song-Set "Save to Book" Dirty State Guard & Safety Threshold

**What to build:** In `src/operator/DynamicFormBody.tsx`, fix the fatal bug where clicking "Save to Book" without editing lyrics saves an empty string `""` to the database:
1. In `SongSetSlotRenderer` within `src/operator/DynamicFormBody.tsx`:
   - **Baseline Lifecycle Tracking**:
     - Record `initialLyricText` when song-set slot loads.
     - Reset the baseline upon:
       1. Initial data load or slot switch.
       2. Selecting a different song book or song number.
       3. Successful save to book completion.
       4. External form layout refresh.
   - **Dirty State Evaluation**:
     - Compute `isLyricsDirty = isLyricOpen && values.lyricText.trim().length > 0 && values.lyricText.trim() !== (initialLyricText || '').trim()`.
   - **Conditional Visibility**:
     - ONLY render the "Save to Book" button when `isLyricOpen` is true AND `isLyricsDirty` is true.
     - When `isLyricOpen` is false, or when the lyrics match the original database hymnal lyrics, the button MUST NOT appear.
2. In the save handler (`onSaveToBook`):
   - Add a strict defensive safety guard: if `values.lyricText.trim().length === 0`, abort and surface an operator-facing notification error, preventing empty-string database corruption from any programmatic or manual trigger.
   - When save succeeds, update the baseline to the newly saved text so `isLyricsDirty` resets to false.
3. Write automated unit and regression tests in `tests/song-set-save-to-book-guard.test.mjs` verifying:
   - "Save to Book" button is absent when `isLyricOpen` is false.
   - "Save to Book" button is absent when `isLyricOpen` is true but lyrics are unchanged from baseline.
   - "Save to Book" button appears when lyrics are edited and differ from baseline.
   - Baseline resets correctly after successful save.
   - Attempting to trigger save with empty or whitespace-only lyrics is rejected.
   - Absence/injection test proving that removing the dirty check allows premature or empty-string saves.

Satisfies `FR-31`, `FR-33`, and `UC-20`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/operator/DynamicFormBody.tsx` and related song-set form handlers.
- [x] In `src/operator/DynamicFormBody.tsx`:
      - Implement dirty state comparison against baseline hymn lyrics in `SongSetSlotRenderer`.
      - Only render "Save to Book" button when `isLyricOpen` is true and `isLyricsDirty` is true.
      - Add fail-safe validation against empty-string lyrics in `onSaveToBook`.
- [x] In `tests/song-set-save-to-book-guard.test.mjs`:
      - Test dirty check visibility logic and baseline reset lifecycle.
      - Test empty-string rejection guard.
      - Inject defect and prove absence guard fails.
- [x] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/song-set-save-to-book-guard.test.mjs` and `npm run typecheck`.
