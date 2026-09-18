# SPEC-41-03 — Live Slide Preview Announcement Hierarchy, Dark-Theme Contrast, and Behavioral Smoke Tests

**What to build:**
Update `src/lib/artifacts/preview-model.ts` and `src/components/SlidePreviewList.tsx` so that Live Slide Preview in the Create and Edit Service forms groups announcement sets with an `[Announcement] {Name}` header and indented children, meeting dark-theme contrast floors. Add comprehensive behavioral smoke tests and executable absence guards with defect-injection proofs.

**Blocked by:** SPEC-41-02

**Status:** ready-for-agent

- [ ] Preview Model (`src/lib/artifacts/preview-model.ts`):
  - In `resolvePreviewBadge`, handle announcement child rows with `role === 'announcement'` emitting `announcement` or slide label.
  - In `resolvePreviewTitle`, ensure announcement child slides display `slide.title` or `entry.label`.
  - Add helper `resolveAnnouncementGroupBadge(groupOrdinal?: number): string` emitting `ann-set-N` or `ann-set`.
- [ ] Live Slide Preview Component (`src/components/SlidePreviewList.tsx`):
  - In `buildRows`, track `groupKind: 'song-set' | 'announcement'` for each group row.
  - In the group header render:
    - Visibly display badge `[Announcement]` (or localized) followed by `{row.label}`.
    - Apply dark-theme-safe tone styles: `bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-400/15 dark:text-purple-200 dark:border-purple-400/40` for badge and `border-l-2 border-purple-500/30 dark:border-purple-400/30` for child indentation.
- [ ] Behavioral Tests & Absence Guards (`tests/smoke-spec-41.test.mjs`):
  - Behavioral Test 1: Seed real database with an announcement set, slides, and spine marker; verify `buildSlidePlan` emits structured group node with ordered children.
  - Behavioral Test 2: Verify `buildPresenterRows` groups announcement slides under `announcement` group kind, and clicking any child targets its exact linear index.
  - Behavioral Test 3: Verify `SlidePreviewList` renders announcement set group headers `[Announcement]` with `{set name}` and indented children under both light and dark themes.
  - Behavioral Test 4: Verify repeated marker insertion for the same announcement set produces unique group keys and distinct instance IDs.
  - Executable Absence Guard 1: Verify test fails when announcement slides are emitted as flat ungrouped leaves (with recorded defect injection proof).
  - Executable Absence Guard 2: Verify test fails when announcement group headers display hardcoded `Song Set` badges (with recorded defect injection proof).
