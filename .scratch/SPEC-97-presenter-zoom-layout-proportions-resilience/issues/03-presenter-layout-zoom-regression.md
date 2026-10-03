# 03: Presenter Zoom Layout Proportions and Viewport Regression Suite

**What to build:** In `tests/presenter-panel-geometry.test.mjs` and `package.json`:

1. **Real-Browser Integration Testing (`tests/presenter-panel-geometry.test.mjs`)**:
   - Utilize the repository Playwright harness (`tests/helpers/browser-harness.mjs`) against synthetic service test fixtures.
   - Test across equivalent zoom viewports without physical zoom dependency:
     * Full HD equivalents: 1920×1080 (100%), 1745×982 (110%), 1536×864 (125%), 1280×720 (150%), 1097×617 (175%).
     * Laptop equivalents: 1366×768 (100%), 1242×698 (110%), 1093×614 (125%).
     * Sub-`lg` stacked viewports: 960×540 (200%), 911×512 (150% on 768p).
   - In desktop viewports (width >= 1024px):
     * Measure bounding boxes of left panel (`data-testid="presenter-left-panel"`) and right panel (`data-testid="presenter-right-panel"`).
     * Assert `leftWidth / (leftWidth + rightWidth)` falls strictly within the **62%–68%** band across all desktop zoom viewports.
     * Assert `document.documentElement.scrollWidth <= window.innerWidth` (strictly zero horizontal page overflow).
     * Assert Current slide frame `width / height` is approximately 16:9 (`1.77` ± 0.05).
   - In sub-`lg` viewports (width < 1024px):
     * Assert panels stack vertically: `leftRect.top < rightRect.top`.
     * Assert both panels take 100% of available container width.
     * Assert `scrollWidth <= innerWidth`.

2. **Structural AST & Absence Scanning**:
   - Verify `<main>` declares `data-testid="presenter-main-layout"` and implements the decoupled 65/35 desktop proportion contract.
   - Verify left panel (`data-testid="presenter-left-panel"`) does NOT declare `lg:grow-0 lg:basis-[var(--presenter-stage)]`.
   - Verify Current slide container applies `max-w-[var(--presenter-stage)]` and `aspect-video`.
   - Verify both left and right panel containers declare `min-w-0`.

3. **Deterministic Defect Injection with Guaranteed Restoration**:
   - Include real-file defect injection testing that temporarily injects `lg:grow-0 lg:basis-[var(--presenter-stage)]` into `PresenterOperator.tsx`, asserting the guard catches it, wrapped in `try/finally` with exact file restoration so the git working tree is guaranteed clean even upon test failure or abort.

4. **Test Suite Registration**:
   - Register `tests/presenter-panel-geometry.test.mjs` in `package.json` under `"test"` and add both `"smoke:spec-97"` and `"test:smoke-spec-97"` aliases.

**Blocked by:** SPEC-97-02

**Status:** open

- [ ] Implement Playwright real-browser integration tests across 100%–175% zoom matrix.
- [ ] Assert panel width ratio is within 62%–68% on all desktop viewports with zero horizontal overflow.
- [ ] Assert sub-`lg` viewports stack vertically.
- [ ] Implement structural scanning for decoupled layout and testid attributes.
- [ ] Implement defect injection with guaranteed `try/finally` file restoration.
- [ ] Register test file and aliases (`smoke:spec-97` and `test:smoke-spec-97`) in `package.json`.
