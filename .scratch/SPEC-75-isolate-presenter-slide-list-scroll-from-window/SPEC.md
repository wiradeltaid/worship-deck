# SPEC-75 — Isolate Presenter Slide List Scroll from Window

## Problem Statement

When an operator navigates between slides on the Presenter Console (`/services/{id}/present`), the active slide row inside the "Slides" panel is tracked via `activeRowRef.current?.scrollIntoView({ block: 'nearest' })`.

In browser layout engines, `Element.prototype.scrollIntoView()` does not restrict scrolling to the immediate scrollable parent container; it traverses and scrolls all scrollable ancestors up to `window` (`document.scrollingElement`) whenever the target element is considered outside or partially outside the window's current viewport.

Because the presenter view on common operator displays (such as 1080p monitors, 1366x768 church laptops, or tablets) can have vertical content exceeding the viewport, navigating forward through slides forces the entire browser window to scroll downwards. This unexpected window movement scrolls the top control bar (service title, live status badge, projector toggle, blank screen button) and preview monitors off-screen or out of comfortable sight. The operator is forced to constantly scroll the window back up manually during live worship presentations.

The operator expects the browser window scroll position to remain completely undisturbed (preserving the operator's existing viewport position), and only the internal section / panel container of the `slides` list item to auto-scroll to reveal the active slide.

## Solution

1. **Container-Scoped Slide List Auto-Scrolling**:
   - Attach a reference (`slideListContainerRef`) to the scrollable container of the `slides` list section (`<div className="min-h-0 flex-1 overflow-y-auto p-1.5 ...">`).
   - Replace `activeRowRef.current?.scrollIntoView({ block: 'nearest' })` with container-scoped scroll adjustment logic (`scrollChildIntoContainerView`).
   - Calculate whether the active row element is above or below the visible bounding box of `slideListContainerRef.current`.
   - If the active row is outside or partially outside the container's visible bounds, adjust `container.scrollTop` to bring the row into view at the nearest edge (`container.scrollTop -= (cTop - rTop)` or `container.scrollTop += (rBottom - cBottom)`).
   - If the active row is already fully visible inside the container, leave `container.scrollTop` untouched.
   - Absolutely no scrolling is applied to `window`, `document.body`, or any ancestor elements.

2. **Filmstrip Neutralization**:
   - Ensure the horizontal filmstrip thumbnail tracking does not invoke ancestor vertical scrolling (e.g. by using horizontal container-scoped scrolling on the filmstrip container or eliminating ancestor vertical scroll calls).

3. **Reusable Geometry Helper with Boundary Clamping**:
   - Implement and export `scrollChildIntoContainerView(container: HTMLElement, child: HTMLElement, axis?: 'vertical' | 'horizontal')` in `src/operator/present/presenter-model.ts`.
   - Support boundary clamping:
     - Partially visible top: scrolls up by the exact hidden offset.
     - Partially visible bottom: scrolls down by the exact hidden offset.
     - Exact edge alignment: zero delta (no-op, zero jitter).
     - Oversized child (taller than container): top-aligns child with container top.
     - Clamp against negative `scrollTop` / `scrollLeft`.

4. **Automated Verification, Behavior Simulation, and Absence Guard**:
   - Author `tests/presenter-container-scroll.test.mjs` verifying:
     - Vertical container scrolling logic across all boundary cases: above, below, partially hidden top, partially hidden bottom, exact edge alignment, oversized child, and zero-offset clamping.
     - Behavior-level integration check: initialize a mock DOM environment with a non-zero `window.scrollY`, trigger slide navigation to an off-panel active slide, and assert that `container.scrollTop` updates to reveal the active slide while `window.scrollY` remains strictly unchanged at its initial position.
     - Absence guard verifying that `activeRowRef.current?.scrollIntoView` is completely removed from `src/operator/present/PresenterOperator.tsx`.
     - Presence guard confirming `slideListContainerRef` is wired and utilized for container-scoped scrolling.
   - Wire `tests/presenter-container-scroll.test.mjs` additively into `package.json` `scripts.test` using `node --import ./tests/register-ts-resolve.mjs --test` preserving `--test-concurrency=1`.

## User Stories

1. As a presenter operator conducting live church service projection at `/services/{id}/present`, I want navigating down the slide list to never displace the browser window from my chosen viewport position, so that the service header, status indicators, and preview monitors remain securely anchored in view.
2. As a presenter operator using a laptop or compact display with vertical window overflow, I want the active slide row inside the "Slides" panel to automatically scroll into view within its own panel container, so that I can always see which slide is active in the list.
3. As a presenter operator using arrow keys or page down, I want slide rows that are already fully visible within the "Slides" panel to trigger zero container scroll movements, so that the list doesn't jitter or jump unnecessarily.
4. As a presenter operator jumping to a distant slide via manual selection or quick navigation, I want the slide list container to scroll directly to reveal the newly active row without displacing the rest of the application layout.
5. As a repository maintainer, I want automated unit tests, behavior-level checks, and source guards ensuring that container-scoped scroll calculations are mathematically sound and prevent regressions back to ancestor-scrolling `scrollIntoView()`.

## Implementation Decisions

- **Container Reference Attachment**:
  Attach `slideListContainerRef = useRef<HTMLDivElement | null>(null)` to the slides list container `<div className="min-h-0 flex-1 overflow-y-auto p-1.5 ...">`.
- **Pure DOM Geometry Helper Function**:
  Export `scrollChildIntoContainerView` in `src/operator/present/presenter-model.ts`:
  ```ts
  export function scrollChildIntoContainerView(
    container: HTMLElement,
    child: HTMLElement,
    axis: 'vertical' | 'horizontal' = 'vertical'
  ): boolean
  ```
  Returns `true` if a scroll adjustment was made, `false` if the child was already within visible bounds.
- **Mathematical Offset Calculation & Boundary Cases**:
  Using `container.getBoundingClientRect()` and `child.getBoundingClientRect()`:
  - Vertical axis:
    - If `childRect.height > containerRect.height`: top-align (`container.scrollTop += (childRect.top - containerRect.top)`)
    - Else if `childRect.top < containerRect.top`: `container.scrollTop -= (containerRect.top - childRect.top)`
    - Else if `childRect.bottom > containerRect.bottom`: `container.scrollTop += (childRect.bottom - containerRect.bottom)`
    - Else: no-op (return `false`)
  - Clamp `container.scrollTop = Math.max(0, container.scrollTop)`.
- **Effect Replacement**:
  In `PresenterOperator.tsx`:
  ```ts
  useEffect(() => {
    if (slideListContainerRef.current && activeRowRef.current) {
      scrollChildIntoContainerView(slideListContainerRef.current, activeRowRef.current, 'vertical');
    }
  }, [index]);
  ```
- **Preservation of Operator Window Position**:
  By strictly modifying `container.scrollTop` on the scrollable container and avoiding `scrollIntoView`, no ancestor scrolling is invoked. The operator's window scroll position remains completely stable throughout the presentation.

## Testing Decisions

- Author `tests/presenter-container-scroll.test.mjs` using the Node.js test runner.
- Test Cases:
  1. Boundary: target child below container viewport increases `container.scrollTop` by exact overflow delta.
  2. Boundary: target child above container viewport decreases `container.scrollTop` by exact underflow delta.
  3. Boundary: target child partially visible at bottom edge scrolls down by exact hidden delta.
  4. Boundary: target child partially visible at top edge scrolls up by exact hidden delta.
  5. Boundary: target child exactly aligned at top or bottom edge results in 0 scroll change (returns `false`).
  6. Boundary: target child taller than container viewport top-aligns child.
  7. Boundary: clamp prevents negative `container.scrollTop`.
  8. Behavior-level check: with initial `window.scrollY = 150`, active slide navigation updates `container.scrollTop` while `window.scrollY` remains strictly 150.
  9. Absence Guard: Assert `src/operator/present/PresenterOperator.tsx` contains 0 occurrences of `.scrollIntoView(` on `activeRowRef`.
  10. Presence Guard: Assert `src/operator/present/PresenterOperator.tsx` references `slideListContainerRef` and invokes `scrollChildIntoContainerView`.
- Wire `node --import ./tests/register-ts-resolve.mjs --test tests/presenter-container-scroll.test.mjs` into `package.json` test script additively, preserving `--test-concurrency=1`.
