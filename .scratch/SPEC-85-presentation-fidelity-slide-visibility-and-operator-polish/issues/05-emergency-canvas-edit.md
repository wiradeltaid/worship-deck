# 05: Canvas Editor for Emergency Local Edit with Hydrated Slide Seed

**What to build:** In `src/operator/present/PresenterOperator.tsx`, replace the primitive single-textarea `EmergencyEditDialog` with a full-fidelity visual Canvas Editor modal that operates on the concrete, hydrated slide:
1. Component Boundary & Seeding:
   - In `src/operator/present/PresenterOperator.tsx`:
     - Implement `EmergencyCanvasDesignerModal` reusing the established Fabric.js canvas engine from `src/components/admin/ArtifactEditor.tsx` / `canvas-utils.ts` in modal presentation mode.
     - When opened, seed the canvas with the active slide's `ArtifactInstance` (`activeSlides[index].artifact`), which already contains fully resolved placeholders, effective background images, and layout elements from `/services/{id}`.
     - Do NOT display blank or unseeded sequence deck templates; the editor must reflect 100% what is currently projected.
   - Editable Matrix & Properties:
     - Text elements: allow selecting and directly editing text content, font family, font size, text color, alignment, and position across all element boxes (e.g. title, subtitle, lyrics, sermon references).
     - Image elements: allow adjusting image URL, sizing mode (`contain`/`cover`), and position x/y/w/h.
     - Background: allow adjusting background color or image override.
   - Lifecycle & Concurrency:
     - If operator clicks Cancel: dismiss modal with zero state mutations.
     - Modal is locked to the specific slide index it opened on.
2. Emergency Apply & Real-Time Broadcast:
   - When the operator clicks "Terapkan ke Layar (Lokal)":
     - Construct the updated `ArtifactInstance` with the edited elements.
     - Update the active slide in presenter memory: `activeSlides[index] = { ...activeSlides[index], artifact: updatedArtifact }`.
     - Write the updated slide plan into `service_snapshots` in IndexedDB.
     - Append the patch record to `emergency_outbox` in IndexedDB (`{ serviceId, basePlanIdentity, patchRevision: Date.now(), slideIndex: index, artifact: updatedArtifact }`).
     - Emit a `slide-patch` message across `BroadcastChannel` with monotonic `patchRevision`, `artifact: updatedArtifact`, and `planIdentity`.
     - In `ProjectorClient.tsx`:
       - Verify `planIdentity === basePlanIdentity`.
       - Check `patchRevision > lastRev`. If stale or duplicate, drop message safely.
       - Replace slide artifact in memory at `slideIndex` and re-render the auditorium screen immediately.
3. Write automated unit and integration tests in `tests/emergency-canvas-edit.test.mjs` verifying:
   - Emergency edit modal loads fully seeded `ArtifactInstance` from the active slide.
   - Modifying multi-element text and applying saves updated artifact to presenter state and IndexedDB.
   - `BroadcastChannel` transmits updated `ArtifactInstance` in `slide-patch` message.
   - Stale or mismatched planIdentity messages are safely rejected by Projector.
   - Projector client updates and renders edited multi-element slide without page reload.
   - Absence/injection test proving that reverting to single-textarea fails multi-element editing assertions.

Satisfies `FR-16`, `FR-19`, and `UC-21`.

**Blocked by:** `SPEC-85-04`

**Status:** closed

- [x] Read `src/operator/present/PresenterOperator.tsx`, `src/projected/ProjectorClient.tsx`, and `src/lib/present-channel.ts`.
- [x] In `src/operator/present/PresenterOperator.tsx`:
      - Implement `EmergencyCanvasDesignerModal` consuming hydrated `ArtifactInstance`.
      - Allow editing multiple text elements, images, and visual properties.
      - Apply changes to local slide memory, IndexedDB snapshot, and outbox.
      - Transmit `slide-patch` over `BroadcastChannel`.
- [x] In `tests/emergency-canvas-edit.test.mjs`:
      - Test hydrated artifact seeding into emergency edit canvas.
      - Test multi-element editing, patch persistence, and monotonic ordering.
      - Test projector broadcast, plan identity verification, and live rendering.
      - Inject defect and prove guard fails.
- [x] Run test suite with `node --import ./tests/register-ts-resolve.mjs --test tests/emergency-canvas-edit.test.mjs` and `npm run typecheck`.
