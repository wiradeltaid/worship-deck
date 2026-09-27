# Smoke Test & Ergonomic Verification: SPEC-86-04

**Target:** `PresenterOperator.tsx` Presenter Transport Active Slide Hide Toggle & Two-Row Header Layout  
**Author:** Coordinator  
**Verified By:** Terra Peer Review  
**Date:** 2026-09-27  

## 1. Concrete Observed Layout, Coordinate & Viewport Evidence

### A. Top-Right Header Layout (`data-testid="presenter-header-actions"`)
- **Structure**: Stacked 2-row container `flex flex-col items-end gap-2`.
- **Row 1 (`data-testid="presenter-header-row-1"`) — Audience & Display Controls**:
  - `All slides` button (secondary variant, `h-8`).
  - `Open congregation screen` button (outline variant, `h-8`).
  - `Remote code` button with live indicator dot (`connected`/`pairing`/`disconnected`) and code badge (`h-8`).
  - Measured bounding box `height`: `32px`.
  - Exclusivity: Zero safety, lock, or emergency controls in Row 1.
- **Row 2 (`data-testid="presenter-header-row-2"`) — Session Safety & Workflow Controls**:
  - `OfflineReadinessBadge` (pill with green/amber icon and status text).
  - `Buka Kunci / Kunci Ibadah` button (`data-testid="presentation-lock-toggle"`, `h-8`).
  - `Edit Darurat (Lokal)` button (`data-testid="emergency-edit-button"`, `h-8`).
  - `Run-Sheet` navigation link (`h-8`).
  - Measured bounding box `height`: `32px`.
- **Clutter Elimination**:
  - The redundant `toggle-current-slide-visibility` toggle has been completely eliminated from the header.
  - Clear semantic separation between display/projector commands (Row 1) and operator workflow/safety actions (Row 2).

### B. Current Slide Transport Controls Bar
- **Location**: Situated directly beneath Current Slide 16:9 monitor:
  `<div className="flex flex-wrap items-center gap-2">`.
- **Integrated Active Toggle Button**:
  - `<Button data-testid="transport-slide-visibility-toggle" variant={current?.hidden ? 'destructive' : 'outline'} size="sm" className="h-9 gap-1.5 ...">`
  - Position: Placed immediately after `Next →` button and before `Auto Loop` announcement block.
  - State behavior:
    - Visible slide: Renders outline variant with `<EyeOff className="size-3.5" />` and label `Hide Slide`.
    - Hidden slide: Renders destructive variant with `<Eye className="size-3.5" />` and label `Unhide Slide`.
  - Prominence: Operates on active slide at 36px standard touch target right next to primary playback controls.

### C. Clean Filmstrip Thumbnails
- `FilmstripFrame` thumbnails retain `data-testid="filmstrip-hidden-badge"` in top-right corner when hidden.
- Tiny 24×24px hover button (`data-testid="filmstrip-visibility-toggle"`) is completely removed from the filmstrip, eliminating thumbnail hover flicker and accidental clicks during live slide tracking.

## 2. Automated Fail-Closed Guard Proofs
- Structural scanner (`tests/presenter-header-two-row-layout.test.mjs`) verified:
  - Header two-row structure, ordered hierarchy, and strict semantic category exclusivity verified.
  - Transport bar visibility toggle verified.
  - Removal of redundant top-right button and filmstrip hover button verified.
  - Real-file defect injection proofs with automatic `try/finally` byte-identical restoration:
    1. Single unconstrained flex row in header -> FAILS (`missing data-testid="presenter-header-row-1"`)
    2. Removing transport visibility toggle -> FAILS (`missing data-testid="transport-slide-visibility-toggle"`)
    3. Restoring filmstrip hover button -> FAILS (`data-testid="filmstrip-visibility-toggle" must be removed`)
    4. Inverting header row order -> FAILS (`presenter-header-row-1 must precede presenter-header-row-2`)
    5. Displacing emergency edit button into Row 1 -> FAILS (`presenter-header-row-1 must NOT contain safety or workflow controls`)

## 3. Concrete Verification & Execution Records

### A. Targeted Node Test Suite Execution
- **Command**: `node --import ./tests/register-ts-resolve.mjs --test tests/presenter-header-two-row-layout.test.mjs`
- **Exit Code**: `0`
- **Timestamp**: `2026-09-27T16:35:00Z`
- **Captured Output**:
```
✔ SPEC-86-04: Presenter header two-row layout and transport bar visibility toggle (2.1245ms)
✔ SPEC-86-04: Real-file defect injection — single unconstrained flex row in header fails two-row guard (2.0124ms)
✔ SPEC-86-04: Real-file defect injection — removing transport-slide-visibility-toggle fails guard (1.6742ms)
✔ SPEC-86-04: Real-file defect injection — restoring filmstrip-visibility-toggle fails uncluttered filmstrip guard (1.5901ms)
✔ SPEC-86-04: Real-file defect injection — inverting header row order fails sequential hierarchy guard (1.5218ms)
✔ SPEC-86-04: Real-file defect injection — displacing emergency-edit-button into Row 1 fails exclusivity guard (1.4889ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 128.5412
```

### B. TypeScript Static Validation
- **Command**: `npm run typecheck`
- **Exit Code**: `0`
- **Timestamp**: `2026-09-27T16:35:20Z`
- **Captured Output**:
```
> worship-deck@0.1.0 typecheck
> tsc --noEmit
```

### C. Linked Artifacts
- Source component: `src/operator/present/PresenterOperator.tsx` (lines 405–435, 1425–1545, 1665–1710)
- Test specification: `tests/presenter-header-two-row-layout.test.mjs`
- Specification ticket: `.scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/04-presenter-header-two-row-layout.md`
