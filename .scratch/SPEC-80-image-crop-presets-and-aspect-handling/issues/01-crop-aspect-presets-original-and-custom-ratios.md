# 01: Crop Aspect Presets, Original Ratio, and Custom Aspect Handling (WSD-W1)

**What to build:** In `src/components/media/ImageCropDialog.tsx`, expand the crop aspect ratio selector to include common church slide and publication presets (`Original`, `16:9`, `4:3`, `1:1`, `3:4`, `2:3`, `9:16`, `A4`, and `Custom`). Eliminate the bug where selecting "Freeform" passed `undefined` aspect and silently forced `react-easy-crop`'s default `4:3` box. Capture `naturalWidth` and `naturalHeight` via `onMediaLoaded` on `Cropper` and resolve `Original` aspect to `naturalWidth / naturalHeight`. Map legacy `defaultAspect: null` callers to `'original'`. For `Custom`, render finite positive number inputs `[ W ] : [ H ]`, validate positive values (`w > 0 && h > 0`), clamp aspect between `0.1` and `10.0`, and disable the Apply button on invalid input with a clean error hint. Add an explicit pan & zoom guidance hint below the viewport ("Geser gambar untuk mengatur posisi, gunakan slider zoom untuk memperbesar/memperkecil"). Author `tests/crop-aspect-presets.test.mjs` verifying preset math, original aspect derivation, custom ratio validation and clamping, legacy null migration, absence of undefined aspect fallback, and presence of interaction hint, and wire additively into `package.json` preserving `--test-concurrency=1`. Satisfies `UC-14` and `FR-1`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/components/media/ImageCropDialog.tsx` and `src/lib/images/crop-image.ts` first.
- [x] In `src/components/media/ImageCropDialog.tsx`:
      - Define structured preset IDs:
        `type AspectPresetId = 'original' | '16:9' | '4:3' | '1:1' | '3:4' | '2:3' | '9:16' | 'a4' | 'custom'`
      - Map legacy `defaultAspect: null` callers directly to `'original'`.
      - Track `mediaSize: { naturalWidth: number; naturalHeight: number } | null` via `onMediaLoaded` on `Cropper`.
      - When `'original'` is active, resolve aspect to `mediaSize ? mediaSize.naturalWidth / mediaSize.naturalHeight : 1`.
      - Add presets: `3:4` (0.75), `2:3` (2/3 ≈ 0.667), `9:16` (9/16 = 0.5625), `A4` (210/297 ≈ 0.707).
      - For `'custom'`, render `W : H` inputs with positive finite validation (`w > 0 && h > 0`), clamp between `0.1` and `10.0`, and disable Apply button on invalid inputs with error text.
      - Ensure `Cropper` receives an explicit positive numerical `aspect` at all times (never `undefined` or `null`).
      - Add on-screen pan/zoom interaction hint text below the viewport.
- [x] Author `tests/crop-aspect-presets.test.mjs`:
      - Unit test all ratio preset calculations: 16:9, 4:3, 1:1, 3:4, 2:3, 9:16, A4.
      - Unit test original aspect ratio computation with various image dimensions (e.g. 5000x2000, 1080x1920, 1200x1200).
      - Unit test custom ratio calculation and safety clamping against 0, negative numbers, and extreme bounds.
      - Unit test legacy `defaultAspect: null` mapping to `'original'`.
      - Source absence guard ensuring `ImageCropDialog.tsx` does not pass `undefined` aspect or fallback to 4:3.
      - Source presence guard verifying the pan/zoom guidance hint is present.
- [x] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/crop-aspect-presets.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [x] Run test suite and `npm run typecheck` to verify 100% green execution.
