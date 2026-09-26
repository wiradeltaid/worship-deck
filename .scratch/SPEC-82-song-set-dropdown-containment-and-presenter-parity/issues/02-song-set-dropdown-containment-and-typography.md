# 02: Song-Set Background Dropdown Containment and Trigger Typography Polish

**What to build:** In `src/operator/DynamicFormBody.tsx`, fix the background selector dropdown trigger in `SongSetSlotRenderer` so that it stays strictly contained within its container and card boundary without horizontal overflow. Specifically:
1. Pass `w-full` to `<SelectTrigger className="w-full h-9 text-xs">` (replacing the default `w-fit`).
2. Add `min-w-0` to the flex container: `<div className="flex min-w-0 items-center gap-1.5 overflow-hidden">`.
3. In the trigger label when default is active, render concise label `Song-Set Default (#${songSetDefaultBg.id})` with `text-[11px] truncate` and `title` tooltip so it fits cleanly inside `w-48` (~192px).
4. In the trigger label when an explicit image is selected, render concise label `Image ${selectedFormBg.id}` with `text-[11px] truncate`.
5. Keep `<SelectItem value="default">` in `SelectContent` rendering the full string `Use Song-Set Default (#${songSetDefaultBg.id})` (or `Use Song-Set Default`) so the dropdown menu remains descriptive and satisfies existing test regexes.
6. Update `tests/song-set-background-parity.test.mjs` with source guards verifying `w-full`, `min-w-0`, and `text-[11px]`, and real-file defect injection proofs asserting that omitting containment causes test failure. Satisfies `FR-32` and `FR-31`.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `src/operator/DynamicFormBody.tsx` and `tests/song-set-background-parity.test.mjs`.
- [ ] In `src/operator/DynamicFormBody.tsx`:
      - Set `<SelectTrigger className="w-full h-9 text-xs">`.
      - Add `min-w-0` to the trigger's flex wrapper `div`.
      - Set trigger label for default to `Song-Set Default (#${songSetDefaultBg.id})` with `text-[11px] truncate`.
      - Set trigger label for explicit image to `Image ${selectedFormBg.id}` with `text-[11px] truncate`.
      - Retain full text in `SelectContent` for `SelectItem value="default"`.
- [ ] In `tests/song-set-background-parity.test.mjs`:
      - Add assertions verifying `SelectTrigger` has `w-full`.
      - Add assertions verifying flex container has `min-w-0`.
      - Add assertions verifying trigger label text styling uses `text-[11px]`.
      - Add defect injection proofs asserting containment guards catch regressions.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/song-set-background-parity.test.mjs` and `npm run typecheck` to verify 100% green execution.
