---
type: architecture
status: living
created: 2026-09-27
binds: ['AD-13', 'FR-14', 'FR-16', 'FR-19', 'UC-18', 'UC-20', 'UC-21']
---

# Runtime Canvas Architecture — Unified Interaction & Presentation Blueprint

## 1. Executive Summary & Vision

WorshipDeck currently features three disparate canvas and slide-editing implementations:
1. **Deck Spine Template Editor** (`src/components/admin/ArtifactEditor.tsx`, ~2,000+ LOC): Full-fidelity Fabric.js v6 editor for authoring master slide templates with placeholders (`{{song_title}}`, `{{lyrics_block}}`), layer ordering, and registry persistence.
2. **Presenter Emergency Local Edit** (`src/operator/present/PresenterOperator.tsx` -> `EmergencyCanvasDesignerModal` & `src/lib/emergency-canvas.ts`): Built in SPEC-85-05 for live stage incident response, using React `<ArtifactSlide>` preview with DOM bounding-box overlays and a side form inspector.
3. **Unified Schedule Workspace Mockup** (`src/operator/workspace/MockupCanvasDesignerModal.tsx`): Built in SPEC-48–53 for the upcoming 1920×1080 Unified Workspace (`/workspace-mockup`), currently using a toy form dialog without interactive canvas manipulation.

### The Maintainer's Vision
Unify the visual look-and-feel, menus, element properties inspector, formatting toolbars, and layer ordering operations (Bring to Front, Send to Back, Move Up, Move Down) across all three surfaces so that operators and administrators experience **100% identical editing ergonomics**, while strictly decoupling the interaction runtime from admin template persistence.

---

## 2. As-Built Core Finding: The Transparent Proxy Pattern

A critical insight of WorshipDeck's existing architecture is that **Fabric.js is NOT the visual renderer of slides**.

```text
┌────────────────────────────────────────────────────────┐
│  ArtifactSlide(instance)        ← Visual Truth         │
│  (HTML/CSS DOM rendering, actual typography, images)   │
├────────────────────────────────────────────────────────┤
│  Fabric Canvas (Transparent)    ← Interaction Truth    │
│  (8-point transform handles, drag, resize, rotate)     │
└────────────────────────────────────────────────────────┘
```

Per SPEC-27/SPEC-28 (Option A) and AD-13:
- The actual visual output (backgrounds, typography, text fitting, line breaks) is rendered exclusively by `<ArtifactSlide />`.
- Fabric.js mounts a transparent overlay on top of the slide, creating proxy objects whose only job is to provide transform handles, capture pointer dragging, and emit coordinate/style changes.
- Visual authority remains strictly in `<ArtifactSlide />`.

Therefore, achieving visual and ergonomic parity **does not require rewriting the rendering engine**. It requires extracting the **transparent interaction controller** and the **shared editing chrome** into a reusable runtime module.

---

## 3. Risk & Blast Radius Assessment

A peer evaluation conducted with **Terra** established the following risk profile:

| Approach | Risk Level | Delivery Risk | Residual Stage Risk | Verdict |
|---|---|---|---|---|
| **Direct Reuse / Big-Bang** (Importing `ArtifactEditor` into Presenter) | **8–9 / 10** | Very High | Critical | **REJECT** — Blurs template authoring with stage incident response; invites disaster. |
| **Phased Runtime Extraction** (Decoupled 4-layer architecture with safety guards) | **4 / 10** | Moderate | **2–3 / 10** | **RECOMMENDED** — Achieves 100% UI/UX parity while isolating persistence and projector channels. |

### Failure Modes & Worst-Case Scenarios

1. **Scope Blast (Master Template Corruption) — *Critical Severity***
   - *Risk:* `ArtifactEditor.tsx` contains logic for updating templates via `/api/admin/artifacts/*` with optimistic concurrency (`updated_at`), HTTP 409 conflict reloads, and navigation blockers.
   - *Danger:* If reused directly, an emergency lyric typo fix on stage could accidentally overwrite the church's master template in the SQLite database, corrupting future services.
   - *Mitigation:* The runtime canvas library MUST have zero imports of admin adapters, zero fetch calls, and zero knowledge of `StoredArtifactTemplate`.
