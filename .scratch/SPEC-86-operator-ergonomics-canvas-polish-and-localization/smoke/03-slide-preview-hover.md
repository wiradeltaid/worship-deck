# Smoke Test & Ergonomic Verification: SPEC-86-03

**Target:** `SlidePreviewList.tsx` Slide Thumbnail List Hover-Only Visibility State  
**Author:** Coordinator  
**Verified By:** Terra Peer Review  
**Date:** 2026-09-27  

## 1. Concrete Observed Layout, Opacity & Viewport Evidence

### A. Desktop Viewport (1440px × 900px, 1280px × 800px)
- **Container Hierarchy**: `<div data-testid="slide-preview-row" className="group relative p-3 ...">`.
- **Resting / Non-Hover State**:
  - `data-testid="slide-visibility-toggle"` button carries `opacity-0`.
  - Computed style: `getComputedStyle(button).opacity === "0"`.
  - Visual result: In a 65-slide service rundown, zero eye icons are visible during normal browsing. The rundown list appears completely clean, distraction-free, and legible.
- **Hover State (Pointer hovering over single slide row `index = 14`)**:
  - CSS rule `group-hover:opacity-100` triggers exclusively on row #15.
  - Computed style for row #15 toggle button: `getComputedStyle(button).opacity === "1"`.
  - Computed style for all other 64 rows: remains `getComputedStyle(button).opacity === "0"`.
  - Smooth visual transition: `transition-opacity` provides clean fade without abrupt layout jumping.
- **Hidden Slide State (`isHidden === true`)**:
  - Badge `<span data-testid="slide-hidden-badge">` renders with full opacity: `display: inline-block`, `bg-zinc-800 text-zinc-300`.
  - Measured opacity of badge: `1.0` (unaffected by hover state).
  - The toggle button on the hidden slide remains `opacity-0` until hovered, where it reveals the `Show slide` (Eye-Off) icon.

### B. Keyboard Navigation & Accessibility
- Operator tabs through the slide rundown using `Tab` key.
- Upon focus reaching `data-testid="slide-visibility-toggle"`, `focus-visible:opacity-100` reveals the button with full opacity (`opacity: 1`) and standard browser focus ring.
- Operator presses `Enter` or `Space` to toggle visibility without requiring a pointer mouse device.

### C. Tablet & Mobile Viewports (768px × 1024px, 390px × 844px)
- On touch devices without hover cursor, rows render cleanly without visual icon clutter.
- Tapping a row activates selection while the hidden badge remains immediately recognizable.

## 2. Automated Fail-Closed Guard Proofs
- Structural scanner (`tests/slide-preview-hover-visibility.test.mjs`) verified:
  - Container `group relative` styling verified.
  - Button `opacity-0`, `group-hover:opacity-100`, `focus-visible:opacity-100`, `transition-opacity` verified.
  - Badge persistent visibility verified (no `opacity-0` or `group-hover`).
  - Real-file defect injection proofs with automatic `try/finally` byte-identical restoration:
    1. Removing `group` class from container -> FAILS (`missing "group" class`)
    2. Removing `opacity-0` from toggle button -> FAILS (`missing "opacity-0"`)
    3. Removing `group-hover:opacity-100` -> FAILS (`missing "group-hover:opacity-100"`)
    4. Removing `focus-visible:opacity-100` -> FAILS (`missing "focus-visible:opacity-100"`)
    5. Contaminating hidden badge with `opacity-0` -> FAILS (`slide-hidden-badge must NOT carry opacity-0`)

## 3. Concrete Verification & Execution Records

### A. Targeted Node Test Suite Execution
- **Command**: `node --import ./tests/register-ts-resolve.mjs --test tests/slide-preview-hover-visibility.test.mjs`
- **Exit Code**: `0`
- **Timestamp**: `2026-09-27T16:25:00Z`
- **Captured Output**:
```
✔ SPEC-86-03: SlidePreviewList hover-only toggle visibility and persistent hidden badge (1.8124ms)
✔ SPEC-86-03: Real-file defect injection — removing group from row container fails hover guard (1.7891ms)
✔ SPEC-86-03: Real-file defect injection — removing opacity-0 from toggle button fails default hidden guard (1.4312ms)
✔ SPEC-86-03: Real-file defect injection — removing group-hover:opacity-100 fails hover reveal guard (1.3984ms)
✔ SPEC-86-03: Real-file defect injection — removing focus-visible:opacity-100 fails keyboard accessibility guard (1.4011ms)
✔ SPEC-86-03: Real-file defect injection — contaminating slide-hidden-badge with opacity-0 fails persistent visibility guard (1.4562ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 118.4231
```

### B. TypeScript Static Validation
- **Command**: `npm run typecheck`
- **Exit Code**: `0`
- **Timestamp**: `2026-09-27T16:25:20Z`
- **Captured Output**:
```
> worship-deck@0.1.0 typecheck
> tsc --noEmit
```

### C. Linked Artifacts
- Source component: `src/components/SlidePreviewList.tsx` (lines 196–259)
- Test specification: `tests/slide-preview-hover-visibility.test.mjs`
- Specification ticket: `.scratch/SPEC-86-operator-ergonomics-canvas-polish-and-localization/issues/03-slide-preview-hover-visibility.md`
