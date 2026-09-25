# 01: Isolate Presenter Slide List Scroll from Window (WSD-W1)

**What to build:** In `src/operator/present/PresenterOperator.tsx`, eliminate window auto-scrolling during slide navigation by replacing `activeRowRef.current?.scrollIntoView({ block: 'nearest' })` with container-scoped scroll adjustments on the `slides` list section. Attach `slideListContainerRef` to the vertical slides list container (`<div className="min-h-0 flex-1 overflow-y-auto p-1.5 ...">`). Implement and export `scrollChildIntoContainerView(container, child, axis)` in `src/operator/present/presenter-model.ts`, which mathematically compares `child.getBoundingClientRect()` against `container.getBoundingClientRect()` and adjusts only `container.scrollTop` (with boundary handling for partially visible rows, edge alignment, oversized items, and non-negative clamping) to bring the active row into view at the nearest edge without displacing `window.scrollY`. Author `tests/presenter-container-scroll.test.mjs` with comprehensive boundary geometry tests, a behavior-level verification check starting from non-zero `window.scrollY`, and source absence guards proving zero `.scrollIntoView(` calls on `activeRowRef` in `PresenterOperator.tsx`. Additively wire into `package.json` preserving `--test-concurrency=1` and loader flags.

**Blocked by:** None (can start immediately).

**Status:** closed

- [x] Read `src/operator/present/PresenterOperator.tsx` and `src/operator/present/presenter-model.ts` first.
- [x] In `src/operator/present/presenter-model.ts`:
      - Implement and export `scrollChildIntoContainerView(container: HTMLElement, child: HTMLElement, axis: 'vertical' | 'horizontal' = 'vertical'): boolean`.
      - On vertical axis:
        - If child height > container height: top-align (`container.scrollTop += (childTop - containerTop)`).
        - Else if child top < container top: adjust `container.scrollTop -= (containerTop - childTop)`.
        - Else if child bottom > container bottom: adjust `container.scrollTop += (childBottom - containerBottom)`.
        - Else: return `false` (no-op).
      - Enforce non-negative clamping: `container.scrollTop = Math.max(0, container.scrollTop)`.
      - Return `true` if scroll was adjusted, `false` if already fully visible.
- [x] In `src/operator/present/PresenterOperator.tsx`:
      - Declare `slideListContainerRef = useRef<HTMLDivElement | null>(null)` and attach to `<div className="min-h-0 flex-1 overflow-y-auto p-1.5 ...">` in the Slides section.
      - In the `useEffect([index])` hook, replace bare `activeRowRef.current?.scrollIntoView` call with:
        `if (slideListContainerRef.current && activeRowRef.current) scrollChildIntoContainerView(slideListContainerRef.current, activeRowRef.current, 'vertical');`
      - Ensure filmstrip thumbnail tracking does not invoke ancestor vertical scrolling.
      - Verify that `activeRowRef` no longer invokes `.scrollIntoView()`.
- [x] Author `tests/presenter-container-scroll.test.mjs`:
      - Verify vertical scrolling calculation for child elements positioned above, below, partially hidden at edges, and within container viewport.
      - Verify zero movement and zero jitter when child element is exactly edge-aligned.
      - Verify top-alignment when child is taller than container viewport.
      - Verify non-negative scroll clamping when target attempts to scroll past 0.
      - Behavior-level check: initialize environment with non-zero `window.scrollY` (e.g. 150), trigger active slide navigation to an off-panel item, and assert that `container.scrollTop` updates while `window.scrollY` remains strictly 150.
      - Absence guard asserting `src/operator/present/PresenterOperator.tsx` contains 0 occurrences of `.scrollIntoView(` on `activeRowRef`.
      - Presence guard asserting `src/operator/present/PresenterOperator.tsx` imports and calls `scrollChildIntoContainerView`.
- [x] Wire `node --import ./tests/register-ts-resolve.mjs --test tests/presenter-container-scroll.test.mjs` into `package.json` test script additively (preserving existing test commands and `--test-concurrency=1`).
- [x] Run test suite (`node --import ./tests/register-ts-resolve.mjs --test tests/presenter-container-scroll.test.mjs` and `npm run typecheck`) to ensure 100% clean execution.