2. **Projector Screen Blanking / Crash — *Critical Severity***
   - *Risk:* The Go backend (`internal/httpapi/services.go`) stores `emergency_patches` as raw JSON. `ProjectorClient.tsx` admits patches based only on `planIdentity` and revision checks, but `<ArtifactSlide />` asserts strict schema validity via `assertRuntimeVersion()`.
   - *Danger:* If a Fabric mutation produces a malformed JSON artifact (e.g. `fontStyle: undefined`, `NaN` coordinate percentages), the projector client throws a render exception and the auditorium screen goes black mid-service.
   - *Mitigation:* Implement strict deep schema parsing (`parseRuntimeArtifact`) and a **Last-Known-Good Fallback** in `ProjectorClient.tsx` (if a patch fails validation, reject it and keep projecting the existing valid slide).
3. **Visual Drift (Editor vs Projector Discrepancy) — *High Severity***
   - *Risk:* In the admin editor, `editorMode` disables runtime text shrink-to-fit so creators work at scale 1. In live presentation, `<ArtifactSlide />` actively scales text to fit the viewport via DOM measurement and `ResizeObserver`.
   - *Danger:* An operator resizes a text box in the modal thinking it fits, but on the auditorium screen the text overflows or shrinks drastically.
   - *Mitigation:* Standardize text measurement contracts and ensure `wrapLines`, `longestWordPx`, and `measuredWith` are properly calculated during canvas serialization.
4. **Layer Order Discrepancies (Ties & Source Order) — *High Severity***
   - *Risk:* Runtime rendering sorts elements by `zIndex ascending` with original array index as the tie-breaker. Fabric maintains a flat object stack where z-index is tied to canvas index.
   - *Danger:* A careless layer reorder rewrites all z-indices or loses source order, causing lyrics to render behind background elements in live presentation or PPTX export.
   - *Mitigation:* Formalize layer ordering as a pure function:
     `sort(elements) = zIndex ascending, then source order`
     `reorder(elements, selection, action) = pure array mutation`
5. **Re-render / Mount Oscillation in Modal Dialogs — *High Severity***
   - *Risk:* Fabric events (`object:moving`, `object:scaling`, `text:changed`) updating React state on every mousemove tick triggers continuous re-renders of the modal.
   - *Danger:* Canvas selection drops mid-drag, laggy 15 FPS movement, or memory leaks on repeated modal open/close.
   - *Mitigation:* Follow AD-13's Uncontrolled Wrapper pattern: Fabric owns interaction state in refs; React only commits state on meaningful events (`object:modified`) or when the operator clicks *Apply*.

---

## 4. Target 4-Layer Decoupled Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Layer 1: Runtime Artifact Validation & Mutation Core (Pure Functions) │
│ - parseRuntimeArtifact(val): Result<ArtifactInstance, Error>           │
│ - Pure mutation reducers: updateGeometry, updateStyle, reorderLayer    │
│ - Zero React, zero DOM, zero Fabric, zero network                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Layer 2: Fabric Interaction Controller (Uncontrolled Wrapper)         │
│ - Mounts transparent Fabric overlay on fixed 960×540 logical stage     │
│ - Translates CanvasElement / ResolvedElement to Fabric proxy objects   │
│ - Manages selection, 8-point handles, keyboard nudge, rotation         │
│ - Emits normalized draft mutations only on interaction commit          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ Layer 3: Shared Canvas Editor Chrome (UI Component Library)            │
│ - Formatting toolbar (Font family, size, color, bold, align, spacing)  │
│ - Layer ordering buttons (Bring Forward, Send Backward, Front, Back)   │
│ - Properties sidebar / inspector panels with exact Spine styling       │
│ - Pure presentation: receives state & callbacks via typed props        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
│ Layer 4a: Admin │        │ Layer 4b: Stage │        │ Layer 4c: New   │
│ Deck Spine Host │        │ Emergency Host  │        │ Workspace Host  │
│ - StoredTemplate│        │ - ArtifactInst. │        │ - Unified Run-  │
│ - REST /api/... │        │ - IndexedDB out.│        │   down schedule │
│ - 409 conflict  │        │ - BroadcastCh.  │        │ - Local override│
│ - Dirty guard   │        │ - Apply on click│        │ - Preset CRUD   │
└─────────────────┘        └─────────────────┘        └─────────────────┘
```

### Component Contract Specification

```typescript
export interface RuntimeCanvasCapabilities {
  canInsertElements: boolean;
  canDeleteElements: boolean;
  canReorderLayers: boolean;
  canChangeBackground: boolean;
  canUploadCustomFonts: boolean;
}

