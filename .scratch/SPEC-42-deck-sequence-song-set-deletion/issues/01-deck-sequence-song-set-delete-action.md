# SPEC-42-01 — Expose Per-Row Delete Action for Song Set Slides in Deck Sequence

**What to build:**
Remove the hardcoded exclusion of `song-set-entry` slides from the Deck Sequence delete button in `src/components/admin/ArtifactEditor.tsx`. Add informative confirmation messaging reassuring operators that removing a song set from the deck sequence preserves master data, maintaining safety warnings when the active canvas has unsaved changes.

**Blocked by:** None (can start immediately)

**Status:** closed

- [x] Artifact Editor UI (`src/components/admin/ArtifactEditor.tsx`):
  - In `templates.map`, remove any conditional checking `item.baseType === 'song-set-entry'` around the delete button.
  - Render the delete button uniformly for all items:
    ```tsx
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={t('admin.artifacts.delete')}
      onClick={(e) => {
        e.stopPropagation();
        void handleDeleteTemplate(item);
      }}
      disabled={busy || isDeletingSelected}
      className="h-7 w-7 p-1 text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </Button>
    ```
  - In `handleDeleteSelectedTemplates`:
    - When deleting a single item of `baseType === 'song-set-entry'`:
      - If active and dirty: compose dirty warning with master data reassurance (`t('admin.artifacts.confirmDeleteSongSetDirty')`).
      - Otherwise: `t('admin.artifacts.confirmDeleteSongSet')`.
    - For bulk deletion containing song set items, confirm removal from the deck sequence without implying master data loss.
    - Guarantee that the Deck Sequence UI never calls `/api/admin/song-set-entries/{id}`.
- [x] Localization (`src/lib/i18n/catalogue-en.ts` and `src/lib/i18n/catalogue-id.ts`):
  - Add `admin.artifacts.confirmDeleteSongSet`:
    - EN: `"Remove song set \"{label}\" from the slide deck? It will remain available in Song Sets master data."`
    - ID: `"Hapus slide song set \"{label}\" dari urutan slide? Song set tetap tersimpan di master data Song Sets."`
  - Add `admin.artifacts.confirmDeleteSongSetDirty`:
    - EN: `"You have unsaved changes on \"{label}\". Discard changes and remove from the slide deck? It will remain available in Song Sets master data."`
    - ID: `"Anda memiliki perubahan belum disimpan pada \"{label}\". Buang perubahan dan hapus dari urutan slide? Song set tetap tersimpan di master data Song Sets."`
