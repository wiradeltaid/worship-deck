# 03: Intra-Card Slot Reordering & Cross-Card Slot Transfer Engine

**What to build:**
Implement granular slot reordering inside cards as well as an atomic cross-card slot transfer engine:
1. Slot Reordering Within Card Groupings:
   - In `src/components/admin/FormLayoutAdminPanel.tsx`:
     - Add `[ ▲ ]` and `[ ▼ ]` action buttons for every slot row inside a card.
     - When moving a slot up or down within its parent card, calculate sequential 1..M sort orders for all slots in that grouping and dispatch `PUT /api/admin/form-grouping-slots/reorder`.
   - In `internal/httpapi/form_layout.go`:
     - Enforce full-membership validation for `reorderFormGroupingSlots`: require exact slot membership of the parent grouping and persist contiguous `1..M` sort orders.
2. Cross-Card Slot Transfer Mechanism:
   - UI in `FormLayoutAdminPanel.tsx`: Provide a `[ Pindah Kartu... ]` dropdown/button on each slot row listing other card groupings in the same layout.
   - Backend Endpoint: Add `POST /api/admin/form-grouping-slots/{id}/move-grouping` taking `{ target_grouping_id: string }`.
   - **Atomic Transfer Transaction:**
     1. Verify the slot exists, and verify that both source grouping and target grouping exist within the exact same `layout_id`.
     2. Reject self-moves (`source_grouping_id == target_grouping_id`) with HTTP 400 Bad Request.
     3. Close the gap in the source grouping by reindexing all remaining slots contiguously `1..(M-1)`.
     4. Append the moved slot to the target grouping with `sort_order = COALESCE(MAX(sort_order), 0) + 1` and update its `grouping_id`.
     5. Preserves the layout-wide database invariant `UNIQUE(layout_id, widget_kind, ref_key)`.
3. Integration Tests in Go:
   - Author integration tests in `internal/httpapi/form_layout_test.go` verifying intra-card slot reordering, cross-card transfer with source gap closure, and rejection of cross-layout or self-moves.

**Satisfies:** UC-5, FR-11, FR-32

**Touches:** services, artifacts

**Blocked by:** SPEC-53-02

**Status:** closed

- [x] Add `[ ▲ ]` and `[ ▼ ]` reorder buttons to each slot row in `FormLayoutAdminPanel.tsx` with sequential 1..M reordering.
- [x] Add `[ Pindah Kartu... ]` selector to each slot row for cross-card movement.
- [x] Implement `POST /api/admin/form-grouping-slots/{id}/move-grouping` in Go with atomic source gap closure and target appending.
- [x] Enforce layout-boundary checks and reject self-moves with HTTP 400.
- [x] Author integration tests verifying intra-card reordering and cross-card slot transfer data integrity.
