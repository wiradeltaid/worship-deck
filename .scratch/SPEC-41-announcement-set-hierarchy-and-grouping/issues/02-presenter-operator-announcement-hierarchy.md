# SPEC-41-02 — Presenter Operator Announcement Hierarchy and Dynamic Group Badges

**What to build:**
Update `src/operator/present/presenter-model.ts` and `src/operator/present/PresenterOperator.tsx` to group contiguous announcement slides under an `[Announcement] {Name}` group header, discriminate group types (`song-set` vs `announcement`), apply distinct badge styling, and render announcement slides indented with their slide titles.

**Blocked by:** SPEC-41-01

**Status:** ready-for-agent

- [ ] Presenter Model (`src/operator/present/presenter-model.ts`):
  - Extend `PresenterRow` kind `'group'` with `groupKind: 'song-set' | 'announcement'`.
  - In `buildPresenterRows(entries)`:
    - Discriminate `groupKind: entry.groupId?.startsWith('ann-') || entry.role === 'announcement' ? 'announcement' : 'song-set'`.
    - Provide appropriate default label if `entry.groupLabel` is empty (`'Announcement'` for announcement groups, `'Song Set'` for song set groups).
- [ ] Presenter Operator UI (`src/operator/present/PresenterOperator.tsx`):
  - In `rows.map`, inspect `row.kind === 'group'`:
    - Instead of hardcoding `Song Set` badge:
      - If `row.groupKind === 'announcement'`: render badge text `Announcement` with purple tone (`border-purple-400/40 bg-purple-400/15 text-purple-200 dark:border-purple-400/40 dark:bg-purple-400/15 dark:text-purple-200`).
      - If `row.groupKind === 'song-set'`: render badge text `Song Set` with primary tone (`border-primary/40 bg-primary/15 text-primary`).
    - Render `row.label` as the group title (e.g. `[Announcement] Warta Jemaat`).
    - Indent child slides inside `<div className="ml-3 border-l border-border pl-1">`.
    - Ensure each `SlideListRow` displays its slide number, label, and title properly.
    - Preserve active slide highlighting and click-to-navigate for all announcement child slides.
- [ ] Presenter Model Tests (`tests/presenter-model.test.mjs`):
  - Add tests confirming that entries with announcement group IDs are grouped with `groupKind: 'announcement'` and correct label.
  - Verify that navigating to an announcement child slide updates active state across the group.
  - Update comments in `presenter-model.ts` and `preview-model.ts` retiring the outdated "SongSet-only" assumption.
