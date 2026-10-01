# 01: Backend-Proxy OneDrive OAuth 2.0 PKCE Storage, Token Management, and Settings UI

**What to build:** In `internal/httpapi/onedrive.go`, `internal/store`, `spa/src/components/settings/OneDriveConnectorCard.tsx`, `spa/src/i18n/`, and `tests/onedrive-connector.test.mjs`:

1. **Per-User Backend Storage & Schema (`internal/store`)**:
   - Create table `onedrive_configs`:
     ```sql
     CREATE TABLE IF NOT EXISTS onedrive_configs (
       user_id INTEGER PRIMARY KEY,
       client_id TEXT NOT NULL DEFAULT '',
       tenant_id TEXT NOT NULL DEFAULT 'common',
       access_token TEXT NOT NULL DEFAULT '',
       refresh_token TEXT NOT NULL DEFAULT '',
       token_expiry INTEGER NOT NULL DEFAULT 0,
       account_email TEXT NOT NULL DEFAULT '',
       account_name TEXT NOT NULL DEFAULT '',
       target_folder_id TEXT NOT NULL DEFAULT '',
       target_folder_path TEXT NOT NULL DEFAULT '',
       sync_mode TEXT NOT NULL DEFAULT 'ask', -- 'ask' | 'always' | 'off'
       updated_at TEXT NOT NULL DEFAULT (datetime('now')),
       FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
     );
     ```

2. **Go HTTP API Endpoints (`internal/httpapi/onedrive.go`)**:
   - `GET /api/settings/onedrive`:
     - Requires authenticated session.
     - Queries `onedrive_configs` for current session user.
     - Returns public configuration status: `{ connected: bool, account_email: string, account_name: string, target_folder_id: string, target_folder_path: string, sync_mode: string }`.
     - Absence guard: Sensitive tokens (`access_token`, `refresh_token`) MUST NOT be serialized or leaked in this endpoint's response.
   - `POST /api/settings/onedrive`:
     - Updates user preferences: `sync_mode` (`ask`, `always`, `off`), `target_folder_id`, `target_folder_path`.
   - `GET /api/settings/onedrive/auth-url`:
     - Generates cryptographically random PKCE `code_verifier`, derives `code_challenge` (S256), and CSRF `state`.
     - Caches verifier and state in-memory associated with the user session (5-minute TTL, single-use consumption).
     - Returns Microsoft authorization URL with authority `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`.
   - `GET /api/settings/onedrive/callback`:
     - Validates returned `state` against session cache (invalidating it immediately upon reading).
     - Exchanges authorization `code` + cached `code_verifier` with Microsoft token endpoint.
     - Calls `https://graph.microsoft.com/v1.0/me` to read account email and display name.
     - Stores tokens and account metadata in `onedrive_configs` for the session user.
     - Returns HTML response sending `postMessage({ type: 'ONEDRIVE_AUTH_SUCCESS' }, window.location.origin)` and closing popup.
   - `DELETE /api/settings/onedrive`:
     - Clears tokens, disconnects account, and resets connection status for the user in SQLite.

3. **Frontend Settings Component (`spa/src/components/settings/OneDriveConnectorCard.tsx`)**:
   - Mount under Settings page (`Cloud Integrations` section).
   - Localized via `useT()` with bilingual dictionary keys in `spa/src/i18n/`.
   - Connection status badge:
     - Unconnected: Shows `[Connect to OneDrive]` button opening popup to `/api/settings/onedrive/auth-url` and listening for `postMessage`.
     - Connected: Shows connected user account email, `[Disconnect]` button, and target folder summary.
   - Target Folder summary:
     - Shows `target_folder_path` or *"No folder selected"*.
     - Button `[Select / Change Folder]` opens the folder browser modal (SPEC-95-02).
   - Sync Mode Radio Selection:
     - `ask`: "Ask every time when downloading PPTX" (Default).
     - `always`: "Always sync automatically in background".
     - `off`: "Disable cloud sync".

**Blocked by:** none

**Status:** open

- [ ] Implement `onedrive_configs` SQLite storage and model scoped by `user_id`.
- [ ] Implement Go HTTP API endpoints under `/api/settings/onedrive` with PKCE authorization, callback exchange, and token redaction guard.
- [ ] Implement `OneDriveConnectorCard.tsx` with bilingual `useT()` localization.
- [ ] Bind popup auth flow and postMessage listener.
