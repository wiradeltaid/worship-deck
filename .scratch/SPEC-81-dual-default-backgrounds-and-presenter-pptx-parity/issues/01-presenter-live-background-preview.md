# 01: Fix PresenterOperator Live Background Preview Disconnect (WSD-W1)

**What to build:** In `src/operator/present/PresenterOperator.tsx`, connect `liveBackground` to all operator-side slide rendering components while respecting the established `isVerseOrReff` lyric boundary in `ArtifactSlide.tsx`. Specifically, pass `backgroundOverride={liveBackground}` to `<SlideView slide={current} />` (line 953), `<SlideView slide={next} />` (line 1234), and update `FilmstripFrame` (line 246) to accept `backgroundOverride?: string | null` and forward it to `<SlideView slide={slide} backgroundOverride={backgroundOverride} />`. Verify that non-lyric slides (such as Welcome, Scripture Reading, or Sermon) in Current, Next, or Filmstrip continue rendering their authored appearance without being overridden by `liveBackground`. Author automated tests in `tests/presenter-live-background-preview.test.mjs` verifying that `PresenterOperator.tsx` passes `backgroundOverride={liveBackground}` to `SlideView` and `FilmstripFrame`, with defect injection tests asserting absence guards. Wire additively into `package.json` preserving `--test-concurrency=1`. Satisfies `UC-27` and `FR-16`.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/operator/present/PresenterOperator.tsx`, `src/components/SlideView.tsx`, and `src/components/artifacts/ArtifactSlide.tsx` first.
- [x] In `src/operator/present/PresenterOperator.tsx`:
      - Update `FilmstripFrame` props to accept `backgroundOverride?: string | null`.
      - Forward `backgroundOverride` from `FilmstripFrame` into `<SlideView slide={slide} backgroundOverride={backgroundOverride} />`.
      - In `PresenterOperator`, pass `backgroundOverride={liveBackground}` to `<SlideView slide={current} ... />`.
      - Pass `backgroundOverride={liveBackground}` to `<SlideView slide={next} ... />`.
      - In the filmstrip render loop (line 1159), pass `backgroundOverride={liveBackground}` to `<FilmstripFrame ... />`.
- [x] Author `tests/presenter-live-background-preview.test.mjs`:
      - Verify that `SlideView` invocations for `current`, `next`, and `FilmstripFrame` explicitly pass `backgroundOverride`.
      - Verify that selecting live background updates the operator slide view for lyric slides (`isVerseOrReff`) alongside `BroadcastChannel` messages.
      - Verify that non-lyric slides in Current/Next/Filmstrip do not receive live background override.
      - Include real-file defect injection proofs asserting that removing `backgroundOverride` from `PresenterOperator.tsx` causes test failure.
- [x] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/presenter-live-background-preview.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [x] Run test suite and `npm run typecheck` to verify 100% green execution.
