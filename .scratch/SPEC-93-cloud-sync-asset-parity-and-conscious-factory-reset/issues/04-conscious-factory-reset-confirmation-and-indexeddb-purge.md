# 04: Conscious Factory Reset Confirmation & IndexedDB Cache Purge

**What to build:** In `spa/src/pages/AdminSyncPage.tsx`, `internal/httpapi/admin_reset.go`, `src/lib/i18n/`, `package.json`, and `tests/conscious-factory-reset.test.mjs`:

1. **Conscious Confirmation Input (`spa/src/pages/AdminSyncPage.tsx`)**:
   - In `resetModalOpen` Dialog:
     - Add instruction copy explaining the exact destructive scope (services, custom templates, custom layouts, and uploads will be erased; accounts and server settings remain intact).
     - Display literal operator instruction copy:
       `"Type: factory reset to begin resetting"` (EN) / `"Ketik: factory reset untuk memulai reset"` (ID).
     - Add an `<Input>` component:
       ```tsx
       <Input
         value={resetConfirmationText}
         onChange={(e) => setResetConfirmationText(e.target.value)}
         placeholder="factory reset"
         className="mt-2"
       />
       ```
     - Disable the destructive confirm button until `resetConfirmationText.trim().toLowerCase() === 'factory reset'`.
     - Reset `resetConfirmationText` to empty string when dialog closes or succeeds.

2. **Client-Side Cache Purge & Blocking Remediation (`spa/src/pages/AdminSyncPage.tsx`)**:
   - In `handleFactoryReset`:
     ```ts
     const res = await fetch('/api/admin/reset-factory', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ confirm: 'factory reset' }),
     });
     if (!res.ok) {
       const body = await res.json().catch(() => null);
       throw new Error(body?.message || `Factory reset rejected (${res.status})`);
     }
     
     // Purge client-side IndexedDB caches before reloading
     try {
       await clearOfflineStorage();
     } catch (err) {
       console.warn('[reset] clearOfflineStorage failed, attempting deleteDatabase fallback:', err);
       try {
         await new Promise<void>((resolve, reject) => {
           const req = indexedDB.deleteDatabase('worship_deck_offline_db');
           req.onsuccess = () => resolve();
           req.onerror = () => reject(req.error);
         });
       } catch (dbErr) {
         setMessage({
           type: 'error',
           text: 'Database was reset on server, but local browser cache could not be cleared. Please clear your browser cache manually before proceeding.',
         });
         return; // Block reload into corrupt/stale state
       }
     }
     
     setMessage({ type: 'success', text: t('sync.factoryReset.success') });
     setTimeout(() => window.location.reload(), 1500);
     ```
   - Prevents stale offline service snapshots and media cache blobs from resurfacing after a factory reset.

3. **Mandatory Server-Side Validation (`internal/httpapi/admin_reset.go`)**:
   - In `handleResetFactory`:
     - Strictly parse JSON body requiring `{ "confirm": "..." }`.
     - If `strings.ToLower(strings.TrimSpace(req.Confirm)) != "factory reset"`, return HTTP 400 Bad Request with `{ "error": "invalid_confirmation", "message": "Confirmation phrase 'factory reset' is required" }`.

4. **Bilingual Localization (`src/lib/i18n/`)**:
   - Add new i18n keys for conscious confirmation instructions ("Type: factory reset to begin resetting"), input placeholder, and confirmation mismatch warnings in `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts` with 100% parity.

5. **Automated Verification Suite (`tests/conscious-factory-reset.test.mjs`)**:
   - Static and behavioral test verifying AdminSyncPage button is disabled until `"factory reset"` is input.
   - Assert `clearOfflineStorage()` is called upon factory reset and blocks reload on failure.
   - Assert `POST /api/admin/reset-factory` rejects missing, empty, or mismatched confirmation body with HTTP 400.
   - Assert bilingual key parity across English and Indonesian catalogues.

Satisfies `FR-20`, `FR-21`, `UC-14`, `UC-15`.

**Blocked by:** SPEC-93-03

**Status:** open

- [ ] In `spa/src/pages/AdminSyncPage.tsx`:
      - Add conscious confirmation input gating destructive reset button.
      - Await `clearOfflineStorage()` before window reload.
- [ ] In `internal/httpapi/admin_reset.go`:
      - Validate confirmation token in request body.
- [ ] In `src/lib/i18n/`:
      - Add bilingual i18n keys to `keys.ts`, `catalogue-en.ts`, and `catalogue-id.ts`.
- [ ] In `package.json`:
      - Register `tests/conscious-factory-reset.test.mjs`.
- [ ] In `tests/conscious-factory-reset.test.mjs`:
      - Implement contract assertions and defect injection proofs.
