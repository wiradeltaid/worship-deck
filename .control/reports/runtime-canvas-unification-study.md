# Architectural Study: Runtime Canvas Unification & Operator Ergonomics

**Date:** 2026-09-27  
**Context:** Post-release verification of SPEC-85 (DEC-072) & Planning for Unified Schedule Workspace  
**Status:** Accepted for future execution  
**Reference Document:** `.how/_platform/runtime-canvas-architecture.md`  

---

## 1. Background & Maintainer Feedback

Following the deployment of SPEC-85 (Presentation Fidelity, Slide Visibility, and Operator Polish) to `https://presenter-dev.bic.my.id`, an interactive usability audit surfaced seven high-value operator ergonomics and architectural feedback items:

1. **Run-Sheet Header Layout:** Split the top header panel into a balanced 50:50 two-column structure (Left: Service title and ID with line-break prevention; Right: Status and action clusters).
2. **Action Clusters Stacking:** In the right column, stack `OfflineReadinessBadge` on row 1, and divide action buttons cleanly into row 2 (Primary: *Present*, *Preview*, *Remote*) and row 3 (Utility: *Sync Artifact*, *Download PPTX* split dropdown).
3. **Song-Set Lyric Editor Button Placement:** Move *Edit/Close Lyrics* and *Save to Book* to a dedicated row below song selection inputs, eliminating the awkward dynamic layout shift when the textarea is edited.
4. **Slide Visibility Button Hover-Only State:** Make the Eye/EyeOff toggle in slide thumbnail lists (`SlidePreviewList.tsx`) hidden by default (`opacity-0`), revealing only upon mouse hover (`group-hover:opacity-100`) to eliminate visual clutter on long setlists.
5. **Presenter Console Slide Hide Control:** Move the active slide hide/show toggle out of small filmstrip thumbnails and place it prominently in the transport/properties bar directly under the Current Slide preview monitor.
6. **Presenter Console Top-Right Header Stacking:** Reorganize the top-right console buttons into two semantically distinct rows:
   - *Row 1 (Display & Audience):* `All Slides` | `Open congregation screen` | `Remote code`
   - *Row 2 (Safety, Workflow & Emergency):* `Offline ready` | `Buka Kunci` | `Edit Darurat` | `Run-Sheet`
7. **Emergency Canvas Editor vs Deck Spine Editor Parity:** Investigate unifying the visual look-and-feel, menus, element properties panel, and layer ordering operations of the emergency edit modal with the established Deck Spine Canvas Editor (`ArtifactEditor.tsx`).

---

## 2. Deep Dive: Why Did Canvas Implementations Diverge?

During SPEC-85-05, the emergency canvas designer was implemented using a dual-column layout with a static `<ArtifactSlide>` React preview on the left and form inputs on the right, rather than reusing `ArtifactEditor.tsx`.

### The Core Reasons
1. **Model Data Asymmetry:**
   - **Deck Spine (`/admin/artifacts`):** Operates on `StoredArtifactTemplate` containing abstract placeholder tokens (e.g. `{{song_title}}`, `{{lyrics_block}}`, `{{sermon_reference}}`).
   - **Presenter Console (`/services/{id}/present`):** Operates on hydrated `ArtifactInstance` containing concrete, service-specific content (verse 1 lyrics, specific scripture text, actual background images).
2. **Monolithic Admin Coupling in `ArtifactEditor.tsx` (~2,000+ LOC):**
   - Directly coupled to global template REST APIs (`/api/admin/artifacts/*`).
   - Contains optimistic concurrency (`updated_at`), HTTP 409 conflict reloaders, and `beforeunload` navigation blockers.
   - Houses admin-only sub-dialogs (`ImageCropDialog`, font file uploaders, template catalog drawers).
3. **Stage Safety Prioritization:**
   - SPEC-85-05 prioritized zero-regression isolation for the live presenter console to ensure an emergency typo fix during a church service could never trigger an admin save conflict or canvas memory leak.

---

## 3. Risk Evaluation & Peer Consultation (Terra)

A comprehensive architectural consultation with **Terra** (`gpt-5.6-terra --effort high`) evaluated the risks of unification:

### Risk Scoring
- **Direct Reuse / Big-Bang Extraction:** **8–9 / 10 (Critical Risk — REJECT)**
  - *Blast Radius:* High risk of stage incident response accidentally triggering admin template persistence, overwriting the church's master templates, or broadcasting high-frequency pointer move events over `BroadcastChannel`.
- **Phased Decoupled Extraction (Shared Runtime + Shared Chrome):** **4 / 10 Delivery Risk, 2–3 / 10 Stage Risk (RECOMMENDED)**
  - *Blast Radius:* Confined to local edit session; master templates remain immune; auditorium projector is protected by strict validation and last-known-good fallbacks.

### Critical Vulnerabilities Identified & Mitigated
1. **Server Raw JSON Storage:** `internal/httpapi/services.go` saves `emergency_patches` without deep schema validation. Solution: Implement `parseRuntimeArtifact` on both Go server and TypeScript client.
2. **Projector Screen Blanking:** If an unvalidated patch reaches `ProjectorClient.tsx`, `<ArtifactSlide />` throws on missing fields. Solution: Add Last-Known-Good fallback to preserve the active slide if a patch fails admission.
3. **Layer Ordering Ambiguity:** Fabric stack index vs DOM `zIndex` ties. Solution: Pure reordering policy preserving source array order for ties.

---

## 4. Alignment with Unified Schedule Workspace (New Mockup)

This architectural direction directly accelerates the **Unified Schedule Workspace** (`/workspace-mockup` / SPEC-48–53 / DEC-050–052):
- The new workspace currently contains `MockupCanvasDesignerModal.tsx`, which is a toy prototype with basic text inputs.
- By extracting a clean, decoupled `<RuntimeFabricCanvas />` component, **the exact same canvas engine will serve three distinct surfaces**:
  1. **Deck Spine:** Master template authoring.
  2. **Presenter Console:** Emergency stage lyric/typo correction.
  3. **Unified Workspace:** In-schedule slide customizer and designer.

---

## 5. Execution Backlog & Roadmap

When scheduled for implementation, work will be executed across two distinct specifications:

### Spec A: Operator Ergonomics & Header Hierarchy Polish (Low Risk / Immediate)
- Items 1 & 2: Run-sheet 50:50 two-column header redesign with tiered action clusters.
- Item 3: Dedicated row placement for song-set lyric edit/close and save-to-book buttons.
- Item 4: Hover-only visibility toggle in `SlidePreviewList.tsx` (`group-hover:opacity-100`).
- Item 5: Active slide visibility toggle integrated into Presenter transport controls.
- Item 6: Presenter console top-right header split into Display/Audience and Safety/Workflow rows.

### Spec B: Unified Runtime Fabric Canvas & Parity Architecture (Medium Risk / Phased)
- Phase 0: Runtime schema validator (`parseRuntimeArtifact`) & Projector Last-Known-Good fallback.
- Phase 1: Formalize pure layer ordering (`reorderElements`) and geometry serialization.
- Phase 2: Extract `FabricInteractionController` (transparent overlay wrapper).
- Phase 3: Extract `CanvasEditorChrome` (toolbars, layer ordering buttons, properties inspector).
- Phase 4: Wire into `EmergencyCanvasDesignerModal` with fallback kill-switch.
- Phase 5: Integrate into `MockupCanvasDesignerModal` in the Unified Schedule Workspace.
