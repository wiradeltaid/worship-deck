# SPEC-84 — Offline Presentation Resilience and Emergency Local Edit

## Requirement Traceability & Scope
- **PRD**: `offline-deck`, `operator-turn`
- **Architectural Decision**:
  - `AD-1` (Sabbath Guarantee: PPTX export is Plan A 100% fail-safe; in-browser presentation is Plan B operator convenience)
  - `AD-29` (Projector liveness protocol & BroadcastChannel isolation)
- **Use Cases**:
  - `UC-18` (Offline Presentation Deck Guarantee — satisfies `FR-14`)
  - `UC-20` (Operator Service Management & View)
  - `UC-21` (Presenter Display and Control — satisfies `FR-16`)
  - `UC-22` (Projector Dual-Screen Display — satisfies `FR-19`)
- **Functional Requirements**:
  - `FR-14` (Offline Presentation Guarantee — PPTX fail-safe Plan A, in-browser presentation Plan B)
  - `FR-16` (Presenter View and Operator Control Surface)
  - `FR-18` (Operator Authentication and Session Integrity)
  - `FR-19` (Auditorium Projector Output and Live Synchronization)
- **Components**: `hub`, `presenter`
- **Touches**: `auth`, `services`, `present-channel`

## Problem Statement

During liturgical services and rehearsals, church network environments (venue Wi-Fi, hotspot, local LAN) frequently experience transient dropouts, high latency, or complete WAN disconnections. When network connectivity drops while using WorshipDeck in the browser:

1. **Catastrophic Session Ejection (`SessionProvider.tsx`)**:
   - `SessionProvider` executes `fetch('/api/session')` at root mount and during route shifts.
   - When the network fails, `fetch` throws an uncaught `TypeError: Failed to fetch`.
   - Any non-200 state currently sets `status: 'unauthed'` and imperatively calls `navigate('/login', { replace: true })`.
   - The operator is immediately ejected from the run-sheet or presenter view into the login screen with no recovery path while offline, even if their session was completely valid moments prior.

2. **Presentation and Projector Loading Failure (`PresentPage.tsx` & `ProjectorPage.tsx`)**:
   - When navigating from Run Sheet (`/services/:id`) to Presenter (`/services/:id/present`) or opening the Projector window (`/services/:id/present/projector`) on a second monitor:
     - Both pages perform fresh `fetch('/api/services/:id')` calls.
     - On network failure, `PresentPage` sets `data: 'missing'` and redirects to dashboard (`<Navigate to="/" replace />`).
     - `ProjectorPage` (which lives outside `OperatorShell` and `SessionProvider`) performs an independent `/api/session` check and service fetch; when offline, it aborts to `/login` or renders a dead error screen (`ProjectedError`).
   - Neither page has access to cached service data, slide plans, or media assets, despite the data having been present in memory on the Run Sheet.

3. **Missing Slide Media & Broken Assets**:
   - Slide backgrounds, sermon graphics, and announcement inserts depend on HTTP endpoints (`/api/uploads/*` or external allow-listed URLs).
   - If an asset is not already in the browser's volatile HTTP cache, slides render with broken image placeholders or blank backgrounds during live presentation.

4. **Rigid Read-Only Traps vs. Stage Emergencies**:
   - A naive "strict read-only offline lock" locks all inputs to prevent database collisions, but leaves operators helpless when live changes occur in the auditorium (e.g. pastor alters the sermon scripture reference, worship leader adds an unscripted song verse, or an emergency notice must be shown).
   - The operator requires a safe, locally contained way to patch text on the fly without corrupting the canonical server database.

## Architecture & Solution

In alignment with WorshipDeck's foundational constitution (**AD-1**: Sabbath Guarantee = PPTX Export is Plan A; browser presentation is Plan B):
WorshipDeck elevates the resilience of Plan B through a **three-stage phased approach**, prioritizing **Session Resilience** and **Lightweight Client-Side Cache (IndexedDB)** before attempting complex Service Worker PWA interception:

### 1. Fault-Tolerant Session Boundary (`SessionProvider.tsx` & `OperatorShell.tsx`)
- Distinguish between **HTTP 401 Unauthorized** (genuine invalid credential -> clear storage, redirect to `/login`) and **Network Failure / Timeout / 5xx** (transient outage -> set `isOffline: true`, retain `status: 'authed'`).
- Cache the last-verified session identity in `sessionStorage` (`worship_deck_last_session`).
- In `LogoutButton.tsx` and manual sign-out paths: explicitly purge `worship_deck_last_session` from `sessionStorage` so that deliberate sign-outs on shared church PCs do not leave stale session data.
- Expose `isOffline: boolean` in `SessionContextValue`.
- Display a calm, non-blocking notification banner in `OperatorShell` (*"Offline Mode — Operating with local session"*).
- Disable destructive server mutations (remote sync, user account edits) while keeping Run Sheet and Presenter navigation 100% active.
- Projector Window (`ProjectorPage.tsx`): Wrap its independent `/api/session` fetch in error handling. If network fails but a local service snapshot exists in IndexedDB for the route's `:id`, bypass the redirect and boot directly into presentation.

