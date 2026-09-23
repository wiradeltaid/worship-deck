# 02: Guard test proves an Announcement Set edit does not reach an already-frozen Service

**What to build:** Ticket 01 adds the freeze mechanism. This ticket proves the actual promise
(BR-8/AD-35): that editing a live Announcement Set after a Service is frozen does NOT change that
Service until Sync Artifact runs. A test that only checks "a row got copied to the new table" would
pass without ever proving the boundary this spec exists for — this ticket is specifically about
proving the boundary.

**Blocked by:** 01 (freeze-announcement-set-slides-into-a-service-snapshot).

**Status:** closed

- [x] Create a Service (freezing its `service_registry_snapshots` / `service_announcement_set_slides`
      snapshot). Edit the live Announcement Set's slides (content, order, and membership), retarget
      the live marker's `ann_set_id`, and edit the live Announcement Set label afterwards. Assert the
      frozen Service's rendered plan still reflects the **pre-edit** content and marker identity.
- [x] Run Sync Artifact on that same Service. Assert it now reflects the **post-edit** content.
- [x] An unfrozen Service and live preview (`serviceID` 0) both continue to reflect live Announcement
      Set edits immediately, with no freeze.
- [x] Tested zero-slides freeze regression: an Announcement Set frozen with 0 slides does not leak
      later-added live slides into the frozen snapshot.
- [x] Tested cascade delete: deleting a Service cleans up its paired `service_announcement_set_slides` rows.
