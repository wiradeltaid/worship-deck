# SPEC-97 — Presenter Zoom Layout Proportions Resilience

## Requirement Traceability & Scope
- **PRD**: `operator-turn`
- **Architectural Decisions**:
  - `AD-24` (`.how/_platform/ARCHITECTURE-SPINE.md:205`): Operator Chrome State Is Browser-Local, and Room-Facing Surface Is Closed to It. Binds operator surface chrome (`PresenterOperator.tsx`) as an operator console surface running under Vite SPA, ensuring layout modifications are strictly confined to operator controls and never leak to the congregation screen.
  - `AD-30` (`.how/_platform/ARCHITECTURE-SPINE.md:262`): Process Roles: Go API, React SPA, On-Demand PPTX Worker. Binds UI implementation strictly to the React SPA (`spa/src/operator/present/`) without server runtime changes.
- **Functional Requirements**:
  - `FR-16` (Two-Screen Presenter — Operator Console & Congregation Projector)
- **Use Cases**:
  - `UC-12` (Two-Screen Presenter: Operator Console Controls)
- **Components**: `presenter`
- **Touches**: `present-channel`

---

## Problem Statement

During operator rehearsals and testing on venue laptops and desktop monitors with browser zoom active (125%, 150%, 175%), operators observed that the Presenter console (`/services/{id}/present`) suffers from an inverted, cramped layout anomaly:
- **Expected layout (unzoomed 1080p)**: The left panel (Current slide, filmstrip, slide list) takes approximately **2/3** (~65-68%) of the horizontal screen width, while the right panel (Next slide, scripture, run sheet) occupies the remaining **1/3** (~32-35%).
- **Observed anomaly on browser zoom**: As browser zoom increases, the left panel shrinks down to approximately **2/5** (~35-40%) of the screen width, while the right panel balloons to **3/5** (~60-65%).

### Root Cause Analysis (Verified with Terra / kiro-agent)
1. **Coupling Column Basis to Viewport Height**:
   In `src/operator/present/PresenterOperator.tsx:247-249`, `--presenter-stage` is dynamically computed as:
   ```ts
   const STAGE_VARS: CssVars = {
     '--presenter-stage': 'max(24rem, min(64rem, calc((100dvh - 30rem) * 16 / 9)))',
   };
   ```
   At line 1611, `--presenter-stage` is applied as the `flex-basis` of the **entire left column**:
   ```tsx
   <div className="flex min-h-0 min-w-0 flex-col gap-3 lg:grow-0 lg:basis-[var(--presenter-stage)]">
   ```
2. **Fixed Subtractor vs. Collapsing Viewport Height**:
   Browser zoom decreases the available viewport height in CSS pixels (`100dvh`). Because `30rem` (480px) is subtracted as a fixed constant for other controls, `100dvh - 30rem` collapses rapidly.
   - At 1080p unzoomed (H=1080px = 67.5rem): `(67.5 - 30) * 16/9 = 66.7rem`, capped at `64rem` (1024px). Left panel takes ~68% of 1536px max container.
   - At 125% zoom (H=864px = 54rem): `(54 - 30) * 16/9 = 42.7rem` (683px). Left panel basis shrinks to ~46%.
   - At 150% zoom (H=720px = 45rem): `(45 - 30) * 16/9 = 26.7rem` (427px). Left panel basis shrinks to ~35%.
3. **Asymmetric Flex Behavior**:
   - The left column has `lg:grow-0` (`flex-grow: 0`), preventing it from expanding into positive horizontal space.
   - The right column (`<aside>`) has `lg:flex-1` (`flex-grow: 1`), absorbing 100% of the remaining horizontal width.
4. **Dead Space & Cramped Controls**:
   In the right column, the Next slide frame is capped at `max-w-[32rem]` (512px). When the right column balloons to 750px–900px, large empty dead gutters appear beside the Next slide preview, while the primary operator controls on the left (Current slide, filmstrip, and full slide list) are squeezed into a narrow strip.

---

## Solution Architecture & Core Invariants

1. **Decouple Column Proportions from Media Height**:
   - Establish an explicit desktop panel proportion contract of 65% left : 35% right (strictly enforced within a **62%–68%** left panel ratio band, measured as `leftWidth / (leftWidth + rightWidth)`) on `<main>` when above the `lg` breakpoint (1024 CSS px).
   - Implement via CSS Grid:
     `lg:grid lg:grid-cols-[minmax(24rem,13fr)_minmax(18rem,7fr)]`
     (or equivalent resilient flex-ratio `lg:flex-[13] min-w-[24rem]` vs `lg:flex-[7] min-w-[18rem]`).
   - Retain `min-w-0` on both columns to allow proper text truncation and internal scroll containment.
2. **Re-scope `--presenter-stage` to Slide Media Frame**:
   - Remove `--presenter-stage` as the basis of the entire left column.
   - Apply `max-w-[var(--presenter-stage)]` directly to the **Current slide media container** with clean horizontal alignment inside the left panel.
   - This ensures the 16:9 Current slide never letterboxes, while allowing the filmstrip and slide list to utilize the full ~65% width of the left panel without text and badge truncation.
3. **Vertical Behavior Contract on Short Desktop / High Zoom (e.g. 175%)**:
   - On short desktop viewports (e.g. 1920×1080 at 175% zoom ~1097×617 CSS px, or 1366×768 at 125% zoom ~1093×614 CSS px), page-level vertical scrolling (`div.overflow-y-auto` on the page root) is **explicitly permitted and expected**.
   - Internal containers maintain their respective containment:
     * Filmstrip preserves horizontal scroll containment (`overflow-x-auto`).
     * Slide list preserves vertical scroll containment (`overflow-y-auto max-lg:max-h-[45vh] lg:max-h-[36rem]`).
   - Horizontal page scrolling is strictly forbidden: `document.documentElement.scrollWidth <= window.innerWidth`.
4. **Next Preview Framing Alignment**:
   - Maintain `aspect-video` and `max-w-[32rem]` for Next slide, ensuring centered or clean alignment so that right column layout remains visually balanced.
5. **Responsive Stacking Below `lg`**:
   - When the CSS viewport falls below `1024px` (such as zoom ≥ 200% on 1080p, or small window resizing), layout gracefully stacks vertically (`flex flex-col`), where both panels take 100% width and page scrolls vertically without horizontal overflow.
6. **Real-Browser Integration & Regression Verification Suite**:
   - Provide real browser integration tests using Playwright against synthetic service fixtures across the viewport matrix:
     * Full HD equivalents: 1920×1080 (100%), 1745×982 (110%), 1536×864 (125%), 1280×720 (150%), 1097×617 (175%).
     * Laptop equivalents: 1366×768 (100%), 1242×698 (110%), 1093×614 (125%).
     * Sub-`lg` stacked viewports: 960×540 (200%), 911×512 (150% on 768p).
   - In addition to browser tests, include serial AST source absence guards for `lg:basis-[var(--presenter-stage)]` and `lg:grow-0` on the left column with safe cleanup in `finally`.

---

## Non-Goals
- Changing the design or functionality of the Congregation Projector (`/services/{id}/present/projector`) or Fullscreen Slideshow (`/services/{id}/slideshow`).
- Altering the backend Go API or BroadcastChannel communication protocol.
- Changing the layout breakpoint threshold away from Tailwind standard `lg` (1024px).
