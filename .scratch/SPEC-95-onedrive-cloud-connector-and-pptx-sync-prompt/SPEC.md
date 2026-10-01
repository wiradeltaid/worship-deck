# SPEC-95 — Microsoft OneDrive Cloud Connector and PPTX Sync Prompt

## Requirement Traceability & Scope
- **PRD**: `offline-deck`
- **Architectural Decisions**:
  - `AD-1` (Primary Sabbath Guarantee: Offline PPTX)
  - `AD-2` (Go API Backend with SQLite Storage)
  - `AD-30` (Process Roles: Go API, React SPA, On-Demand PPTX Worker)
- **Functional Requirements**:
  - `FR-14` (Export PPTX Presentation)
- **Use Cases**:
  - `UC-18` (Download Offline Presentation Deck — Extended with Optional OneDrive Cloud Delivery)
- **Components**: `hub`
- **Touches**: `settings`, `services`

---

## Problem Statement

During operator manual testing and workflow evaluation across church media teams, a key collaboration friction was identified:

1. **Manual File Handoff Friction**:
   - Operators author worship services, edit lyrics, and configure sermon graphics in WorshipDeck on one machine (e.g. personal laptop or office PC), then export a `.pptx` presentation.
   - The presentation is delivered on a sanctuary presentation PC via Microsoft PowerPoint.
   - Currently, operators must manually download the `.pptx` file and manually open OneDrive in a separate browser tab to upload and share the file with the team.
   - Operators requested a direct connector inside WorshipDeck to synchronize presentations directly to Microsoft OneDrive upon export.

2. **Divergent Operator Workflows and Account Isolation**:
   - Operators use different accounts: personal Microsoft accounts (`@outlook.com`, `@hotmail.com`) or organizational Microsoft 365 tenant accounts.
   - Operators have different preferences regarding automation:
     - Some operators prefer an explicit prompt on download asking *"Do you want to sync to OneDrive?"* to prevent unintended uploads.
     - Other operators prefer a seamless *"Always sync automatically"* behavior where clicking Download PPTX exports locally and uploads to the designated OneDrive folder simultaneously in the background.
     - Some operators work strictly offline or prefer not to use cloud sync.

3. **Arbitrary Target Folder Customization**:
   - Target folders differ per organization (e.g. `/Church/2026/Sunday Slides/`, `/Youth Service/Decks/`, or `/Ibadah Raya/`).
   - Forcing users to type raw folder paths or IDs manually is error-prone. A visual folder browsing and selection UX is required.

---

## Architectural Decisions & Core Invariants

1. **Backend-Proxy Token Ownership Model (Strict Redaction Boundary)**:
   - The Go backend (`internal/httpapi/onedrive.go`) is the **sole owner** of OAuth tokens, token refresh lifecycle, and Microsoft Graph API communication.
   - The React SPA **never** receives, handles, or stores bearer `access_token` or `refresh_token` strings.
   - All Graph interactions (fetching folder hierarchy, creating folders, uploading files) are proxied through authenticated Go endpoints:
     - `GET /api/settings/onedrive/folders`: proxies folder queries to Graph API using the backend-held access token.
     - `POST /api/services/:id/onedrive-upload`: streams the client-supplied PPTX blob to Microsoft Graph.
   - Tokens in SQLite are strictly inaccessible to public/client responses. Disconnecting revokes tokens locally and triggers Microsoft sign-out.

2. **Per-User Configuration Model**:
   - Configuration is keyed by `user_id` in SQLite:
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
   - Each logged-in operator maintains their own distinct Microsoft account connection, chosen target folder, and sync mode preference.

3. **Single-Blob Artifact Generation & Word-Wrap Contract**:
   - The PPTX presentation is generated **exactly once** per export action.
   - In `RunSheetPage.tsx`, clicking Download PPTX fetches `/api/services/:id/pptx?wrap=<boolean>` as a `Blob` once, honoring the active word-wrap selection (`wrap=true` default vs `wrap=false`).
   - **Local download occurs first and immediately**: `URL.createObjectURL(blob)` is passed to a hidden anchor click to guarantee local offline presentation delivery per `AD-1` / `FR-14`.
   - The **exact same blob** is reused for the OneDrive upload proxy, eliminating race conditions, double generation overhead, and content divergence.
   - Filename collision: Upload uses Microsoft Graph `@microsoft.graph.conflictBehavior: "rename"` to prevent silent overwrites of previous decks.
   - Retry: If upload fails, retry re-sends the retained original blob without re-generating the deck.

4. **Executable OAuth 2.0 PKCE Lifecycle**:
   - Authority: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`.
   - Scopes: `Files.ReadWrite offline_access User.Read`.
   - Flow:
     - SPA requests `/api/settings/onedrive/auth-url`, which generates a cryptographically secure PKCE `code_verifier`, `code_challenge`, and CSRF `state` stored temporarily in backend session cache with a 5-minute TTL.
     - SPA opens auth popup to Microsoft login.
     - Microsoft redirects to `/api/settings/onedrive/callback?code=...&state=...`.
     - Go backend validates state (one-time consumption), exchanges code for tokens, reads user info, stores tokens in `onedrive_configs`, and returns HTML sending `postMessage({ type: 'ONEDRIVE_AUTH_SUCCESS' }, origin)` to `window.opener`.
     - Fallback: If popup is blocked, SPA performs full-page redirect with safe return URL.

5. **Upload Resilience & Error Invariant**:
   - Upload failure (e.g. expired token, network failure, deleted folder) **never** invalidates, blocks, or delays an already-successful local file download.
   - If upload fails, actionable toast feedback is displayed with `[Coba Lagi]` / `[Retry]`, without re-downloading the local file.

---

## User Stories

1. **As an operator configuring my workstation**, I want to securely connect my personal or church Microsoft account to WorshipDeck and select a specific OneDrive target folder from a visual folder picker, so that exported presentations are delivered directly to my team's cloud workspace.
2. **As a service coordinator downloading a service presentation**, I want to be asked whether to sync the `.pptx` file to OneDrive (or have it sync automatically if I configured it to do so), so that the cloud copy is kept up to date without manual file transfers.
3. **As a worship leader operating offline in a venue with unstable internet**, I want my local PPTX download to always succeed immediately, even if the subsequent cloud upload fails or times out.

---

## Tickets

- **SPEC-95-01**: Backend-Proxy OneDrive OAuth 2.0 PKCE Storage, Token Management, and Settings UI
- **SPEC-95-02**: Backend-Proxied Microsoft Graph Target Folder Browser Modal
- **SPEC-95-03**: Run Sheet Single-Blob PPTX Export Integration with Sync Prompt & Resilient Upload
- **SPEC-95-04**: OneDrive Connector Contract Verifications, Absence Guards, and Test Suite
