/**
 * SPEC-75 — Isolate Presenter Slide List Scroll from Window
 *
 * Verifies:
 * 1. Geometry calculation of scrollChildIntoContainerView across all vertical and horizontal boundary conditions.
 * 2. Exact edge alignment producing zero movement and zero jitter.
 * 3. Oversized child items top-aligning (vertical) or left-aligning (horizontal).
 * 4. Non-negative scroll clamping against negative boundaries.
 * 5. Behavior-level integration check demonstrating window.scrollY remains undisturbed when scrolling active child into container.
 * 6. Source absence and presence guards on PresenterOperator.tsx preventing regressions to window-scrolling scrollIntoView.
 * 7. Executable defect injection proving absence and presence guards fail on defects.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const presenterModelUrl = pathToFileURL(
  path.join(ROOT, 'src', 'operator', 'present', 'presenter-model.ts')
).href;

const PRESENTER_OPERATOR_PATH = path.join(
  ROOT,
  'src',
  'operator',
  'present',
  'PresenterOperator.tsx'
);

function makeMockElement(rect, initialScroll = 0) {
  let scroll = initialScroll;
  return {
    scrollTop: scroll,
    scrollLeft: scroll,
    getBoundingClientRect() {
      return {
        top: rect.top ?? 0,
        bottom: rect.bottom ?? (rect.top ?? 0) + (rect.height ?? 0),
        left: rect.left ?? 0,
        right: rect.right ?? (rect.left ?? 0) + (rect.width ?? 0),
        width: rect.width ?? (rect.right ?? 0) - (rect.left ?? 0),
        height: rect.height ?? (rect.bottom ?? 0) - (rect.top ?? 0),
      };
    },
  };
}

test('scrollChildIntoContainerView — null and invalid inputs return false safely', async () => {
  const { scrollChildIntoContainerView } = await import(presenterModelUrl);
  assert.equal(typeof scrollChildIntoContainerView, 'function');
  assert.equal(scrollChildIntoContainerView(null, null), false);
  assert.equal(scrollChildIntoContainerView(makeMockElement({}), null), false);
  assert.equal(scrollChildIntoContainerView(null, makeMockElement({})), false);
  assert.equal(scrollChildIntoContainerView({}, {}), false);
});

test('scrollChildIntoContainerView — vertical boundary conditions', async () => {
  const { scrollChildIntoContainerView } = await import(presenterModelUrl);

  const containerRect = { top: 100, bottom: 400, height: 300 };

  // 1. Child positioned completely above container
  {
    const container = makeMockElement(containerRect, 100);
    const child = makeMockElement({ top: 20, bottom: 60, height: 40 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, true);
    // delta = 20 - 100 = -80 => scrollTop = 100 - 80 = 20
    assert.equal(container.scrollTop, 20);
  }

  // 2. Child positioned completely below container
  {
    const container = makeMockElement(containerRect, 50);
    const child = makeMockElement({ top: 420, bottom: 470, height: 50 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, true);
    // delta = 470 - 400 = 70 => scrollTop = 50 + 70 = 120
    assert.equal(container.scrollTop, 120);
  }

  // 3. Child partially hidden at top edge
  {
    const container = makeMockElement(containerRect, 80);
    const child = makeMockElement({ top: 80, bottom: 130, height: 50 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, true);
    // delta = 80 - 100 = -20 => scrollTop = 80 - 20 = 60
    assert.equal(container.scrollTop, 60);
  }

  // 4. Child partially hidden at bottom edge
  {
    const container = makeMockElement(containerRect, 60);
    const child = makeMockElement({ top: 380, bottom: 430, height: 50 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, true);
    // delta = 430 - 400 = 30 => scrollTop = 60 + 30 = 90
    assert.equal(container.scrollTop, 90);
  }

  // 5. Child fully within container viewport (no movement)
  {
    const container = makeMockElement(containerRect, 50);
    const child = makeMockElement({ top: 150, bottom: 200, height: 50 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, false);
    assert.equal(container.scrollTop, 50);
  }

  // 6. Child exactly top edge aligned (no movement, no jitter)
  {
    const container = makeMockElement(containerRect, 50);
    const child = makeMockElement({ top: 100, bottom: 150, height: 50 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, false);
    assert.equal(container.scrollTop, 50);
  }

  // 7. Child exactly bottom edge aligned (no movement, no jitter)
  {
    const container = makeMockElement(containerRect, 50);
    const child = makeMockElement({ top: 350, bottom: 400, height: 50 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, false);
    assert.equal(container.scrollTop, 50);
  }

  // 8. Child taller than container (oversized item) -> top-aligns
  {
    const container = makeMockElement(containerRect, 40);
    const child = makeMockElement({ top: 180, bottom: 600, height: 420 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, true);
    // delta = 180 - 100 = 80 => scrollTop = 40 + 80 = 120
    assert.equal(container.scrollTop, 120);
  }

  // 9. Child taller than container already top-aligned -> no-op
  {
    const container = makeMockElement(containerRect, 100);
    const child = makeMockElement({ top: 100, bottom: 550, height: 450 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, false);
    assert.equal(container.scrollTop, 100);
  }

  // 10. Non-negative scroll clamping when target attempts to scroll past 0
  {
    const container = makeMockElement(containerRect, 20);
    const child = makeMockElement({ top: 30, bottom: 70, height: 40 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, true);
    // delta = 30 - 100 = -70 => 20 - 70 = -50 clamped to 0
    assert.equal(container.scrollTop, 0);
  }

  // 11. Clamping when already at 0 returns false
  {
    const container = makeMockElement(containerRect, 0);
    const child = makeMockElement({ top: 30, bottom: 70, height: 40 });
    const adjusted = scrollChildIntoContainerView(container, child, 'vertical');
    assert.equal(adjusted, false);
    assert.equal(container.scrollTop, 0);
  }
});

test('scrollChildIntoContainerView — horizontal boundary conditions', async () => {
  const { scrollChildIntoContainerView } = await import(presenterModelUrl);

  const containerRect = { left: 50, right: 350, width: 300 };

  // 1. Child to the left
  {
    const container = makeMockElement(containerRect, 100);
    const child = makeMockElement({ left: 10, right: 40, width: 30 });
    const adjusted = scrollChildIntoContainerView(container, child, 'horizontal');
    assert.equal(adjusted, true);
    // delta = 10 - 50 = -40 => 100 - 40 = 60
    assert.equal(container.scrollLeft, 60);
  }

  // 2. Child to the right
  {
    const container = makeMockElement(containerRect, 40);
    const child = makeMockElement({ left: 370, right: 420, width: 50 });
    const adjusted = scrollChildIntoContainerView(container, child, 'horizontal');
    assert.equal(adjusted, true);
    // delta = 420 - 350 = 70 => 40 + 70 = 110
    assert.equal(container.scrollLeft, 110);
  }

  // 3. Child fully visible horizontally
  {
    const container = makeMockElement(containerRect, 40);
    const child = makeMockElement({ left: 100, right: 150, width: 50 });
    const adjusted = scrollChildIntoContainerView(container, child, 'horizontal');
    assert.equal(adjusted, false);
    assert.equal(container.scrollLeft, 40);
  }

  // 4. Child wider than container -> left aligns
  {
    const container = makeMockElement(containerRect, 20);
    const child = makeMockElement({ left: 120, right: 500, width: 380 });
    const adjusted = scrollChildIntoContainerView(container, child, 'horizontal');
    assert.equal(adjusted, true);
    // delta = 120 - 50 = 70 => 20 + 70 = 90
    assert.equal(container.scrollLeft, 90);
  }
});

test('scrollChildIntoContainerView — behavior check: window scroll position strictly preserved on slide navigation', async () => {
  const { scrollChildIntoContainerView } = await import(presenterModelUrl);

  // Setup simulated global window with non-zero initial scroll
  const initialWindowScrollY = 175;
  const initialWindowScrollX = 0;
  const originalWindow = globalThis.window;

  globalThis.window = {
    scrollY: initialWindowScrollY,
    scrollX: initialWindowScrollX,
    scrollTo() {
      throw new Error('window.scrollTo should not be called');
    },
    scrollBy() {
      throw new Error('window.scrollBy should not be called');
    },
  };

  try {
    const listContainer = makeMockElement({ top: 200, bottom: 600, height: 400 }, 30);
    const offPanelListChild = makeMockElement({ top: 650, bottom: 700, height: 50 });

    const filmstripContainer = makeMockElement({ left: 100, right: 500, width: 400 }, 0);
    const offPanelFilmstripChild = makeMockElement({ left: 550, right: 620, width: 70 });

    // Simulate navigation event triggering both container scroll updates
    const listAdjusted = scrollChildIntoContainerView(listContainer, offPanelListChild, 'vertical');
    const filmstripAdjusted = scrollChildIntoContainerView(filmstripContainer, offPanelFilmstripChild, 'horizontal');

    assert.equal(listAdjusted, true);
    // delta = 700 - 600 = 100 => listContainer.scrollTop = 30 + 100 = 130
    assert.equal(listContainer.scrollTop, 130);

    assert.equal(filmstripAdjusted, true);
    // delta = 620 - 500 = 120 => filmstripContainer.scrollLeft = 0 + 120 = 120
    assert.equal(filmstripContainer.scrollLeft, 120);

    // CRITICAL: window.scrollY and window.scrollX MUST remain strictly unchanged
    assert.equal(globalThis.window.scrollY, initialWindowScrollY);
    assert.equal(globalThis.window.scrollX, initialWindowScrollX);
  } finally {
    globalThis.window = originalWindow;
  }
});

function verifyPresenterOperatorSource(source) {
  // Absence guard: activeRowRef must NOT invoke .scrollIntoView(
  const activeRowScrollIntoViewRegex = /activeRowRef\.current\??\.\s*scrollIntoView\s*\(/;
  if (activeRowScrollIntoViewRegex.test(source)) {
    throw new Error(
      'Defect detected: activeRowRef.current invokes scrollIntoView, which causes window displacement.'
    );
  }

  // Absence guard: activeFrameRef must NOT invoke .scrollIntoView(
  const activeFrameScrollIntoViewRegex = /activeFrameRef\.current\??\.\s*scrollIntoView\s*\(/;
  if (activeFrameScrollIntoViewRegex.test(source)) {
    throw new Error(
      'Defect detected: activeFrameRef.current invokes scrollIntoView, which causes window displacement.'
    );
  }

  // Presence guard: scrollChildIntoContainerView must be imported from presenter-model
  const importRegex = /import\s*\{[^}]*scrollChildIntoContainerView[^}]*\}\s*from\s*['"]\.\/presenter-model['"]/;
  if (!importRegex.test(source)) {
    throw new Error(
      'Defect detected: scrollChildIntoContainerView is not imported from ./presenter-model in PresenterOperator.tsx'
    );
  }

  // Presence guard: slideListContainerRef must be declared and attached
  if (!source.includes('slideListContainerRef = useRef<HTMLDivElement | null>(null)')) {
    throw new Error(
      'Defect detected: slideListContainerRef is not declared in PresenterOperator.tsx'
    );
  }

  if (!source.includes('ref={slideListContainerRef}')) {
    throw new Error(
      'Defect detected: ref={slideListContainerRef} is not attached to the slide list container in PresenterOperator.tsx'
    );
  }

  // Presence guard: filmstripContainerRef must be declared and attached
  if (!source.includes('filmstripContainerRef = useRef<HTMLDivElement | null>(null)')) {
    throw new Error(
      'Defect detected: filmstripContainerRef is not declared in PresenterOperator.tsx'
    );
  }

  if (!source.includes('ref={filmstripContainerRef}')) {
    throw new Error(
      'Defect detected: ref={filmstripContainerRef} is not attached to the filmstrip container in PresenterOperator.tsx'
    );
  }

  // Presence guard: scrollChildIntoContainerView must be invoked with slideListContainerRef (vertical)
  const listCallRegex = /scrollChildIntoContainerView\s*\(\s*slideListContainerRef\.current\s*,\s*activeRowRef\.current\s*,\s*['"]vertical['"]\s*\)/;
  if (!listCallRegex.test(source)) {
    throw new Error(
      'Defect detected: scrollChildIntoContainerView is not invoked with slideListContainerRef.current, activeRowRef.current, and "vertical"'
    );
  }

  // Presence guard: scrollChildIntoContainerView must be invoked with filmstripContainerRef (horizontal)
  const filmstripCallRegex = /scrollChildIntoContainerView\s*\(\s*filmstripContainerRef\.current\s*,\s*activeFrameRef\.current\s*,\s*['"]horizontal['"]\s*\)/;
  if (!filmstripCallRegex.test(source)) {
    throw new Error(
      'Defect detected: scrollChildIntoContainerView is not invoked with filmstripContainerRef.current, activeFrameRef.current, and "horizontal"'
    );
  }

  return true;
}

test('PresenterOperator source guard — absence of activeRowRef.scrollIntoView and presence of slideListContainerRef & filmstripContainerRef', () => {
  const source = readFileSync(PRESENTER_OPERATOR_PATH, 'utf-8');
  assert.equal(verifyPresenterOperatorSource(source), true);
});

test('PresenterOperator source guard — defect injection proof', () => {
  const validMockSource = `
    import { scrollChildIntoContainerView } from './presenter-model';
    const slideListContainerRef = useRef<HTMLDivElement | null>(null);
    const filmstripContainerRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
      if (slideListContainerRef.current && activeRowRef.current) {
        scrollChildIntoContainerView(slideListContainerRef.current, activeRowRef.current, 'vertical');
      }
      if (filmstripContainerRef.current && activeFrameRef.current) {
        scrollChildIntoContainerView(filmstripContainerRef.current, activeFrameRef.current, 'horizontal');
      }
    }, [index]);
    return (
      <div>
        <div ref={filmstripContainerRef} className="overflow-x-auto"></div>
        <div ref={slideListContainerRef} className="overflow-y-auto"></div>
      </div>
    );
  `;

  // Defect 1: Re-introducing activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  const defect1 = validMockSource + `\nactiveRowRef.current?.scrollIntoView({ block: 'nearest' });`;
  assert.throws(
    () => verifyPresenterOperatorSource(defect1),
    /activeRowRef\.current invokes scrollIntoView/
  );

  // Defect 2: Re-introducing activeFrameRef.current?.scrollIntoView(...)
  const defect2 = validMockSource + `\nactiveFrameRef.current?.scrollIntoView({ block: 'nearest' });`;
  assert.throws(
    () => verifyPresenterOperatorSource(defect2),
    /activeFrameRef\.current invokes scrollIntoView/
  );

  // Defect 3: Missing import of scrollChildIntoContainerView
  const defect3 = validMockSource.replace(
    `import { scrollChildIntoContainerView } from './presenter-model';`,
    `import { somethingElse } from './presenter-model';`
  );
  assert.throws(
    () => verifyPresenterOperatorSource(defect3),
    /scrollChildIntoContainerView is not imported/
  );

  // Defect 4: Missing slideListContainerRef declaration
  const defect4 = validMockSource.replace(
    `const slideListContainerRef = useRef<HTMLDivElement | null>(null);`,
    ``
  );
  assert.throws(
    () => verifyPresenterOperatorSource(defect4),
    /slideListContainerRef is not declared/
  );

  // Defect 5: Missing filmstripContainerRef declaration
  const defect5 = validMockSource.replace(
    `const filmstripContainerRef = useRef<HTMLDivElement | null>(null);`,
    ``
  );
  assert.throws(
    () => verifyPresenterOperatorSource(defect5),
    /filmstripContainerRef is not declared/
  );

  // Defect 6: Missing ref={slideListContainerRef} attachment
  const defect6 = validMockSource.replace(`ref={slideListContainerRef}`, ``);
  assert.throws(
    () => verifyPresenterOperatorSource(defect6),
    /ref=\{slideListContainerRef\} is not attached/
  );

  // Defect 7: Missing ref={filmstripContainerRef} attachment
  const defect7 = validMockSource.replace(`ref={filmstripContainerRef}`, ``);
  assert.throws(
    () => verifyPresenterOperatorSource(defect7),
    /ref=\{filmstripContainerRef\} is not attached/
  );

  // Defect 8: Missing invocation of scrollChildIntoContainerView on slideListContainerRef
  const defect8 = validMockSource.replace(
    `scrollChildIntoContainerView(slideListContainerRef.current, activeRowRef.current, 'vertical');`,
    `console.log('noop');`
  );
  assert.throws(
    () => verifyPresenterOperatorSource(defect8),
    /scrollChildIntoContainerView is not invoked with slideListContainerRef\.current/
  );

  // Defect 9: Missing invocation of scrollChildIntoContainerView on filmstripContainerRef
  const defect9 = validMockSource.replace(
    `scrollChildIntoContainerView(filmstripContainerRef.current, activeFrameRef.current, 'horizontal');`,
    `console.log('noop');`
  );
  assert.throws(
    () => verifyPresenterOperatorSource(defect9),
    /scrollChildIntoContainerView is not invoked with filmstripContainerRef\.current/
  );
});
