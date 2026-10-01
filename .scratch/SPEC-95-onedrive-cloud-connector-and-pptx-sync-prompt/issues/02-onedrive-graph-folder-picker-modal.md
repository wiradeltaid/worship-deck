# 02: Backend-Proxied Microsoft Graph Target Folder Browser Modal

**What to build:** In `internal/httpapi/onedrive_proxy.go`, `spa/src/components/settings/OneDriveFolderPickerModal.tsx`, `spa/src/i18n/`, and `tests/onedrive-connector.test.mjs`:

1. **Backend Graph Proxy Endpoints (`internal/httpapi/onedrive_proxy.go`)**:
   - `GET /api/settings/onedrive/folders`:
     - Query parameter: `parent_id` (optional).
     - Obtains current user's active `access_token` from SQLite (auto-refreshing via refresh token if expired).
     - If `parent_id` is empty or `"root"`:
       Calls Microsoft Graph: `GET /v1.0/me/drive/root/children?$filter=folder ne null&$select=id,name,parentReference,folder,lastModifiedDateTime`
     - If `parent_id` is specified:
       Calls Microsoft Graph: `GET /v1.0/me/drive/items/{parent_id}/children?$filter=folder ne null&$select=id,name,parentReference,folder,lastModifiedDateTime`
     - Returns normalized JSON array of folders:
       ```json
       [{ "id": "...", "name": "...", "child_count": 5, "last_modified": "...", "parent_id": "..." }]
       ```

2. **Folder Browser Dialog Modal (`OneDriveFolderPickerModal.tsx`)**:
   - Interactive dialog overlay localized with `useT()`:
     - Header: "Select Target Folder in OneDrive" / "Pilih Folder Tujuan di OneDrive" with close button.
     - Breadcrumb navigation: Clickable crumbs allowing navigation back to root or any ancestor folder.
     - Folder listing:
       - Visual list items with folder icon, folder name, child item count, and modified timestamp.
       - Double-click or click navigation chevron enters child folder.
       - Single-click highlights and selects folder as the active choice.
     - Empty state, loading spinner, and retry button on fetch error.
     - Footer actions:
       - Displays currently selected folder path: e.g. `Selected: /Sunday Services/2026/`
       - `[Cancel]` / `[Batal]` button.
       - `[Select This Folder]` / `[Pilih Folder Ini]` button:
         - Dispatches `POST /api/settings/onedrive` with selected `target_folder_id` and formatted `target_folder_path`.
         - Closes modal and updates `OneDriveConnectorCard`.

**Blocked by:** SPEC-95-01

**Status:** open

- [ ] Implement backend Graph proxy endpoint for folder listing in `internal/httpapi/onedrive_proxy.go`.
- [ ] Implement `OneDriveFolderPickerModal.tsx` with breadcrumbs, folder selection, and child item metadata.
- [ ] Wire folder selection submission to update `target_folder_id` and `target_folder_path`.
