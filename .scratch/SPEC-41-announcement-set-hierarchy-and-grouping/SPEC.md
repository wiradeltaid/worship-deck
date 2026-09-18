# SPEC-41 — Announcement Set Slide Hierarchy and Grouping in Presenter Operator and Live Slide Preview

> **Status:** open
> **Release:** announcement-set-hierarchy-and-grouping
> **Component:** presenter
> **Touches:** slide-plan, present-channel, artifacts, services
> **Depends on:** SPEC-40

## Problem Statement

During live presentation and service review operations, operators observed a major structural inconsistency between Song Sets and Announcement Sets in the slide navigation list:

1. **Missing Grouping & Flat Cluttered Slide List for Announcements (Finding 1):**
   When an Announcement Set containing multiple slides (e.g. 5 announcement items) is inserted into a service deck, its slides are rendered as a completely flat, disconnected list of items:
   ```
   1  [Title] Announcement
   2  Announcement (1)
   3  Announcement (2)
   4  Announcement (3)
   5  Announcement (4)
   6  Announcement (5)
   ```
   Unlike Song Sets, which are grouped under a distinct header with indented children, announcements appear as arbitrary individual slides without visual boundaries or set context. Operators cannot tell at a glance where an announcement block starts or ends.

2. **Song Set Hierarchy Success Contrast (Finding 2):**
   Song Sets currently render with a clean hierarchical group header and indented child items:
   ```
   [Song Set] Pembukaan
     10  1. Di Hadapan Hadirat-Mu
     11  2. Tuhan Allah Beserta Engkau
     12  3. Terpujilah Allah
   ```
   This grouping greatly aids navigation, allows the operator to collapse or perceive the section as a unified liturgical block, and clarifies the relationship between the set title and the individual slides.

3. **Hardcoded Group Type Badging in Presenter Operator:**
   In `src/operator/present/PresenterOperator.tsx`, the group header badge currently hardcodes `Song Set` for every group (`row.kind === 'group'`), and `SlidePreviewList.tsx` assumes all groups are Song Sets (`resolveSongSetGroupBadge`). When announcement sets are grouped, they must carry their own distinct badge (`[Announcement]`) and tone rather than falsely labeling announcement slides as a "Song Set".

4. **Planner Flattening of Announcement Set Markers:**
   Both the TypeScript planner (`src/lib/slide-plan.ts`) and the Go planner (`internal/plan/plan.go`) currently expand `ann-set-marker` by pushing raw, flat leaf nodes with no parent group reference (`ArtifactGroupRef`). Because child slides lack a `groupId`, presentation projections (`buildPresenterRows` and `buildRows`) cannot identify them as members of a group.

## Solution

1. **Group Node Generation & Unique Identity for Announcement Sets in Planners:**
   - In `src/lib/slide-plan.ts`:
     When expanding a template with `baseType === 'ann-set-marker'`:
     - Retrieve the announcement set label from `announcement_sets WHERE id = ?`.
     - Strict fallback chain: `set.label` (or `set.name`) -> `template.label` -> `'Announcement'`.
     - Collision-safe Group ID: `${template.id}-set-${template.annSetId}` (ensures repeated insertions of the same set across the deck maintain distinct group identities in React rendering and presentation rows).
     - Unique Child IDs: `${template.id}-ann-slide-${slide.id}` preserving linear order.
     - Emit a structured group node:
       `{ kind: 'group', id: groupId, label: setLabel, children: [...] }`
       where each slide in the set is hydrated with an `ArtifactGroupRef`:
       `{ id: groupId, label: setLabel, role: 'announcement', roleLabel: slide.label }`.
   - In `internal/plan/plan.go` and `internal/plan/snapshot.go`:
     - Populate `snap.AnnouncementSetLabels[id]` during snapshot assembly from `announcement_sets`.
     - When `tmpl.BaseType == "ann-set-marker"`, apply the identical fallback chain and emit a `node` with `kind: "group"`, `id: fmt.Sprintf("%s-set-%d", tmpl.ID, *tmpl.AnnSetID)`, and `label: setLabel`, containing each slide as a `groupChild{role: "announcement", roleLabel: sl.Label, req: ...}`.
   - Exact literal union: update `ArtifactGroupRef.role` and `PreviewEntry.role` in `src/lib/artifacts/runtime-contract.ts` and `src/lib/artifacts/preview-model.ts` to strictly `'title' | 'lyric' | 'announcement'` (no loose `| string`).

