# 01: Song Set Background Thumbnail Dropdowns in Presenter and Service Form (WSD-W1)

**What to build:** In `src/operator/present/PresenterOperator.tsx` and `src/operator/DynamicFormBody.tsx`, upgrade the song set background selection dropdowns from raw hash filenames to visual thumbnail selectors. Each selectable background item in `<SelectContent>` must render a visual thumbnail preview image (`<img src={...} />` with aspect-ratio containment, rounded borders, and muted background) alongside clean, non-opaque labels (`Image <id>` or `Background <id>`, with `(Default)` indicator). The `<SelectTrigger>` must display the thumbnail of the currently selected background (or a clean default badge). Eliminate raw hash strings (`.split('/').pop()`) from user-facing text while preserving distinct sentinel values (`''` for service form, `null` for presenter live override). Author `tests/background-thumbnail-picker.test.mjs` verifying thumbnail rendering, clean non-opaque labels, and sentinel semantics, and wire additively into `package.json` preserving `--test-concurrency=1`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/operator/present/PresenterOperator.tsx` and `src/operator/DynamicFormBody.tsx` first.
- [x] In `src/operator/DynamicFormBody.tsx`:
      - Update the song set background `<Select>` dropdown:
      - Render each background option with an `<img ... />` thumbnail preview (`h-6 w-9 object-cover rounded border`) and clean label (`Image ${img.id}${img.isDefault ? ' (Default)' : ''}`).
      - Eliminate `.split('/').pop()` raw hash filename rendering.
      - Render the `<SelectTrigger>` with thumbnail preview when a background is selected, or a clean icon/badge when Default Background (`''`) is active.
- [x] In `src/operator/present/PresenterOperator.tsx`:
      - Update the live background override `<Select>` dropdown:
      - Render each background option with an `<img ... />` thumbnail preview and clean label.
      - Eliminate `.split('/').pop()` raw hash filename rendering.
      - Render the `<SelectTrigger>` with thumbnail preview when a background is selected, or clean default styling when Deck default (`null`) is active.
- [x] Author `tests/background-thumbnail-picker.test.mjs`:
      - Verify that `PresenterOperator.tsx` renders thumbnail images for background options in `<SelectContent>` and `<SelectTrigger>`.
      - Verify that `DynamicFormBody.tsx` renders thumbnail images for song set background options.
      - Assert absence of raw hash filenames (`.split('/').pop()`) in option labels across both files.
      - Verify distinct sentinel handling (`''` in form vs `null` in presenter).
- [x] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/background-thumbnail-picker.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [x] Run tests and `npm run typecheck` to verify 100% green execution.
