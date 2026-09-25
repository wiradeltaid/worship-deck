# 03: Song-Set Background Persistence, Hydration, Placeholder Transparency & PPTX Parity (WSD-W3)

**What to build:** In `internal/plan/snapshot.go`, load `song_set_inputs.background_id` and the dual default assignments (`song_set` and `general`) into `Snapshot`, populating `HymnItem.BackgroundImage`. In `internal/plan/types.go`, add `BackgroundImage string` to `HymnItem` and `SongSetDefaultBackground`, `GeneralDefaultBackground` to `Snapshot`. In `internal/plan/plan.go`, in `songGroup` and `hydrateOne`, resolve background precedence for song-set slides (Title, Verse, Reff): Explicit Song-Set Selection -> Song-Set Default Background -> Template Authoring -> General Default Background -> `#000000`. For non-song slides: Authored Template / Content -> General Default Background -> `#000000`. In `src/operator/DynamicFormBody.tsx`, update the background selector to display "Use Song-Set Default" with thumbnail and ID. In `internal/httpapi/services.go`, ensure `applyPreviewSongSets` and `storedSongSets` preserve background references. For image elements and placeholders with `objectFit: 'contain'`, ensure the unfilled area inside the bounding box is transparent (in Fabric Canvas `canvas-utils.ts` remove tinted fill, in Web DOM verify transparent container, and in PPTX `slide.addImage` ensure no shape fill behind image). Verify that PPTX generation in `src/lib/pptx-draw.ts` embeds the resolved background images while collapsing identical media via `collapseDuplicateMedia`, asserting observable artifact proofs that repeated background URLs produce a single physical image entry in `ppt/media/`. Author automated tests in `tests/song-set-background-parity.test.mjs` verifying preview, plan hydration, presenter slides, transparent placeholder compositing, and PPTX export parity. Wire additively into `package.json` preserving `--test-concurrency=1`. Satisfies `UC-14`, `UC-18`, `FR-14`, `FR-31`, and `FR-32`.

**Blocked by:** `SPEC-81-02` (Dual Default Backgrounds Data Model & Background Library UI).

**Status:** closed

- [x] Read `internal/plan/snapshot.go`, `internal/plan/plan.go`, `internal/plan/hydrate.go`, `src/operator/DynamicFormBody.tsx`, `src/lib/registry/canvas-utils.ts`, and `src/lib/pptx-draw.ts` first.
- [x] In `internal/plan/types.go`:
      - Add `BackgroundImage string` to `HymnItem`.
      - Add `SongSetDefaultBackground string` and `GeneralDefaultBackground string` to `Snapshot`.
- [x] In `internal/plan/snapshot.go`:
      - Update `loadSongSetInputsIntoSnapshot` to query `ssi.background_id` and resolve against `background_library_images`.
      - Load active `song_set` and `general` default assignments from `background_default_assignments`.
      - Assign `HymnItem.BackgroundImage`.
- [x] In `internal/plan/plan.go`:
      - In `songGroup`, resolve background from `hymn.BackgroundImage` -> `snap.SongSetDefaultBackground` -> `snap.GeneralDefaultBackground`.
      - In `hydrateOne`, apply the resolved background to `tmpl.Layouts[r.layoutKey].BackgroundImage`.
      - For non-song slides, if `layout.BackgroundImage` is empty, apply `snap.GeneralDefaultBackground`.
- [x] In `internal/httpapi/services.go`:
      - In `applyPreviewSongSets`, copy the background reference into `snap.SongInputs[vn].BackgroundImage`.
- [x] In `src/operator/DynamicFormBody.tsx`:
      - Update the background selector placeholder and default option to `Use Song-Set Default`.
      - Display the Song-Set Default thumbnail and indicator.
- [x] In `src/lib/registry/canvas-utils.ts`:
      - Remove opaque/tinted fill (`rgba(255,255,255,0.08)`) from placeholder stand-ins, using transparent fill with dashed boundary outline.
- [x] Author `tests/song-set-background-parity.test.mjs`:
      - Verify that `BuildSlidePlan` produces song slides carrying the resolved background image URL.
      - Verify that fallback to `Song-Set Default` occurs when no background is chosen.
      - Verify that non-song slides receive `General Default` when lacking custom backgrounds.
      - Verify placeholder `fit` / `contain` mode preserves transparent letterbox/pillarbox background.
      - Verify PPTX export includes the background image with observable zip inspection proof confirming identical media deduplication to 1 file in `ppt/media/`.
      - Include real-file defect injection proofs.
- [x] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/song-set-background-parity.test.mjs` into `package.json` test script additively preserving `--test-concurrency=1`.
- [x] Run test suite and `npm run typecheck` to verify 100% green execution.
