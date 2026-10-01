# 03: Run Sheet Single-Blob PPTX Export Integration with Sync Prompt & Resilient Upload

**What to build:** In `internal/httpapi/onedrive_upload.go`, `spa/src/pages/RunSheetPage.tsx`, `spa/src/components/onedrive/OneDriveSyncPromptModal.tsx`, `spa/src/i18n/`, and `tests/onedrive-connector.test.mjs`:

1. **Backend Upload Endpoint (`internal/httpapi/onedrive_upload.go`)**:
   - `POST /api/services/:id/onedrive-upload`:
     - Accepts `multipart/form-data` containing the PPTX file blob.
     - Reads user's `onedrive_configs` from SQLite (verifying connection, valid tokens, and `target_folder_id`).
     - Streams presentation directly to Microsoft Graph:
       - File size < 4MB: simple upload via `PUT /v1.0/me/drive/items/{folder_id}:/{filename}:/content`.
       - File size >= 4MB: creates upload session via `POST /v1.0/me/drive/items/{folder_id}:/{filename}:/createUploadSession` and uploads in chunked ranges with exponential backoff on transient errors.
       - Uses `@microsoft.graph.conflictBehavior: "rename"` to prevent overwriting existing presentations.
     - Returns `{ success: true, web_url: string, filename: string }`.

2. **Run Sheet Single-Blob PPTX Export Workflow (`spa/src/pages/RunSheetPage.tsx`)**:
   - Query OneDrive configuration on mount or run sheet load (`GET /api/settings/onedrive`).
   - Implement single-generation export pipeline:
     - On clicking primary `Download PPTX` (or selecting a word-wrap variant):
       - Fetch presentation blob **once**: `const blob = await fetch('/api/services/' + svc.id + '/pptx?wrap=' + wrap).then(r => r.blob());`
       - Immediately trigger local file save via `URL.createObjectURL(blob)` and a hidden anchor click, ensuring guaranteed local offline presentation delivery.
       - Evaluate OneDrive configuration:
         - If `!connected` or `sync_mode === 'off'`: export process completes immediately.
         - If `sync_mode === 'ask'`: open `OneDriveSyncPromptModal` passing the pre-generated `blob`.
         - If `sync_mode === 'always'`: immediately dispatch background upload passing the pre-generated `blob`.

3. **Sync Confirmation Prompt Modal (`OneDriveSyncPromptModal.tsx`)**:
   - Localized with `useT()`:
     - Title: "Sync to OneDrive?" / "Sinkronkan ke OneDrive?"
     - Body: "Presentation has been downloaded to your computer. Would you like to sync a copy to OneDrive?"
     - Target summary: "Target Folder: `<target_folder_path>`" with `[Change Folder]` shortcut.
     - Checkbox option: `[ ] Don't ask again (always sync automatically in the future)`.
     - When checked and user confirms: sends `POST /api/settings/onedrive` with `sync_mode: 'always'`. If that setting update fails, current upload still proceeds and toast notifies that preference was not saved.
     - Action buttons:
       - `[Skip / Jangan Sinkronkan]`: closes modal without uploading.
       - `[Sync Now / Sinkronkan Sekarang]`: closes modal and dispatches upload with the existing blob.

4. **Resilient Feedback & Error Invariant**:
   - Non-blocking toast notifications:
     - Progress: "Uploading to OneDrive..."
     - Success: "✓ Saved to OneDrive: `<filename>`" with clickable link to open web URL.
     - Error: "Failed to upload to OneDrive: `<error>`" with `[Retry]` action.
   - Core Invariant: A cloud upload failure or network timeout **never** invalidates, deletes, or delays the already-completed local file download.

**Blocked by:** SPEC-95-02

**Status:** open

- [ ] Implement `POST /api/services/:id/onedrive-upload` endpoint in Go backend with chunked upload session support.
- [ ] Implement single-blob export pipeline in `RunSheetPage.tsx` honoring active word-wrap variant.
- [ ] Implement `OneDriveSyncPromptModal.tsx` with bilingual `useT()` localization.
