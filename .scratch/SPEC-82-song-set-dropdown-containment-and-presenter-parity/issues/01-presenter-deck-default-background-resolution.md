# 01: Fix Presenter and Projector Deck Default Background Resolution

**What to build:** In `src/lib/artifacts/render-model.ts`, update `resolveEffectiveBackgroundImage` and its doc comments so that when `backgroundOverride` is `null`, `undefined`, `''`, or whitespace (representing "Deck default" / no live override active), lyric slides (`isLyricSlide`) preserve their authored/resolved background (`instance.layout.backgroundImage`) instead of collapsing to `undefined`. Only an explicit, non-empty, non-whitespace string URL (`typeof backgroundOverride === 'string' && backgroundOverride.trim() !== ''`) shall override the lyric slide background. Non-lyric slides shall continue preserving `instance.layout.backgroundImage` under all circumstances. In `tests/presenter-live-background-preview.test.mjs`, update assertions to verify that `null`, `undefined`, `''`, and `'   '` all preserve the authored background (`'default-song.jpg'`), while non-empty URLs override it. Add source guards verifying `ProjectorClient.tsx` passes `backgroundOverride={backgroundOverride}` to both active and transition `SlideView` invocations. Include real-file defect injection proofs asserting that omitting deck default fallback on `null` fails cleanly. Satisfies `UC-27`, `FR-33`, and `FR-16`.

**Blocked by:** None (can start immediately).

**Status:** open

- [ ] Read `src/lib/artifacts/render-model.ts`, `src/components/artifacts/ArtifactSlide.tsx`, `src/projected/ProjectorClient.tsx`, and `tests/presenter-live-background-preview.test.mjs`.
- [ ] In `src/lib/artifacts/render-model.ts`, update `resolveEffectiveBackgroundImage` and docblock:
      - If `!isLyricSlide(instance)`, return `instance.layout.backgroundImage`.
      - Normalize override URL: `const override = typeof backgroundOverride === 'string' ? backgroundOverride.trim() : '';`.
      - Return `override ? override : instance.layout.backgroundImage`.
- [ ] In `src/lib/present-channel.ts`, calibrate doc comments on `liveBackgroundOf` to explicitly document that `null` represents clearing the live session override back to Deck default (not wiping the slide background).
- [ ] In `tests/presenter-live-background-preview.test.mjs`:
      - Assert that `resolveEffectiveBackgroundImage(lyricVerse, null)` returns `'default-song.jpg'`.
      - Assert that `resolveEffectiveBackgroundImage(lyricVerse, undefined)` returns `'default-song.jpg'`.
      - Assert that `resolveEffectiveBackgroundImage(lyricVerse, '')` returns `'default-song.jpg'`.
      - Assert that `resolveEffectiveBackgroundImage(lyricVerse, '   ')` returns `'default-song.jpg'`.
      - Assert that `resolveEffectiveBackgroundImage(lyricVerse, overrideBg)` returns `overrideBg`.
      - Assert that non-lyric slides preserve their authored background.
      - Add source guard asserting `ProjectorClient.tsx` passes `backgroundOverride={backgroundOverride}` to `SlideView`.
      - Add defect injection test asserting failure if `null` override returns `undefined`.
- [ ] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/presenter-live-background-preview.test.mjs` and `npm run typecheck` to verify 100% green execution.
