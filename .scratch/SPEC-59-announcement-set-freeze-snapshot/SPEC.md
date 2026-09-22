## Problem Statement

Once a Service has been reviewed and frozen (a `service_registry_snapshots` row exists for it,
written at Service creation and at "Sync Artifact"), AD-35 and BR-8 promise that its content stays
put until an explicit Sync — an Admin editing the Artifact Registry afterwards must not change what
an already-reviewed Service shows. `.what/registry/04-usecases/UC-16-sync-artifact.md` and
`UC-20-deck-matches-payload.md` both describe this as accomplished fact: the snapshot "already
carries that set's cloned content... clone happened at freeze, not at render."

That freeze is real for `artifact_templates` rows (cloned into `service_registry_snapshots`,
`internal/db/bootstrap.go:715` and `internal/httpapi/registry.go:836`) and for the Song Set layout
trio (`service_song_set_layouts`, read via `loadSongSetLayoutTrioFor`). It does **not** exist for
Announcement Set slide content: `internal/plan/snapshot.go`'s `LoadSnapshot` unconditionally calls
`loadAnnouncementSlidesIntoSnapshot`, which queries the live `announcement_set_slides` table
directly, every time, for every Service, regardless of whether that Service has a frozen snapshot.
No `service_announcement_set_slides` table exists anywhere in `internal/db/schema.sql`.

Net effect: editing an Announcement Set's slides (content, order, or membership) after a Service has
already been frozen changes what that already-reviewed Service renders, immediately, with no Sync
required — the opposite of what BR-8/AD-35/UC-16/UC-20 promise. This was caught by a corpus-vs-code
reconciliation pass (2026-09-22); `.how/registry/05-model/data-model.md` already flags it honestly as
`[MISSING]`, but the SDD's AD-35 row and both UC files state it as done.

## Solution

Give Announcement Set slide content the same freeze treatment `artifact_templates` already has: a
`service_announcement_set_slides` table, populated at the same two points `service_registry_snapshots`
already is (Service creation clone, and Sync Artifact), and read by `loadAnnouncementSlidesIntoSnapshot`
in preference to the live table whenever a frozen row exists for that Service — mirroring exactly how
`LoadSnapshot` already chooses between `service_registry_snapshots` and live `artifact_templates`.

## User Stories

1. As an Admin, I want an Announcement Set edit I make today to NOT change a Service that was already
   reviewed and frozen last week, so that a Friday review stays trustworthy until I explicitly Sync.
2. As an Operator, I want the Service Run Sheet I'm looking at to keep showing the announcements it
   showed when it was created, even if the Admin is mid-edit on the Artifact Registry right now, so
   that what I present doesn't change out from under me mid-week.
3. As an Admin, I want Sync Artifact to still be the one action that pulls in my Announcement Set
   changes for an already-frozen Service, exactly as it already does for Song Set entries and layout,
   so that the promise is consistent across every kind of content the Registry owns.

## Implementation Decisions

- New table `service_announcement_set_slides`, shaped like `service_registry_snapshots` but scoped
  to announcement content: `service_id`, and enough of `announcement_set_slides`' own columns
  (`ann_set_id`, `label`, `payload`, `position`) to reconstruct exactly what
  `loadAnnouncementSlidesIntoSnapshot` currently builds from the live table. Also needs a frozen copy
  of each referenced Announcement Set's label (today read live from `announcement_sets` in the same
  function) — either its own small table or an extra column on the new one; whichever avoids a second
  live join once frozen.
- Written inside `cloneLiveToService` (`internal/db/bootstrap.go`, ~line 676-745, beside its existing
  `service_registry_snapshots` insert) — a single shared function already called by both real Service
  creation (`CloneRegistryToNewService`) and the AD-16 bulk data-version migration
  (`migrateSnapshots`), so editing it once covers both callers — and independently at
  `internal/httpapi/registry.go`'s Sync Artifact write (beside its own existing insert around line
  836). Each write happens in the same transaction as its neighbouring `service_registry_snapshots`
  insert, so the two snapshots can never be written out of step with each other.
- `service_announcement_set_slides` MUST declare `FOREIGN KEY(service_id) REFERENCES services(id) ON
  DELETE CASCADE`, matching `service_registry_snapshots` and `service_song_set_layouts` exactly.
  Confirmed by peer review: actual Service deletion (`deleteService`) never issues an explicit delete
  against `service_registry_snapshots` — it relies entirely on this FK cascade — so the new table
  needs the identical cascade or a Service delete orphans its frozen announcement rows forever.
- `loadAnnouncementSlidesIntoSnapshot` gains the same `serviceID`-gated choice `LoadSnapshot` already
  makes for `service_registry_snapshots`: if a frozen row exists for this Service, read from
  `service_announcement_set_slides`; otherwise (unfrozen Service, or the live preview at `serviceID
  0`) read live from `announcement_set_slides`, exactly as today.
- Deleting a Service's frozen snapshot (`DELETE FROM service_registry_snapshots WHERE service_id = ?`,
  both existing call sites) must delete the paired `service_announcement_set_slides` rows in the same
  transaction — an orphaned frozen-announcement row with no matching `service_registry_snapshots` row
  would freeze silently forever with no Sync able to reach it.

## Testing Decisions

- A good test here proves the freeze boundary, not the copy mechanics: create a Service (freezing its
  snapshot), edit the live Announcement Set afterwards, and assert the Service's rendered plan/PPTX
  still shows the pre-edit content — then Sync Artifact, and assert it now shows the post-edit content.
  Testing "a row got copied to a new table" without testing that boundary would pass while leaving the
  actual promise (BR-8) unverified.
- No existing test actually proves this freeze-then-sync boundary today (confirmed by peer review —
  `internal/plan/snapshot_test.go` does not exist; the closest relative,
  `internal/httpapi/song_set_inputs_test.go`'s `TestCustomSongSetInPreviewAndServicePlan`, proves a
  frozen plan renders correctly but never edits the live registry post-freeze). This test must be
  written from scratch, following that file's general seam (real HTTP handlers, assert on the
  resulting plan) for structure only.
- The existing announcement-slide-loading behavior for an unfrozen Service (or the live preview) must
  keep passing unchanged — this is additive for frozen Services, not a behavior change for live ones.

## Out of Scope

- No change to `artifact_templates`/`service_registry_snapshots` or the Song Set layout trio — both
  already work correctly and are not part of this gap.
- No change to what UC-16/UC-20/BR-8/AD-35 promise — the promise stays as written; this spec makes the
  code match it.
- Not fixing the Song Set Entry data-model documentation gap (identity now split across
  `song_set_entries` and `artifact_templates`) found in the same reconciliation pass — that is a
  documentation-only correction, tracked separately outside this spec.

## Further Notes

Found alongside two other confirmed code-behavior gaps (SPEC-58, SPEC-60) and several
documentation-only corrections in the same 2026-09-22 reconciliation pass across hub/presenter/registry.
This is the only one of the three judged to need a real design decision (a new snapshot table plus two
write-site changes) rather than a single localized fix, hence `size: M` with this SPEC.md.