export interface RuntimeFabricCanvasProps {
  value: ArtifactInstance;
  capabilities: RuntimeCanvasCapabilities;
  fontCatalog: FontDefinition[];
  backgroundLibrary: BackgroundItem[];
  onDraftChange?: (draft: ArtifactInstance) => void;
  onApply: (updated: ArtifactInstance, canonicalText: string) => Promise<void> | void;
  onCancel: () => void;
  className?: string;
}
```

---

## 5. Phased Implementation Roadmap

To maintain zero regression across the existing test suite and live deployments, implementation must follow six controlled phases:

### Phase 0: Safety Net & Projector Hardening (Pre-requisite)
1. Implement `parseRuntimeArtifact(value): Result<ArtifactInstance, ValidationError>`.
2. Add **Last-Known-Good Fallback** in `src/projected/ProjectorClient.tsx`:
   - If an incoming `slide-patch` or `sync.patches` item fails `parseRuntimeArtifact`, log a warning and retain the previous valid slide without crashing or blanking.
3. Validate payload limits in Go server (`internal/httpapi/services.go`): enforce maximum elements count, text length, and total JSON payload size.
4. Write failure-injection tests verifying malformed patches never crash the projector.

### Phase 1: Pure Logic & Layer Order Formalization
1. Extract pure transformation functions from `src/components/admin/ArtifactEditor.tsx`:
   - `reorderElements(elements, selectedId, action: 'front' | 'back' | 'forward' | 'backward')`
   - `buildFabricProxyOptions(element)`
   - `serializeFabricProxies(canvas, baseArtifact)`
2. Verify layer ordering maintains invariant: `zIndex ascending`, with source order preserving ties.
3. Test against existing `tests/artifact-editor-controls.test.mjs` and `tests/copy-paste-share-by-reference.test.mjs`.

### Phase 2: Extract Reusable Interaction Controller
1. Implement the standalone `FabricInteractionController` module.
2. Encapsulate dynamic `import('fabric')`, canvas ref lifecycle, zoom fitting to container shell, and event bindings.
3. Refactor `ArtifactEditor.tsx` to consume this controller internally. Verify that all admin template features (save, reset, font picker, crop) pass without changes to backend API behavior.

### Phase 3: Extract Shared Chrome & Properties Toolbar
1. Implement the shared `CanvasEditorChrome` component providing:
   - Floating/docked toolbar with formatting buttons (Bold, Font, Size, Color, Alignment).
   - Layer ordering buttons (Bring to Front, Send to Back, Bring Forward, Send Backward).
   - Undo / Redo controls with snapshot management.
2. Ensure identical styling, Tailwind tokens, and Lucide icons as Deck Spine.

### Phase 4: Presenter Emergency Modal Integration (Feature-Flagged)
1. Wire `FabricInteractionController` and `CanvasEditorChrome` into `EmergencyCanvasDesignerModal` in `PresenterOperator.tsx`.
2. Maintain existing Form Inspector as a fallback kill-switch (`useLegacyEmergencyInspector`).
3. Enforce lifecycle:
   - Dynamic import of Fabric occurs only when the modal opens.
   - Pointer events mutate draft state locally; NO broadcast occurs during dragging.
   - Clicking *Terapkan ke Layar (Lokal)* runs `parseRuntimeArtifact`, commits to IndexedDB `emergency_outbox`, updates presenter memory, and broadcasts the single final patch.

### Phase 5: Unified Schedule Workspace (New Mockup) Adoption
1. Replace the temporary `MockupCanvasDesignerModal.tsx` in `src/operator/workspace/` with the shared `RuntimeFabricCanvas`.
2. Enable in-workspace slide customization directly on schedule items, achieving the full vision of DEC-050/DEC-051.

---

## 6. Verification & Parity Matrix

Every change to this architecture must pass the following verification gates:
1. **Source Preservation:** No admin REST routes (`/api/admin/artifacts/*`) called from presenter or projector.
2. **Type Safety:** Zero `any` in `EmergencyPatchRecord.patchedArtifact` and `SlidePatch.artifact`.
3. **Projector Immunity:** Projector never throws on invalid runtime patches.
4. **PPTX Parity:** Slides edited via the runtime canvas export to PowerPoint with identical positioning, typography, and `<p:sld show="0">` attributes.
5. **Offline Durability:** Emergency patches survive page reload via IndexedDB `service_snapshots` and reconcile cleanly via `PATCH /api/services/:id` when online.
