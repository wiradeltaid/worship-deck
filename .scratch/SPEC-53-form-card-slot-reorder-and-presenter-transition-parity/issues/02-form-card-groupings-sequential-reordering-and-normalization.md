# 02: Form Card Groupings Sequential Reordering & Database Normalization

**What to build:**
Resolve the defect preventing form grouping cards from properly moving up and down:
1. Client-Side Sequential Reordering Engine:
   - In both `src/components/admin/FormLayoutAdminPanel.tsx` (dedicated Admin surface) and `src/operator/DynamicFormBody.tsx` (embedded operator surface):
     - Refactor `handleMoveGrouping` to perform a full array splice-and-reindex operation across the entire `layoutData.groupings` collection.
     - Generate sequential 1..N `sort_order` values for every card in the layout:
       ```ts
       const reordered = [...groupings];
       const [moved] = reordered.splice(index, 1);
       reordered.splice(targetIndex, 0, moved);
       const payload = reordered.map((g, i) => ({ id: g.id, sort_order: i + 1 }));
       ```
     - Submit the complete ordered collection to `PUT /api/admin/form-groupings/reorder`.
2. Backend Go Handler Validation & Normalization Contract (`internal/httpapi/form_layout.go`):
   - In `reorderFormGroupings`:
     - Strictly validate the incoming payload against the database layout membership:
       - Reject payloads that are empty, contain duplicate IDs, duplicate sort orders, non-positive sort orders, unknown IDs, or IDs spanning multiple layouts with HTTP 400 Bad Request and zero row mutations.
       - Require exact current membership of the target layout.
     - Atomically persist exactly `1..N` contiguous sort orders in a single transaction.
3. Integration Tests in Go (`internal/httpapi/form_layout_test.go`):
   - Add negative tests asserting HTTP 400 when submitting partial, duplicate, or cross-layout payloads.
   - Add positive test asserting that reordering cards (e.g. moving the bottom card to the top) persists contiguous sequential sort orders without corrupting unmentioned cards.

**Satisfies:** UC-5, FR-11, FR-32

**Touches:** services, artifacts

**Blocked by:** SPEC-53-01

**Status:** open

- [ ] Refactor client `handleMoveGrouping` in both `FormLayoutAdminPanel.tsx` and `DynamicFormBody.tsx` to submit complete normalized sequential arrays.
- [ ] Implement strict membership validation in Go `reorderFormGroupings` rejecting partial/invalid payloads with HTTP 400.
- [ ] Atomically persist `1..N` contiguous sort orders inside a single database transaction.
- [ ] Author integration tests in `internal/httpapi/form_layout_test.go` validating both negative rejection and positive multi-card reordering.
