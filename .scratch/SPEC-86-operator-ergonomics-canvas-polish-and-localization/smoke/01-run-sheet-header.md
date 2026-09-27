# Smoke Test & Ergonomic Verification: SPEC-86-01

**Target:** `RunSheetPage.tsx` Header 50:50 Desktop Layout & Tiered Action Clusters  
**Author:** Coordinator  
**Verified By:** Terra Peer Review  
**Date:** 2026-09-27  

## 1. Concrete Observed Viewport Evidence

### A. Desktop Viewport (1440px × 900px, 1280px × 800px)
- **Grid Layout**: Verified active `grid grid-cols-1 lg:grid-cols-2 gap-4 items-start`. Left column and right column allocate equal 1fr tracks (equal split of header width after accounting for the 16px gap).
- **Left Column**:
  - `min-w-0 flex flex-col justify-center` prevents flex child blowout.
  - Heading: `<h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate whitespace-nowrap" title="Run-Sheet: 2026-09-27">`.
  - Content measured: On long date strings (e.g. `Run-Sheet: Saturday, 27 September 2026 - Combined Communion & Thanksgiving Service`), text truncates cleanly with ellipsis (`…`) without wrapping into 2 or 3 lines.
  - Mouse hover and assistive tools inspect native `title` attribute, exposing the complete unclipped label.
  - Subtitle: `Service ID: svc-demo` remains aligned below heading without horizontal drift.
- **Right Column**:
  - Container: `flex flex-col items-end gap-2.5`.
  - **Row 1 (`data-testid="header-offline-row"`)**: Contains only `<OfflineReadinessBadge />`, rendered at top right.
  - **Row 2 (`data-testid="header-primary-controls"`)**: Contains `Present` (`variant="default"`), `Preview` (`variant="outline"`), `Remote` (`variant="outline"`), aligned flush right.
  - **Row 3 (`data-testid="header-utility-controls"`)**: Contains `Sync Artifact` (if admin session active) and `Download PPTX` split button with dropdown, aligned flush right beneath Row 2.
  - Zero button displacement or crowding observed when resizing window across 1024px, 1280px, 1440px, and 1920px.

### B. Tablet & Mobile Viewports (768px × 1024px iPad, 390px × 844px iPhone)
- **Responsive Collapse**: `lg:grid-cols-2` collapses to single column `grid-cols-1`.
- **Left Column**: Spans the full single-column grid track with `min-w-0 flex flex-col justify-center`, title retains `truncate` preventing horizontal scrollbars.
- **Right Column**: `items-start` aligns all rows to the left.
  - Row 1 renders offline badge.
  - Row 2 wraps primary buttons cleanly if viewport is narrow (e.g. 320px).
  - Row 3 stacks below Row 2, preventing accidental taps between Present and Download.
  - Horizontal viewport overflow: `window.scrollX === 0` (no horizontal scrollbar).

## 2. Automated Fail-Closed Guard Proofs
- Structural scanner (`tests/run-sheet-header-tiered-layout.test.mjs`) verified:
  - 100% pass across layout, title truncation, dynamic title expression preservation, tier ordering, and element containment.
  - Fail-closed containment assertions: Missing container match throws finding rather than silent pass.
  - Real-file defect injection proofs with automatic `try/finally` restoration:
    1. Grid stripping -> FAILS
    2. Missing `truncate` alone -> FAILS
    3. Missing `whitespace-nowrap` alone -> FAILS
    4. Missing `title` attribute -> FAILS
    5. Displacing offline badge outside offline row -> FAILS
    6. Displacing primary action links -> FAILS
    7. Displacing utility controls -> FAILS
    8. Collapsing into unconstrained single flex-wrap bar -> FAILS
    9. Inverting tier order -> FAILS
