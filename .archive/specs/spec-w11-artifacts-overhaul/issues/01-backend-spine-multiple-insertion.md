# Issue 01 — Backend Spine Multiple Insertion & Decoupled Position

**Status:** done

## Summary
Satisfies UC-15 (FR-21). Decouple song-set entries and announcement-set markers on `artifact_templates` from single-slot constraints, allowing multiple dynamic insertions of the same Song Set or Announcement Set across the Main Spine.

## Implementation Details
- Ensure `POST /api/admin/artifacts` and reordering endpoints handle multiple spine nodes referencing the same `variable_name` or `ann_set_id` with unique template IDs.
- Ensure `internal/plan/plan.go` snapshot resolution correctly hydrates repeated song-set entries or announcement-set markers at their respective sequence positions.

## Tests
- `tests/registry.test.mjs`
- `tests/registry-go-http.test.mjs`
