# 02: Scripture Congregation Screen Fixed 16:9 Canvas Aspect Containment

**What to build:** In `src/components/ScriptureOverlayView.tsx` and `src/lib/scripture-scaling.ts`, overhaul the congregation scripture overlay renderer to ensure it maintains strict 16:9 aspect ratio containment and scales identically to canvas slides without responsive deformation:
1. In `src/components/ScriptureOverlayView.tsx`:
   - Replace responsive pixel/rem constraints:
     - Remove `max-w-5xl` (which artificially clamps width to 1024px on wide displays).
     - Remove responsive media-query paddings (`sm:px-12`).
     - Remove `clamp(rem, ...)` style values that bind typography to browser root font size.
   - Enforce fixed 16:9 canvas stage containment matching `ArtifactSlide.tsx`:
     - Stage container uses `position: relative`, `aspectRatio: '16 / 9'`, and `containerType: 'size'`.
     - Outer viewport centers the stage with letterbox/pillarbox background (`#0B1220` or blackout).
     - Reference label: text color `#D4A574`, font size `clamp(14px, 3.2cqh, 24px)`, margin-bottom `2cqh`.
     - Verse container: max-height `78cqh`, full stage width, centered content.
2. In `src/lib/scripture-scaling.ts`:
   - Update font scaling formulas to return pure container query sizes (`cqh` / `cqw`), ensuring that short (<60 chars: ~8.5cqh), medium (60-120 chars: ~6.5cqh), standard (120-200 chars: ~4.8cqh), and long (>200 chars: ~3.5cqh) verses scale proportionally with the stage dimensions on any screen resolution from 720p to 4K.
   - Ensure text stays strictly inside the 16:9 canvas boundary without overflow or clipping.
3. Write automated unit and regression tests in `tests/scripture-aspect-containment.test.mjs` verifying:
   - Scripture stage enforces `aspectRatio: '16 / 9'` and container-type sizing.
   - No `rem`-based font sizes or `max-w-5xl` width clamps exist in the rendered scripture DOM.
   - Resizing viewport width or height scales font and bounding box by constant proportional container ratio across representative aspect ratios (16:9, 16:10, 4:3, 21:9).
   - Absence/injection test proving that re-introducing `max-w-5xl` or `rem` clamping causes ratio divergence.

Satisfies `FR-19` and `UC-22`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/components/ScriptureOverlayView.tsx`, `src/lib/scripture-scaling.ts`, and `src/components/artifacts/ArtifactSlide.tsx`.
- [x] In `src/lib/scripture-scaling.ts`:
      - Migrate font size formulas to pure container query units (`cqh`/`cqw`).
- [x] In `src/components/ScriptureOverlayView.tsx`:
      - Remove `max-w-5xl`, `sm:px-12`, and `rem` clamps.
      - Apply strict 16:9 letterboxed canvas stage with container query sizing.
- [x] In `tests/scripture-aspect-containment.test.mjs`:
      - Test 16:9 aspect ratio preservation across multiple viewport dimensions and aspect ratios.
      - Test font scaling container query proportionality.
      - Inject defect and verify absence guard fails.
- [x] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/scripture-aspect-containment.test.mjs` and `npm run typecheck`.
