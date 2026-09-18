# SPEC-42 — Deck Sequence Song Set Deletion and Master Data Decoupling Assurance

> **Status:** closed
> **Release:** deck-sequence-song-set-deletion
> **Component:** registry
> **Touches:** artifacts, services
> **Depends on:** SPEC-41

## Problem Statement

During manual testing in the Artifact Editor (main spine / Deck Sequence), operators identified an operational gap preventing song set slide management:

1. **Suppressed Delete Button for Song Set Slides in Main Spine:**
   In `src/components/admin/ArtifactEditor.tsx`, the hover actions for deck sequence items explicitly suppress the delete button when `item.baseType === 'song-set-entry'`:
   ```tsx
   {item.baseType === 'song-set-entry' ? null : (
     <Button ... title={t('admin.artifacts.delete')}>
       <Trash2 className="w-3.5 h-3.5" />
     </Button>
   )}
   ```
   Because of this hardcoded conditional, operators cannot remove a song set slide instance from the main deck sequence using the standard delete icon button on the item card.

2. **Operator Requirement for Master Data Decoupling:**
   Operators expect clear separation between the main spine deck sequence and song set master data:
   - **Main Spine Removal:** Deleting a song set slide from the main spine (`artifact_templates` / Deck Sequence) only removes that slide instance from the deck sequence; it does not delete the song set from master data.
   - **Master Data Authority:** Master data deletion of a song set (removing it permanently from the church catalog) can only be performed from the dedicated **Song Sets** admin panel (`SongSetEntriesPanel.tsx`). The Deck Sequence UI must never call `/api/admin/song-set-entries/{id}`.
   - **Multi-Instance Criteria:** Operators can insert the same song set multiple times into the main spine (via `New Slide` $\to$ select song set). Deleting one instance from the spine must remove only that specific instance, leaving duplicate instances and master data untouched.
   - **Spine Deletion Semantics:** Removing all instances of a song set from the main spine simply indicates that the song set is not currently used in this deck sequence. It remains available in the `New Slide` dropdown to be re-inserted anytime.

## Solution

1. **Expose Per-Row Delete Button for All Main Spine Slides:**
   - In `src/components/admin/ArtifactEditor.tsx`, remove any conditional suppressing the delete button for `song-set-entry`.
   - Render the delete icon button uniformly on all deck sequence items without baseType discrimination.
   - Ensure the delete action invokes `handleDeleteTemplate(item)` seamlessly.

2. **Informative Delete Confirmation Copy & Dirty Canvas Safety:**
   - When deleting a single `song-set-entry` slide:
     - Normal case: "Remove song set \"{label}\" from the slide deck? (The song set remains available in Song Sets master data)."
     - Dirty active canvas case: preserve the unsaved changes warning composed with the master data reassurance: "You have unsaved changes on \"{label}\". Discard changes and remove from the slide deck? (The song set remains available in Song Sets master data)."
   - For bulk deletion containing song set items, confirm removal from the deck sequence without implying master data loss.

3. **Multi-Instance Resilience & Exact Master Data Invariance:**
   - Ensure backend `DELETE /api/admin/artifacts/{id}` continues to delete strictly from `artifact_templates` using the template `id`.
   - Re-sequence surviving `artifact_templates` positions deterministically while leaving all `song_set_entries` records strictly invariant (verifying `variable_name`, `title`, `position`, and `updated_at` remain identical).
   - Preserve multi-instance insertion: inserting the same song set multiple times creates distinct template rows, and deleting one removes only that specific instance.

4. **Authoritative Test Suite Integration & Defect-Injection Absence Proofs:**
   - Add `tests/smoke-spec-42.test.mjs` to `package.json`'s authoritative `test` script.
   - Extend `TestSongSetMasterDataDeckSequenceDecoupling` in `internal/httpapi/song_set_entries_test.go` with exact master data snapshot equality and multi-instance deletion checks.
   - Executable Absence Guard: Prove test failure when any conditional suppressing the delete button for `song-set-entry` is injected into `ArtifactEditor.tsx`.

## User Stories

1. As a church administrator editing the main spine, I want a visible delete button on song set slides in the Deck Sequence list, so that I can remove an unwanted song set slide from the service deck.
2. As a church administrator, I want removing a song set slide from the main spine to leave its master data intact, so that I never accidentally delete a song set from the church catalog while adjusting slide order.
3. As a church administrator, I want to insert the same song set into multiple positions in the deck sequence and delete individual instances independently without affecting others.
4. As a church administrator, I want clear confirmation messaging whether the active canvas is clean or dirty, stating that the song set is only being removed from the slide deck.

## Implementation Decisions

1. **Unified Deck Sequence Action Buttons:**
   - The hover action toolbar in `ArtifactEditor.tsx` renders `MoveUp`, `MoveDown`, `Duplicate`, and `Delete` for all slide types.

2. **Localized Confirmation Copy:**
   - Add localization strings in `catalogue-en.ts` and `catalogue-id.ts` for clean and dirty song set deletion reassurance.

3. **Component & Touch Allocation:**
   - `SPEC-42-01`: Expose per-row delete action and update confirmation copy in `ArtifactEditor.tsx` (`touches: [artifacts]`).
   - `SPEC-42-02`: Exact master data invariance tests, multi-instance resilience, and authoritative test suite inclusion (`touches: [artifacts, services]`, `blocked_by: ["SPEC-42-01"]`).