### 2. Client-Side Service Snapshot & Auto-Warming Pre-Cache (`lib/offline/service-snapshot.ts`)
- **Silent Background Pre-cache (Auto-Warming)**:
  - When the operator opens `/services/:id`, upon successful fetch, a background job crawls the service payload:
    - Extracts `plan`, `plan_identity`, `transition`, `raw_payload`, `parsed_data`, `field_values`, and `images_payload`.
    - Deep Asset Traversal: Scans `plan` items for:
      1. Effective slide background image URLs (`resolveEffectiveBackgroundImage`).
      2. Image element sources (`resolveElementImage` for elements of type `image` and `image-placeholder`).
      3. Top-level `images_payload` (`sermonGraphicUrl`, `familyPhotoUrl`, `youthPhotoUrl`, `announcementInserts`).
    - Deduplicates image URLs and pre-fetches them into IndexedDB `media_cache` store as binary Blobs (or Cache Storage).
    - Translates URLs for offline rendering through `resolveMediaUrl(url)`: returns `blob:` Object URL when offline or cached.
  - **Memory & Storage Hygiene**:
    - Object URL lifecycle: tracks created Object URLs and invokes `revokeMediaUrls()` on unmount or service transition to prevent memory leaks during multi-hour rehearsals.
    - Eviction policy: retains the current active service plus up to 3 most recently cached services; purges older snapshots to bound IndexedDB storage consumption.
  - **Headless Decoupled Architecture**:
    - `lib/offline/service-snapshot.ts` exposes reusable, headless primitives (`warmServiceSnapshot`, `getServiceSnapshot`, `resolveMediaUrl`) so that future surfaces (such as the new `/new` Workspace) consume offline capabilities directly without code duplication or refactoring.
- **Offline Readiness Semantics & Indicator**:
  - Denominator Definition: Total count of unique required media URLs referenced by the plan. For services with zero external media assets, readiness immediately resolves to `100% Ready (0 external assets)`.
  - Readiness states:
    - `warming`: Download in progress (`Warming: 8/14 assets`).
    - `ready`: All required media assets cached (`Offline Ready: 14/14 assets` with green badge).
    - `degraded`: One or more assets failed download (`Incomplete: 2 assets failed` with amber retry action).
  - Displays readiness indicator in **both** `RunSheetPage` header and `PresenterOperator` header chrome.
- **Transparent Offline Fallback**:
  - In `RunSheetPage`, `PresentPage`, and `ProjectorPage`, if `fetch('/api/services/:id')` fails due to network outage, the data layer automatically loads the verified IndexedDB snapshot for that `serviceId`.

### 3. Presentation Lock & Emergency Local Edit with Live Broadcast
- **Three-Layer State Model**:
  1. *Server Truth*: Canonical SQLite database on the server (immutable while offline).
  2. *Presentation Snapshot*: Local copy of the active service plan in IndexedDB.
  3. *Emergency Local Patch Log*: Sequential queue of lightweight text/lyric overrides applied on stage.
- **BroadcastChannel Protocol Compatibility (`present-channel.ts`)**:
  - Preserves fail-closed `planIdentity` invariants:
    - Retains original `planIdentity` as the baseline.
    - Adds monotonic `patchRevision: number` to emergency messages (`type: 'slide-patch'`, `index: number`, `artifact: ArtifactInstance`, `patchRevision: number`, `planIdentity: string`).
    - Projector verifies `planIdentity === baselinePlanIdentity`. When matched, updates the slide at `index` in memory.
    - Mount-time synchronization: When a Projector is opened or reloaded mid-session, its `request-sync` prompts `PresenterOperator` to reply with `sync` carrying all accumulated patches and current slide index.
- **Simplified Volunteer-Friendly Online Reconciliation**:
  - When internet connectivity returns, avoids intimidating modal takeovers or technical 409 diff UI.
  - Renders a calm notification prompt in Run Sheet and Presenter: *"Terdapat koreksi panggung: [Simpan ke Server] [Buang]"*.
  - Applying calls `PUT /api/services/:id` with optimistic concurrency (`If-Match: updated_at`).
  - Discarding clears the outbox and rolls back to the server canonical snapshot.
  - NEVER performs silent, unprompted auto-merging over the server database.

## Testing Strategy
- Automated unit and integration tests using Node.js test runner (`--test`):
  - `tests/session-provider-resilience.test.mjs`: Verify `SessionProvider` differentiates 401 from network errors, recovers from `sessionStorage`, and avoids `/login` navigation on network failure.
  - `tests/offline-service-snapshot.test.mjs`: Verify IndexedDB snapshot serialization, deep asset URL harvesting, zero-media readiness, state transitions (`warming` -> `ready` / `degraded`), and fallback resolution on network failure.
  - `tests/emergency-local-edit.test.mjs`: Verify emergency patch application, BroadcastChannel compatibility, mount-time sync replay, local outbox queueing, and reconciliation modal transitions.
- Defect injection tests proving each absence guard fails when offline tolerance is removed.
