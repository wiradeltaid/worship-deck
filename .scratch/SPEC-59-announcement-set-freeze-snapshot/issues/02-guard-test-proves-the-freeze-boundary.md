# 02: Guard test proves an Announcement Set edit does not reach an already-frozen Service

**What to build:** Ticket 01 adds the freeze mechanism. This ticket proves the actual promise
(BR-8/AD-35): that editing a live Announcement Set after a Service is frozen does NOT change that
Service until Sync Artifact runs. A test that only checks "a row got copied to the new table" would
pass without ever proving the boundary this spec exists for — this ticket is specifically about
proving the boundary.

**Blocked by:** 01 (freeze-announcement-set-slides-into-a-service-snapshot).

**Status:** ready-for-agent

- [ ] Create a Service (freezing its `service_registry_snapshots` / `service_announcement_set_slides`
      snapshot). Edit the live Announcement Set's slides (content, order, or membership — cover at
      least one of each) afterwards. Assert the frozen Service's rendered plan (or PPTX, whichever
      seam `internal/plan` tests already use for this kind of assertion) still reflects the
      **pre-edit** content.
- [ ] Run Sync Artifact on that same Service. Assert it now reflects the **post-edit** content —
      Sync remains the one action that pulls Registry changes into an already-frozen Service, for
      Announcement Sets exactly as it already does for Song Set entries and layout.
- [ ] An unfrozen Service (no `service_registry_snapshots` row yet) and the live preview
      (`serviceID` 0) both continue to reflect live Announcement Set edits immediately, with no freeze
      — confirm this explicitly so the fix doesn't overcorrect into freezing content that was never
      supposed to be frozen.
- [ ] **No prior art actually proves this boundary today — confirmed by peer review, do not go
      looking for a test that doesn't exist.** `internal/plan/snapshot_test.go` does not exist in this
      repo. The closest relative is `internal/httpapi/song_set_inputs_test.go`'s
      `TestCustomSongSetInPreviewAndServicePlan`, but it only proves a frozen plan renders correctly —
      it never edits the live registry after freezing and checks for non-leakage. This test must be
      written from scratch; follow that file's general seam (build via the real HTTP handlers, assert
      on the resulting plan) for structure, not as a template for the boundary logic itself.