2. **Dynamic Group Badges and Hierarchy in Presenter Operator:**
   - In `src/operator/present/presenter-model.ts`:
     - Update `PresenterRow` of kind `'group'` to include `groupKind: 'song-set' | 'announcement'`.
     - In `buildPresenterRows`, discriminate `groupKind: entry.groupId?.startsWith('ann-') || entry.role === 'announcement' ? 'announcement' : 'song-set'`.
     - Provide fallback labels: `'Announcement'` for announcement groups, `'Song Set'` for song sets.
   - In `src/operator/present/PresenterOperator.tsx`:
     - Render group headers with dynamic badging:
       - Song Set: `<span className="border-primary/40 bg-primary/15 text-primary">Song Set</span>`
       - Announcement Set: `<span className="border-purple-400/40 bg-purple-400/15 text-purple-200 dark:border-purple-400/40 dark:bg-purple-400/15 dark:text-purple-200">Announcement</span>`
     - Render `row.label` as the group title (e.g. `[Announcement] Warta Jemaat`).
     - Indent child announcement slides under `<div className="ml-3 border-l border-border pl-1">`, displaying:
       - Linear slide index (`entry.index + 1`)
       - Slide label/badge
       - Slide title (e.g. `1. Jadwal Ibadah`, `2. Kerja Bakti`)
     - Preserve full slide navigation and active highlighting when clicking any child slide.

3. **Live Slide Preview Hierarchy & Theme-Safe Accessibility:**
   - In `src/lib/artifacts/preview-model.ts`:
     - Implement `resolveAnnouncementGroupBadge(groupOrdinal?: number): string` emitting `ann-set-N` or `ann-set` for aria/test keys.
     - Ensure `resolvePreviewBadge` and `resolvePreviewTitle` handle `role === 'announcement'`.
   - In `src/components/SlidePreviewList.tsx`:
     - Differentiate between Song Set and Announcement Set groups in `buildRows`.
     - In the group header, visibly display badge `[Announcement]` (or localized) followed by `{row.label}`.
     - Dark-theme safe styling: apply `bg-purple-500/10 text-purple-600 border-purple-500/20 dark:bg-purple-400/15 dark:text-purple-200 dark:border-purple-400/40` for badge and `border-l-2 border-purple-500/30 dark:border-purple-400/30` for child indentation, clearing WCAG contrast floors.

4. **Behavioral Verification & Defect-Injection Absence Proofs:**
   - Verify TypeScript and Go plan parity with announcement groups containing ordered children.
   - Test repeat marker insertion of the same announcement set proving unique group keys and linear indices.
   - Test empty announcement set and missing parent label fallback behavior.
   - Executable Absence Guard 1: Verify test failure when announcement slides are emitted as flat ungrouped leaves.
   - Executable Absence Guard 2: Verify test failure when announcement groups display hardcoded `Song Set` badge.

## User Stories

1. As a presenter operator, I want announcement slides to be grouped under an `[Announcement] {Name}` header with indented child slides, so that the deck list is structured and readable.
2. As a presenter operator, I want announcement group headers to clearly say `Announcement` (not `Song Set`), so that liturgical sections are never mislabeled.
3. As a church administrator reviewing a service in Hub, I want the Live Slide Preview to show announcement sets as grouped hierarchical blocks, so that the preview matches the presentation structure.
4. As an operator clicking on an announcement child slide in the Presenter sidebar, I want the presenter to immediately activate and project that exact slide.

## Implementation Decisions

1. **Slide Plan Group Shape & Fallback Chain:**
   - In `src/lib/slide-plan.ts` and `internal/plan/plan.go`, `ann-set-marker` emits `kind: 'group'`.
   - Group label priority: `set.label` -> `template.label` -> `'Announcement'`.
   - Unique group ID: `${template.id}-set-${annSetId}`.
   - Child role is strictly literal `'announcement'`.

2. **Presenter Model Group Discrimination:**
   - `buildPresenterRows` assigns `groupKind: 'announcement'` when `entry.role === 'announcement'` or `entry.groupId` represents an announcement set.
   - `PresenterOperator` renders distinct badge colors and labels for `song-set` vs `announcement`.

3. **Component & Touch Allocation:**
   - `SPEC-41-01`: Group node emission and fallback parity in TypeScript and Go planners (`touches: [slide-plan, artifacts]`).
   - `SPEC-41-02`: Presenter Operator grouping, dynamic badge rendering, and model updates (`touches: [present-channel, slide-plan]`, `blocked_by: ["SPEC-41-01"]`).
   - `SPEC-41-03`: Hub Live Slide Preview grouping alignment, dark-theme contrast, and behavioral smoke tests (`touches: [present-channel, services]`, `blocked_by: ["SPEC-41-02"]`).
