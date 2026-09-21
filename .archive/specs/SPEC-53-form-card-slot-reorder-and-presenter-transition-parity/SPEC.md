# SPEC-53 — Form Card & Slot Reordering, Workspace Navigation Labeling & Presenter Text Transition Parity

> **Status:** closed  
> **Release:** form-reordering-and-presenter-parity  
> **Component:** hub  
> **Touches:** operator, spa, presenter, artifacts, services, present-channel, tests  
> **Depends on:** SPEC-52  

## Problem Statement

During hand-testing of the unified workspace, form layout management, and projection engine on the development environment (`https://presenter-dev.bic.my.id`), the maintainer identified four concrete operational friction points and visual defects requiring targeted specification and implementation:

1. **Workspace Navigation Labeling Clarity:**
   - The top application header bar (`src/components/Header.tsx`) contained a generic button labeled `Workspace` leading to `/new`.
   - To make its purpose as a high-fidelity interactive prototype explicit to church staff and operators, the navigation button must be labeled `New Workspace Mockup`.

2. **Form Card Grouping Reordering Defect (Up/Down):**
   - In the Dynamic Form Layout management panels (`FormLayoutAdminPanel.tsx` and `DynamicFormBody.tsx`), clicking the `Up` or `Down` arrow buttons on form grouping cards failed to maintain an ordered state.
   - Root Cause Analysis & Protocol Gap:
     - The client previously dispatched a partial two-element swap payload (`[{ id: current.id, sort_order: target.sort_order }, { id: target.id, sort_order: current.sort_order }]`) to `/api/admin/form-groupings/reorder`.
     - In the Go backend (`internal/httpapi/form_layout.go`), `reorderFormGroupings` fell back to a routine where any grouping in the layout not explicitly present in the request payload had its `sort_order` reassigned to `nextOrder = maxOrder + 1`. Consequently, unmentioned cards in the layout were forcibly shifted to the bottom of the list, corrupting the sequence.
     - Solution & API Contract:
       - The API contract requires submitting the complete, exact membership of the layout's groupings in their new sequential order `1..N`.
       - The backend must strictly validate the payload: reject empty, partial, duplicate-ID, duplicate-order, non-positive-order, or cross-layout submissions with HTTP 400 Bad Request, mutating zero rows.
       - Valid submissions must be persisted atomically in a single transaction.

3. **Intra-Card Slot Reordering and Cross-Card Slot Transfer:**
   - Reordering capabilities were restricted solely to card groupings; individual slots within a card lacked up/down reordering controls.
   - Operators could not move or reassign slots across different card groupings (e.g. transferring a `predefined_field` or `song_set_entry` from Grouping A to Grouping B).
   - Solution & Data Integrity Contract:
     - Intra-card slot reordering: Slots inside each card feature directional `[ ▲ ]` and `[ ▼ ]` controls that re-index all slots in that grouping contiguously `1..M` and submit full grouping slot arrays to `/api/admin/form-grouping-slots/reorder`.
     - Cross-card slot transfer: Operators can transfer a slot to another card grouping within the same layout via a dedicated action (`[ Pindah Kartu... ]`).
     - Atomic transfer transaction:
       1. Verifies the slot and both source and destination groupings exist and belong to the same `layout_id`.
       2. Rejects self-moves (source == target) with HTTP 400 Bad Request.
       3. Reindexes the source grouping contiguously `1..(M-1)`, closing the gap left by the transferred slot.
       4. Appends the slot to the destination grouping at `sort_order = MAX(target_sort_order) + 1`.
       5. Preserves the layout-wide uniqueness invariant `UNIQUE(layout_id, widget_kind, ref_key)`.

