# 03: Presentation Lock & Emergency Local Edit with Immediate Broadcast

**What to build:** In `src/operator/present/PresenterOperator.tsx`, implement a Presentation Lock and an Emergency Local Edit facility that enables live onstage text corrections without an active internet connection, maintaining strict compatibility with BroadcastChannel fail-closed validation:
1. Presentation Lock Matrix:
   - In `PresenterOperator.tsx`, maintain a `presentationLock` toggle (active by default in presentation mode).
   - When locked:
     - Form layout modifications, service deletion, and destructive route shifts are shielded.
     - Permitted actions: Slide forward/back navigation, slide jumping via `SlideGridDialog`, blackout/clear (`blank`), transition selection, and "Edit Darurat (Lokal)".
     - Visual badge indicates "Terkunci untuk Ibadah (Locked)".
2. BroadcastChannel Protocol Extension (`src/lib/present-channel.ts`):
   - Extend `PresentMessage` union to support monotonic emergency slide patches while preserving fail-closed baseline validation:
     ```ts
     | {
         type: 'slide-patch';
         index: number;
         artifact: ArtifactInstance;
         patchRevision: number;
         planIdentity: string; // Must match basePlanIdentity
       }
     ```
   - In `sync` message, include `patches?: Array<{ index: number; artifact: ArtifactInstance; patchRevision: number }>` so that when a Projector is launched or reloaded mid-service, its mount-time `request-sync` receives all accumulated live emergency patches.
3. Emergency Local Edit Facility:
   - Provide an "Edit Darurat (Lokal)" action button in `PresenterOperator.tsx` header/toolbar.
   - Clicking opens `EmergencyEditDialog`:
     - Scope: Allows editing text content of the active slide (e.g. correcting a hymn lyric line, updating a sermon scripture quotation, or writing an emergency notice text).
     - Does NOT attempt to call server API endpoints (`PUT /api/services/:id`) while offline.
   - When the operator clicks "Terapkan ke Layar (Lokal)":
     - Updates the local `SlidePlanItem` artifact in the active presenter state.
     - Writes the updated slide plan into `service_snapshots` in IndexedDB.
     - Appends the patch record to an `emergency_outbox` in IndexedDB (`{ serviceId, basePlanIdentity, patchRevision, patchTimestamp, slideIndex, originalText, updatedText }`).
     - Emits a `slide-patch` message across `BroadcastChannel` (`openPresentChannel`).
     - In `ProjectorClient.tsx`: Handles `slide-patch`, verifies `planIdentity === basePlanIdentity`, updates slide memory at `index`, and re-renders live in the auditorium immediately.
4. Simplified Volunteer-Friendly Online Reconciliation:
   - Avoid intrusive automatic modal popups or raw technical 409 diff UI when internet connectivity returns.
   - In `PresenterOperator.tsx` and `RunSheetPage.tsx`, when `emergency_outbox` contains pending patches and the browser is online, render a calm notification action:
     - *"Terdapat koreksi panggung: [Simpan ke Server] [Buang]"*.
     - "Simpan ke Server": sends `PUT /api/services/:id` with optimistic concurrency (`If-Match: updated_at`). If conflict occurs, notify operator cleanly with actionable guidance rather than blocking the screen.
     - "Buang": clears the outbox and reverts to canonical server plan snapshot.
     - NEVER perform silent, unprompted auto-merging over the server database.
5. In `tests/emergency-local-edit.test.mjs`:
   - Verify emergency patch updates local presenter state and slide artifact.
   - Verify BroadcastChannel transmits `slide-patch` and reloads sync with `patches` replay.
   - Verify outbox queueing and calm reconciliation banner actions.
   - Defect injection test: prove that attempting a server-dependent edit while offline fails the guard.

Satisfies `FR-16`, `FR-19`, and `UC-21`.

**Blocked by:** `SPEC-84-02`

**Status:** closed

- [x] Read `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`, and `src/lib/present-channel.ts`.
- [x] In `src/lib/present-channel.ts`:
      - Extend `PresentMessage` union with `type: 'slide-patch'` and `patches` in `sync`.
- [x] In `src/operator/present/PresenterOperator.tsx`:
      - Add `presentationLock` toggle.
      - Implement `EmergencyEditDialog` component.
      - On apply: update memory slides, write to IndexedDB, append to `emergency_outbox`, broadcast to channel.
      - Add online reconciliation banner action ("Simpan ke Server" / "Buang").
- [x] In `src/projected/ProjectorClient.tsx`:
      - Handle `slide-patch` message and mount-time `sync.patches` replay.
- [x] In `tests/emergency-local-edit.test.mjs`:
      - Test emergency patch application and BroadcastChannel sync.
      - Test mount-time sync replay for reloaded projector window.
      - Test outbox persistence in IndexedDB and reconciliation actions.
      - Inject defect and prove guard triggers failure.
- [x] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/emergency-local-edit.test.mjs` and `npm run typecheck`.
