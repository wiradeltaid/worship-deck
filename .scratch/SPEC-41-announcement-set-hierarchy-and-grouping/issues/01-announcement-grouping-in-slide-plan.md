# SPEC-41-01 — Announcement Set Grouping in TypeScript and Go Slide Planners

**What to build:**
Update the slide plan builders in both TypeScript (`src/lib/slide-plan.ts`) and Go (`internal/plan/plan.go`) so that `ann-set-marker` templates expand into structured `group` nodes instead of flat leaf nodes. Broaden `ArtifactGroupRef.role` and `PreviewEntry.role` to strictly `'title' | 'lyric' | 'announcement'` without loose `string` widening. Implement collision-safe IDs for repeated marker insertions and an authoritative label fallback chain.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Runtime Contract (`src/lib/artifacts/runtime-contract.ts` and `src/lib/artifacts/preview-model.ts`):
  - In `ArtifactGroupRef` and `PreviewEntry`, define `role?: 'title' | 'lyric' | 'announcement'` as an exact literal union without `| string`. Update all parameter types across resolvers (`resolvePreviewBadge`, `resolvePreviewTitle`) accordingly.
- [ ] TypeScript Slide Planner (`src/lib/slide-plan.ts`):
  - When expanding `template.baseType === 'ann-set-marker'`:
    - Retrieve announcement set label from `announcement_sets WHERE id = ?`.
    - Apply fallback chain: `set.label` (or `set.name`) -> `template.label` -> `'Announcement'`.
    - Derive collision-safe group ID: `${template.id}-set-${template.annSetId}` (ensuring multiple spine markers referencing the same set maintain distinct unique group identities).
    - Derive unique child slide IDs: `${template.id}-ann-slide-${slide.id}` preserving order.
    - Emit a `group` node:
      `{ kind: 'group', id: groupId, label: setLabel, children: [...] }`
    - Hydrate each child slide with `ArtifactGroupRef`:
      `{ id: groupId, label: setLabel, role: 'announcement', roleLabel: slide.label }`
- [ ] Go Slide Planner & Snapshot (`internal/plan/plan.go`, `internal/plan/snapshot.go`, `internal/plan/types.go`):
  - Extend `Snapshot` struct in `internal/plan/types.go` with `AnnouncementSetLabels map[int]string`.
  - In `internal/plan/snapshot.go`, query `announcement_sets` to populate `snap.AnnouncementSetLabels`.
  - In `buildPlan` (`internal/plan/plan.go`), when `tmpl.BaseType == "ann-set-marker"`:
    - Apply identical fallback: `snap.AnnouncementSetLabels[*tmpl.AnnSetID]` -> `tmpl.Label` -> `"Announcement"`.
    - Emit a `node` with `kind: "group"`, `id: fmt.Sprintf("%s-set-%d", tmpl.ID, *tmpl.AnnSetID)`, and `label: setLabel`.
    - Append each slide as `groupChild{role: "announcement", roleLabel: sl.Label, req: ...}`.
- [ ] Planner Parity Unit Tests:
  - Add tests in `tests/slide-plan.test.mjs` verifying:
    - `ann-set-marker` emits a `group` node with correct `id`, `label`, and ordered child slides.
    - Two markers referencing the same announcement set produce distinct group IDs and distinct child instance IDs.
    - Fallback to template label or `'Announcement'` when the set record has no label.