4. **Presenter Mode Slide Text Ghosting / Stale Text Linger ("Teks Nyangkut Bentar"):**
   - In presentation projection mode (`ProjectorClient.tsx` / `PresenterOperator.tsx`), navigating between slides produced an objectionable visual artifact: text from the previous slide lingered on screen for a moment before clearing abruptly, overlapping with incoming text.
   - Root Cause Analysis & Visual Parity Contract:
     - The default `CROSSFADE` transition specification in `src/lib/transitions.ts` defined the `outgoing` layer with `from: { opacity: 1 }, to: { opacity: 1 }` over a 500ms duration.
     - Because the outgoing slide was held at full 100% opacity while the incoming slide faded in above it, and because presentation slides share identical backgrounds (or dark backgrounds), the outgoing text remained visible beneath the incoming text for the entire 500ms duration. When the unmount timer finished, the old text disappeared with a jarring pop.
     - Furthermore, DOM element reuse in `ArtifactSlide.tsx` across successive slides without slide-level identity keys caused layout and font-fit measurement latency to momentarily display prior text before recalculation.
     - Solution:
       - Update transition keyframes so that outgoing slide layers fade out smoothly (`from: { opacity: 1 }, to: { opacity: 0 }`), eliminating text ghosting while maintaining visual continuity.
       - Enforce explicit slide-instance identity keys on rendered layers and `ArtifactSlide` stages so DOM nodes, text content, and font-fit measurement states are strictly isolated per slide.

---

## User Workflows & Technical Solutions

### Workflow 1: Form Card & Slot Reordering
```text
ADMIN FORM LAYOUT PANEL
┌────────────────────────────────────────────────────────────────────────┐
│ Kartu 1: Acara Pembukaan [#1]                       [ ▲ ] [ ▼ ] [ 🗑️ ] │
│ ├── Slot #1: [Predefined] worship_leader    [ ▲ ] [ ▼ ] [Pindah Kartu ▾] [ × ]
│ └── Slot #2: [Song Set]   opening_song      [ ▲ ] [ ▼ ] [Pindah Kartu ▾] [ × ]
│                                                                        │
│ Kartu 2: Pelayanan Firman [#2]                      [ ▲ ] [ ▼ ] [ 🗑️ ] │
│ ├── Slot #1: [Predefined] sermon_speaker    [ ▲ ] [ ▼ ] [Pindah Kartu ▾] [ × ]
│ └── Slot #2: [Predefined] scripture_ref     [ ▲ ] [ ▼ ] [Pindah Kartu ▾] [ × ]
└────────────────────────────────────────────────────────────────────────┘
```
1. Clicking [ ▲ ] or [ ▼ ] on a card re-indexes the entire card array `1..N` and sends the complete ordered list to `/api/admin/form-groupings/reorder`.
2. Clicking [ ▲ ] or [ ▼ ] on a slot shifts its position within the active card and calls `/api/admin/form-grouping-slots/reorder` with all slots in that grouping.
3. Selecting `[Pindah Kartu ▾]` transfers the slot to the selected target grouping card, closing the source gap and appending at the tail of the destination group.

### Workflow 2: Presenter Projection Clean Transition
```text
SLIDE TRANSITION (T = 0ms ──> 500ms)
Incoming Layer: Opacity 0.0  ─────────────> Opacity 1.0 (Smooth Fade In)
Outgoing Layer: Opacity 1.0  ─────────────> Opacity 0.0 (Smooth Fade Out)
Slide Identity: Isolated key per slide prevents DOM element text recycling
Result: Zero text ghosting or overlapping linger; background and text transition in complete visual harmony.
```

---

## Deliverables & Acceptance Criteria

1. **Header Navigation (SPEC-53-01):**
   - Navigation button in `src/components/Header.tsx` renders `New Workspace Mockup`.
   - Links correctly to `/new` and retains responsive layout and active indicator.

2. **Card Grouping Reordering (SPEC-53-02):**
   - Moving cards up or down produces deterministic sequential ordering in UI and database.
   - Go backend enforces strict validation: rejects partial or invalid payloads and atomically persists `1..N`.

3. **Slot Reordering & Cross-Card Transfer (SPEC-53-03):**
   - Slots inside cards feature [ ▲ ] and [ ▼ ] reorder buttons with contiguous `1..M` sequencing.
   - Slots can be transferred between cards within the same layout, atomically closing source gaps and appending to destination tails.

4. **Presenter Text Transition & Smoke Suite (SPEC-53-04):**
   - Outgoing slide layer fades out smoothly during crossfade transitions without text ghosting.
   - Distinct successive slides mount with isolated keys, preventing font-fit measurement flicker.
   - Comprehensive test suite combining Go backend transaction tests (`form_layout_test.go`) and frontend smoke tests (`tests/smoke-spec-53.test.mjs`).
