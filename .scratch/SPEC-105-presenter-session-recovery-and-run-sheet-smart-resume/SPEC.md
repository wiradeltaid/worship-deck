# SPEC-105 — Presenter Session Recovery, Reload Resilience, and Run-Sheet Smart Resume

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-10` (`.how/_platform/ARCHITECTURE-SPINE.md:95`: Presenter Is the Single Authority, BroadcastChannel Wire Protocol, No Server Round-Trip)
  - `AD-24` (`.how/_platform/ARCHITECTURE-SPINE.md:206`: Operator Chrome State Is Browser-Local in localStorage, Room-Facing Surface Is Closed to It)
  - `.how/presenter/02-contracts/02-present-channel.md:51`: Control or projector reload resends index, overlay, and blank; reload does not change them
- **Functional Requirements**:
  - `FR-16` (`.control/registry/requirements-operator-turn.yaml`: Two-Screen Presenter View in the Browser)
  - `FR-17` (`.control/registry/requirements-operator-turn.yaml`: Run-Sheet Overview and Structured Presentation Launch)
- **Use Cases**:
  - `UC-5` (`.what/hub/04-usecases/UC-5-edit-service-fields.md`: I edit Service fields and view run-sheet)
  - `UC-12` (`.what/presenter/04-usecases/UC-12-two-screen-presenter.md`: Two-Screen Presenter, Alternate Flow 39: Control reload does not reset position)
- **Components**: `presenter`, `hub`
- **Touches**: `present-channel`, `scripture`, `services`

---

## Architectural Position & Clarification

This specification establishes an explicit architectural rule regarding reload recovery:
1. **Ephemeral Recovery Cache (AD-10 & AD-24 Compliance)**:
   - `localStorage` holds an **ephemeral recovery snapshot** strictly for the operator's active browser profile.
   - It is **not** a persistent domain database, **not** backed up, and **not** shared across devices.
   - The auditorium display client (`ProjectorClient`) **never** reads `localStorage` and never subscribes to `storage` events. The single-authority model (`AD-10`) is strictly preserved: `PresenterOperator` rehydrates its local memory, establishes active authority, and transmits authoritative desired state over the existing `BroadcastChannel` wire.
2. **Media Stream Lifecycle Invariant**:
   - WebRTC media tracks (`ProjectedSource: guest`) are in-memory browser objects that terminate on page unload (`pagehide`).
   - Therefore, session recovery safely restores projection to `{ kind: 'deck' }` to avoid dangling unavailable media handles upon presenter reload.

---

## Problem Statement

During live worship services and rehearsals on WorshipDeck dev (`https://presenter-dev.bic.my.id`), operators reported a high-severity live disruption:

1. **Abrupt Presentation and Projector Reset on Page Refresh**:
   - In `/services/:id/present` (`src/operator/present/PresenterOperator.tsx`), the active slide position is managed in React component state initialized to zero (`const [index, setIndex] = useState(0)`). Similarly, `blank` defaults to `false`, and `scriptureOverlay` defaults to `null`.
   - When an operator accidentally or deliberately reloads the Presenter browser tab (`F5`, `Ctrl+R`, network reconnection, or tab recovery):
     - `PresenterOperator` remounts and reinitializes state to `index = 0`, `blank = false`, `scriptureOverlay = null`.
     - Upon mounting, `PresenterOperator` immediately opens the `BroadcastChannel` (`openPresentChannel(serviceId)`) and broadcasts an initial `sync` message (`ch.postMessage(currentState())`) carrying `index: 0, blank: false, scripture: null`.
     - The congregation projector display (`src/projected/ProjectorClient.tsx` at `/services/:id/present/projector`) receives this message and immediately invokes `goTo(0)`, snapping the live sanctuary screen back to Slide 1 and clearing active blank or scripture overlays mid-service.
   - **Root Cause**: There is no browser-local session recovery cache for the presenter. Reload is treated by the component as a brand new presentation starting at index 0, violating the contract in `.how/presenter/02-contracts/02-present-channel.md:51` ("Do not treat reload as a new index").

2. **Run-Sheet Lack of Resume Context and Risk of Accidental In-Service Reset**:
   - In the service run-sheet header (`spa/src/pages/RunSheetPage.tsx`), the "Present" action is rendered as a static link (`<Link href={`/services/${svc.id}/present`}>`).
   - If an operator leaves the presenter to check run-sheet details during a service and returns via the primary action, there is no visual distinction between starting a fresh presentation from Slide 1 and resuming the active session. If an unconditional reset were tied to clicking "Present", re-opening would disrupt the active auditorium output.

---

## Solution Architecture & Invariants

### 1. Browser-Local Recovery Cache (`src/lib/<presenter-session.ts>`)
- **Single Authority Preservation (`AD-10`)**:
  - The browser storage (`localStorage`) serves exclusively as a recovery cache for `PresenterOperator`.
  - `ProjectorClient` **never** reads `localStorage` and never subscribes to `storage` events. The auditorium projector receives its state strictly over the existing `BroadcastChannel` via idempotent desired-state messages (`sync`, `blank`, `scripture`, etc.).
