# 03: React Admin Sync Ephemeral Remote Authentication Modal and Origin-Bound Lifecycle

**What to build:** In `spa/src/pages/AdminSyncPage.tsx`, simplify the connection settings UI and implement an on-demand ephemeral authentication modal with strict origin binding:

1. **Connection Settings UI Cleanup**:
   - Remove the `Device Authorization Token (Optional)` field and misleading `"Bearer token or 6-digit pairing code"` placeholder.
   - Retain `Remote Web Server URL` as the primary configuration input.
   - Add a connection state chip in the settings card:
     - When `remoteUrl` is local (`window.location.origin`): display `Local Workstation (Active Session)`.
     - When `remoteUrl` is a remote server and `inMemoryRemoteToken` exists: display `Remote Session Active (In-Memory)` with an inline `Disconnect` button.
     - When `remoteUrl` is a remote server and `inMemoryRemoteToken` is null: display `Remote Cloud (Authentication Required)`.

2. **Origin-Bound Ephemeral Remote Authentication Modal (`RemoteAuthDialog`)**:
   - Add state: `authModalOpen: boolean`, `remoteUsername: string`, `remotePassword: string`, `authError: string | null`, `pendingAction: 'push' | 'pull' | null`, `inMemoryRemoteToken: string | null`, `boundRemoteOrigin: string | null`.
   - **Normalized Origin Binding Invariant**:
     - Whenever `remoteUrl` changes (or when saving connection settings), compute `currentOrigin = new URL(remoteUrl, window.location.origin).origin`.
     - If `currentOrigin !== boundRemoteOrigin`: immediately reset `inMemoryRemoteToken = null` and `boundRemoteOrigin = currentOrigin`. This guarantees a token obtained for Host A is never transmitted to Host B.
   - When operator clicks **Push to Cloud** or **Pull from Cloud**:
     - Check if `remoteUrl` points to a foreign host (`new URL(remoteUrl, window.location.origin).origin !== window.location.origin`).
     - If foreign and `!inMemoryRemoteToken`:
       - Record `pendingAction = 'push' | 'pull'` and open `RemoteAuthDialog`.
       - Prompt: *"Connect to Remote WorshipDeck Server: Enter Admin Username & Password for <remoteUrl>"*.
       - On dialog submit:
         - Call `loginRemote(remoteUrl, remoteUsername, remotePassword)`.
         - On success: store token in `inMemoryRemoteToken`, set `boundRemoteOrigin`, close dialog, clear `remotePassword` immediately, and execute the queued `pendingAction` exactly once with `headers: { Authorization: `Bearer ${inMemoryRemoteToken}` }`.
         - On failure: display error inside the modal without disrupting local application state.
     - If `remoteUrl` is local OR `inMemoryRemoteToken` is already set:
       - Proceed with sync immediately.
       - If any remote sync request fails with HTTP 401 (`err.status === 401` from `SyncHttpError`): clear `inMemoryRemoteToken = null` and re-open `RemoteAuthDialog` with message: *"Remote session expired. Please log in again."*
   - Provide an explicit "Disconnect / Clear Remote Session" button that clears `inMemoryRemoteToken = null`.

3. **Storage Security Invariant**:
   - `inMemoryRemoteToken`, `remoteUsername`, and `remotePassword` MUST NEVER be written to `localStorage`, `sessionStorage`, cookies, IndexedDB, or disk.

Satisfies `FR-40`, `FR-21`, and `UC-32`.

**Blocked by:** SPEC-88-02

**Status:** closed

- [x] In `spa/src/pages/AdminSyncPage.tsx`:
      - Remove legacy token input and confusing placeholder.
      - Implement `RemoteAuthDialog` for on-demand remote login.
      - Enforce origin-bound token lifecycle clearing on URL change, unmount, disconnect, and 401.
      - Wire `inMemoryRemoteToken` into `handlePush` and `handlePull` operations.
      - Add session disconnect action and remote connection status badge.
- [x] In `tests/admin-sync-ephemeral-auth.test.mjs`:
      - Verify removal of legacy pairing code placeholder from sync page.
      - Verify in-memory ephemeral token lifecycle and absence of local/session storage leakage.