- **Operator Chrome Boundary (`AD-24`)**:
  - Storage is strictly browser-local, keyed per service: `worship_deck_present_${serviceId}`.
  - Recovery payload structure (`PresenterSavedSessionV1`):
    ```ts
    export interface PresenterSavedSessionV1 {
      version: 1;
      planIdentity: string;
      updatedAt: number;
      activeSessionId: string;
      index: number;
      blank: boolean;
      scriptureOverlay: ScriptureOverlay | null;
      loadedScripture: {
        reference: string;
        verses: Array<{ verse: number; text: string }>;
        typographyMode: 'chapter' | 'verse';
      } | null;
      scripturePageIndex: number;
      liveTransition?: SlideTransition;
      liveBackground?: string | null;
    }
    ```
- **Validation, Expiry & Fail-Closed Invariants**:
  - **Plan Identity Matching**: If the saved `planIdentity` does not strictly equal the current deck's `planIdentity`, the cache is rejected and discarded (returns `null`), starting cleanly from Slide 1. Index clamping across modified plans is forbidden to prevent jumping to wrong lyrics/sermon items.
  - **Auto-Expiry**: If `Date.now() - saved.updatedAt > 8 * 60 * 60 * 1000` (8 hours), or if `saved.updatedAt > Date.now() + 60000` (future timestamp corruption), the session is considered expired/invalid and discarded.
  - **Sanitization & Clamping**: Valid sessions clamp `index` to integer `[0, slides.length - 1]`. Scripture overlay page index is clamped to `[0, totalPages - 1]`. Live transition is validated against supported transition list.
  - **Fail-Safe Operation**: All reads, writes, and removes are wrapped in `try/catch`. Quota errors or Incognito restrictions gracefully fall back to in-memory defaults without throwing.

### 2. Presenter Hydration & Mount-Time Synchronization Lifecycle
- In `src/operator/present/PresenterOperator.tsx`:
  - Before opening the `BroadcastChannel` or emitting `sync`, evaluate `loadPresenterSession(serviceId, planIdentity, slides.length)`.
  - Initialize `index`, `blank`, `scriptureOverlay`, `loadedScripture`, `scripturePageIndex`, and live overrides directly from the validated recovery snapshot (or defaults if `null`).
  - Synchronize React `refs` (`indexRef`, `blankRef`, `scriptureOverlayRef`, `transitionRef`, `backgroundRef`) with the initial state so the very first `currentState()` message carries the recovered state.
  - On every user action mutating presentation state (`setIndexAndSync`, `setBlankAndSync`, `setScriptureAndSync`, clear scripture, live transition, live background): synchronously persist the snapshot via `savePresenterSession`.
  - **Authority Acquisition**: Tag session with `presenterSessionId` (`crypto.randomUUID()`). Only the authoritative instance writes to `localStorage`. When a new session claims authority (e.g. from Run-Sheet Start from Beginning), superseded tabs relinquish persistence.

### 3. Run-Sheet Smart Action (`RunSheetPage.tsx`)
- In `spa/src/pages/RunSheetPage.tsx`:
  - Inspect `peekPresenterSession(serviceId, svc.plan_identity)`:
    - **Active Session Detected** (`index > 0 || blank || scriptureOverlay !== null`, plan identity strictly matching, and unexpired):
      - Render primary action as an accessible Split Button:
        - Primary button: `Resume (Slide ${index + 1})` (human 1-based number).
        - Dropdown trigger (`DropdownMenu`):
          - Option 1: `Resume (Slide ${index + 1})`
          - Option 2: `Start from Beginning (Slide 1)` — clears the saved session cache via `clearPresenterSession(serviceId)` and navigates cleanly to `/services/:id/present`.
    - **No Active Session Detected** (or expired/at Slide 1 with no overlay or blank):
      - Render standard prominent `Present` button starting at Slide 1.
  - Navigation URLs remain clean (`/services/:id/present`) without persistent query flags (such as `?reset=1`) that would break subsequent reloads.

---

## Ticket Breakdown

- **SPEC-105-01**: Implement presenter session recovery helper module (`src/lib/<presenter-session.ts>`) with schema versioning, planIdentity validation, 8-hour expiry, runtime shape validation, fail-closed `peekPresenterSession`, and unit tests.
- **SPEC-105-02**: Wire session recovery into `PresenterOperator.tsx` lifecycle, ensuring pre-sync hydration, continuous state persistence, multi-tab authority tagging, and channel sync verification.
- **SPEC-105-03**: Implement Run-Sheet adaptive split action in `RunSheetPage.tsx` with "Resume (Slide N)" vs "Start from Beginning (Slide 1)" options, accessible dropdown, and test coverage.
