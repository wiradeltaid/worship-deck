/**
 * SPEC-97 — Presenter Zoom Layout Proportions Resilience
 *
 * Verifies:
 * 1. Structural AST and layout hierarchy of PresenterOperator.tsx ensuring:
 *    - Main layout uses decoupled 65/35 CSS grid proportions (lg:grid lg:grid-cols-[minmax(24rem,13fr)_minmax(18rem,7fr)])
 *    - Left panel is decoupled from --presenter-stage basis and grow-0
 *    - Current slide media frame scopes max-w-[var(--presenter-stage)] directly with 16:9 ratio
 *    - Next slide preview maintains 16:9 framing and max-w-[32rem]
 *    - Both left and right panels declare min-w-0 to prevent flex/grid blowouts
 * 2. Deterministic in-memory defect injection tests covering every claimed absence and presence guard.
 * 3. Playwright real-browser integration tests across equivalent zoom matrix:
 *    - 100%–175% desktop zoom viewports (Full HD & Laptop): panel width ratio strictly 62%–68%, zero horizontal overflow, 16:9 media ratio
 *    - Sub-lg stacked viewports: vertical stacking and full width containment
 *    - Scroll containment: verifies internal horizontal filmstrip and vertical slide list scrollers remain contained.
 *    (Geometry-level scrollChildIntoContainerView isolation is proven in tests/presenter-container-scroll.test.mjs).
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  startBrowserEnvironment,
  stopBrowserEnvironment,
  loginViaUi,
  loginAndGetCookie,
  createServiceViaApi,
  createOperatorAccount,
  DEFAULT_ADMIN_USER,
  DEFAULT_ADMIN_PASS,
} from './helpers/browser-harness.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const presenterOperatorPath = path.join(
  rootDir,
  'src',
  'operator',
  'present',
  'PresenterOperator.tsx'
);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

/**
 * Extracts class list or className attribute value from JSX tag opening.
 */
function extractTagClassName(source, tagName, testId) {
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*data-testid="${testId}"[^>]*>`, 's');
  const match = source.match(tagPattern);
  if (!match) return null;
  const tagStr = match[0];
  const stringMatch = tagStr.match(/className="([^"]*)"/s);
  if (stringMatch) return stringMatch[1];
  const templateMatch = tagStr.match(/className=\{`([^`]*)`/s);
  if (templateMatch) return templateMatch[1];
  return '';
}

export function scanPresenterPanelGeometry(presenterSrc = fs.readFileSync(presenterOperatorPath, 'utf8')) {
  const findings = [];
  const cleanSrc = stripComments(presenterSrc);

  // 1. Main layout container must declare data-testid="presenter-main-layout" and 65/35 grid proportions
  const mainClass = extractTagClassName(cleanSrc, 'main', 'presenter-main-layout');
  if (mainClass === null) {
    findings.push('PresenterOperator.tsx missing <main data-testid="presenter-main-layout">');
  } else {
    const classes = mainClass.split(/\s+/);
    if (!classes.includes('lg:grid')) {
      findings.push('presenter-main-layout missing "lg:grid" class');
    }
    if (!classes.includes('lg:grid-cols-[minmax(24rem,13fr)_minmax(18rem,7fr)]')) {
      findings.push('presenter-main-layout missing "lg:grid-cols-[minmax(24rem,13fr)_minmax(18rem,7fr)]" proportion contract');
    }
  }

  // 2. Left panel container must declare data-testid="presenter-left-panel" and min-w-0 without stage basis or grow-0
  const leftClass = extractTagClassName(cleanSrc, 'div', 'presenter-left-panel');
  if (leftClass === null) {
    findings.push('PresenterOperator.tsx missing <div data-testid="presenter-left-panel">');
  } else {
    const classes = leftClass.split(/\s+/);
    if (!classes.includes('min-w-0')) {
      findings.push('presenter-left-panel missing "min-w-0" for overflow containment');
    }
    if (classes.includes('lg:basis-[var(--presenter-stage)]')) {
      findings.push('presenter-left-panel must NOT declare "lg:basis-[var(--presenter-stage)]"');
    }
    if (classes.includes('lg:grow-0')) {
      findings.push('presenter-left-panel must NOT declare "lg:grow-0"');
    }
  }

  // 3. Current slide frame must declare data-testid="presenter-current-slide-frame" with max-w-[var(--presenter-stage)] and aspect-video
  const currentClass = extractTagClassName(cleanSrc, 'div', 'presenter-current-slide-frame');
  if (currentClass === null) {
    findings.push('PresenterOperator.tsx missing data-testid="presenter-current-slide-frame"');
  } else {
    const classes = currentClass.split(/\s+/);
    if (!classes.includes('max-w-[var(--presenter-stage)]')) {
      findings.push('presenter-current-slide-frame missing "max-w-[var(--presenter-stage)]"');
    }
    if (!classes.includes('aspect-video')) {
      findings.push('presenter-current-slide-frame missing "aspect-video"');
    }
  }

  // 4. Right panel container must declare data-testid="presenter-right-panel" and min-w-0 without hard basis or flex-1
  const rightClass = extractTagClassName(cleanSrc, 'aside', 'presenter-right-panel');
  if (rightClass === null) {
    findings.push('PresenterOperator.tsx missing <aside data-testid="presenter-right-panel">');
  } else {
    const classes = rightClass.split(/\s+/);
    if (!classes.includes('min-w-0')) {
      findings.push('presenter-right-panel missing "min-w-0" for overflow containment');
    }
    if (classes.includes('lg:basis-[18rem]')) {
      findings.push('presenter-right-panel must NOT declare "lg:basis-[18rem]"');
    }
    if (classes.includes('lg:flex-1')) {
      findings.push('presenter-right-panel must NOT declare "lg:flex-1"');
    }
  }

  // 5. Next slide frame must declare data-testid="presenter-next-slide-frame" with max-w-[32rem] and aspect-video
  const nextClass = extractTagClassName(cleanSrc, 'div', 'presenter-next-slide-frame');
  if (nextClass === null) {
    findings.push('PresenterOperator.tsx missing data-testid="presenter-next-slide-frame"');
  } else {
    const classes = nextClass.split(/\s+/);
    if (!classes.includes('max-w-[32rem]')) {
      findings.push('presenter-next-slide-frame missing "max-w-[32rem]"');
    }
    if (!classes.includes('aspect-video')) {
      findings.push('presenter-next-slide-frame missing "aspect-video"');
    }
  }

  return findings;
}

// ==============================================================================
// 1. Structural Unit & Complete In-Memory Defect Injection Suite
// ==============================================================================

test('SPEC-97-01 & SPEC-97-02: Presenter layout conforms to decoupled 65/35 grid proportions and scoped stage vars', () => {
  const findings = scanPresenterPanelGeometry();
  assert.deepEqual(findings, [], 'Presenter layout must have zero structural findings');
});

test('SPEC-97-03: Defect injection verifies scanPresenterPanelGeometry catches regressions across all absence/presence guards', () => {
  const originalSrc = fs.readFileSync(presenterOperatorPath, 'utf8');

  // Defect 1: Re-introduce basis-[var(--presenter-stage)] on left panel
  {
    const defectSrc = originalSrc.replace(
      'className="flex min-h-0 min-w-0 flex-col gap-3"',
      'className="flex min-h-0 min-w-0 flex-col gap-3 lg:basis-[var(--presenter-stage)]"'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('must NOT declare "lg:basis-[var(--presenter-stage)]"')),
      'Must report re-introduced left panel stage basis'
    );
  }

  // Defect 2: Re-introduce lg:grow-0 on left panel
  {
    const defectSrc = originalSrc.replace(
      'className="flex min-h-0 min-w-0 flex-col gap-3"',
      'className="flex min-h-0 min-w-0 flex-col gap-3 lg:grow-0"'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('must NOT declare "lg:grow-0"')),
      'Must report re-introduced left panel grow-0'
    );
  }

  // Defect 3: Left panel loses min-w-0
  {
    const defectSrc = originalSrc.replace(
      'className="flex min-h-0 min-w-0 flex-col gap-3"',
      'className="flex min-h-0 flex-col gap-3"'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('presenter-left-panel missing "min-w-0"')),
      'Must report left panel missing min-w-0'
    );
  }

  // Defect 4: Missing max-w-[var(--presenter-stage)] on current slide frame
  {
    const defectSrc = originalSrc.replace(
      'max-w-[var(--presenter-stage)]',
      ''
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('missing "max-w-[var(--presenter-stage)]"')),
      'Must report missing max-w-[var(--presenter-stage)] on current slide frame'
    );
  }

  // Defect 5: Current slide frame loses aspect-video
  {
    const defectSrc = originalSrc.replace(
      'className={`aspect-video w-full max-w-[var(--presenter-stage)]',
      'className={`w-full max-w-[var(--presenter-stage)]'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('presenter-current-slide-frame missing "aspect-video"')),
      'Must report current slide frame missing aspect-video'
    );
  }

  // Defect 6: Missing 65/35 grid proportion contract
  {
    const defectSrc = originalSrc.replace(
      'lg:grid-cols-[minmax(24rem,13fr)_minmax(18rem,7fr)]',
      'lg:flex-row'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('missing "lg:grid-cols-[minmax(24rem,13fr)_minmax(18rem,7fr)]"')),
      'Must report missing grid proportion contract'
    );
  }

  // Defect 7: Main layout loses lg:grid
  {
    const defectSrc = originalSrc.replace('lg:grid ', '');
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('presenter-main-layout missing "lg:grid" class')),
      'Must report main layout missing lg:grid'
    );
  }

  // Defect 8: Right panel re-introduces lg:basis-[18rem]
  {
    const defectSrc = originalSrc.replace(
      'className="flex min-h-0 min-w-0 flex-col gap-4"',
      'className="flex min-h-0 min-w-0 flex-col gap-4 lg:basis-[18rem]"'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('must NOT declare "lg:basis-[18rem]"')),
      'Must report right panel re-introduced basis-[18rem]'
    );
  }

  // Defect 9: Right panel re-introduces lg:flex-1
  {
    const defectSrc = originalSrc.replace(
      'className="flex min-h-0 min-w-0 flex-col gap-4"',
      'className="flex min-h-0 min-w-0 flex-col gap-4 lg:flex-1"'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('must NOT declare "lg:flex-1"')),
      'Must report right panel re-introduced flex-1'
    );
  }

  // Defect 10: Right panel loses min-w-0
  {
    const defectSrc = originalSrc.replace(
      'className="flex min-h-0 min-w-0 flex-col gap-4"',
      'className="flex min-h-0 flex-col gap-4"'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('presenter-right-panel missing "min-w-0"')),
      'Must report right panel missing min-w-0'
    );
  }

  // Defect 11: Next slide preview loses max-w-[32rem]
  {
    const defectSrc = originalSrc.replace(
      'className="aspect-video w-full max-w-[32rem]',
      'className="aspect-video w-full'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('presenter-next-slide-frame missing "max-w-[32rem]"')),
      'Must report next slide frame missing max-w-[32rem]'
    );
  }

  // Defect 12: Next slide preview loses aspect-video
  {
    const defectSrc = originalSrc.replace(
      'className="aspect-video w-full max-w-[32rem]',
      'className="w-full max-w-[32rem]'
    );
    const findings = scanPresenterPanelGeometry(defectSrc);
    assert.ok(
      findings.some((f) => f.includes('presenter-next-slide-frame missing "aspect-video"')),
      'Must report next slide frame missing aspect-video'
    );
  }
});

// ==============================================================================
// 2. Real-Browser Playwright Integration Suite
// ==============================================================================

describe('SPEC-97: Presenter zoom layout proportions and viewport matrix browser integration', () => {
  let env;
  let serviceId;
  const operatorUser = 'operator_spec97';
  const operatorPass = 'op-pass-spec97';

  before(async () => {
    env = await startBrowserEnvironment({ dbName: 'test-presenter-geometry.db' });
    const adminCookie = await loginAndGetCookie(env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);

    await createOperatorAccount(env.baseUrl, adminCookie, operatorUser, operatorPass);

    const rawRundown = `SABBATH, OCTOBER 3, 2026
DIVINE SERVICE
Opening Song: SDAH #100
Scripture Reading: Psalm 23:1-6
Sermon: Speaker Name "The Lord Is My Shepherd"
Closing Song: SDAH #200`;

    const svc = await createServiceViaApi(env.baseUrl, adminCookie, rawRundown);
    serviceId = svc.id;
  });

  after(async () => {
    if (env) {
      await stopBrowserEnvironment(env);
    }
  });

  test('Presenter layout maintains 62%–68% ratio, zero horizontal overflow, and scroll containment across zoom matrix', async () => {
    const { browser, baseUrl } = env;
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    await loginViaUi(page, baseUrl, operatorUser, operatorPass);
    await page.goto(`${baseUrl}/services/${serviceId}/present`, { waitUntil: 'domcontentloaded' });

    // Wait for presenter layout to be ready
    const mainLayout = page.locator('[data-testid="presenter-main-layout"]');
    await mainLayout.waitFor({ state: 'visible', timeout: 15000 });

    const leftPanel = page.locator('[data-testid="presenter-left-panel"]');
    const rightPanel = page.locator('[data-testid="presenter-right-panel"]');
    const currentFrame = page.locator('[data-testid="presenter-current-slide-frame"]');

    // Matrix of equivalent zoom viewports
    const desktopViewports = [
      { name: '1080p unzoomed (100%)', width: 1920, height: 1080 },
      { name: '1080p @ 110% zoom', width: 1745, height: 982 },
      { name: '1080p @ 125% zoom', width: 1536, height: 864 },
      { name: '1080p @ 150% zoom', width: 1280, height: 720 },
      { name: '1080p @ 175% zoom', width: 1097, height: 617 },
      { name: '768p unzoomed (100%)', width: 1366, height: 768 },
      { name: '768p @ 110% zoom', width: 1242, height: 698 },
      { name: '768p @ 125% zoom', width: 1093, height: 614 },
    ];

    for (const vp of desktopViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(100);

      const leftBox = await leftPanel.boundingBox();
      const rightBox = await rightPanel.boundingBox();
      assert.ok(leftBox && rightBox, `Bounding boxes must exist at ${vp.name}`);

      const totalWidth = leftBox.width + rightBox.width;
      const leftRatio = leftBox.width / totalWidth;

      // Acceptance criterion 1: Left panel ratio is strictly within the 62%–68% band
      assert.ok(
        leftRatio >= 0.62 && leftRatio <= 0.68,
        `Left panel width ratio at ${vp.name} (${(leftRatio * 100).toFixed(2)}%) must fall within 62%–68% band`
      );

      // Acceptance criterion 2: Strictly zero horizontal page overflow
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      assert.equal(
        horizontalOverflow,
        false,
        `Page must not have horizontal overflow at ${vp.name}`
      );

      // Acceptance criterion 3: Current slide media container maintains 16:9 ratio (1.77 ± 0.08)
      const currentBox = await currentFrame.boundingBox();
      assert.ok(currentBox, `Current slide frame bounding box must exist at ${vp.name}`);
      const currentAspect = currentBox.width / currentBox.height;
      assert.ok(
        Math.abs(currentAspect - 16 / 9) <= 0.08,
        `Current slide media ratio at ${vp.name} (${currentAspect.toFixed(3)}) must approximate 16:9 (1.778)`
      );
    }

    // Scroll containment verification:
    // Verify filmstrip container has horizontal scroll containment
    const filmstripScroller = page.locator('section[aria-label="Slide filmstrip"] div.overflow-x-auto').first();
    await filmstripScroller.waitFor({ state: 'visible' });
    const filmstripOverflowX = await filmstripScroller.evaluate((el) => window.getComputedStyle(el).overflowX);
    assert.equal(filmstripOverflowX, 'auto', 'Filmstrip container must maintain overflow-x: auto scroll containment');

    // Verify slide list container has vertical scroll containment
    const slideListScroller = page.locator('div.overflow-y-auto.max-lg\\:max-h-\\[45vh\\]').first();
    await slideListScroller.waitFor({ state: 'visible' });
    const slideListOverflowY = await slideListScroller.evaluate((el) => window.getComputedStyle(el).overflowY);
    assert.equal(slideListOverflowY, 'auto', 'Slide list container must maintain overflow-y: auto scroll containment');

    // Sub-lg viewports (zoom >= 200% or mobile window)
    const subLgViewports = [
      { name: '1080p @ 200% zoom (< lg breakpoint)', width: 960, height: 540 },
      { name: '768p @ 150% zoom (< lg breakpoint)', width: 911, height: 512 },
    ];

    for (const vp of subLgViewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(100);

      const leftBox = await leftPanel.boundingBox();
      const rightBox = await rightPanel.boundingBox();
      const mainBox = await mainLayout.boundingBox();

      assert.ok(leftBox && rightBox && mainBox, `Bounding boxes must exist at ${vp.name}`);

      // Vertical column stacking below lg: left panel sits above right panel
      assert.ok(
        leftBox.y < rightBox.y,
        `Panels must stack vertically below lg breakpoint at ${vp.name} (left y: ${leftBox.y}, right y: ${rightBox.y})`
      );

      // Zero horizontal page overflow
      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth
      );
      assert.equal(
        horizontalOverflow,
        false,
        `Sub-lg page must not have horizontal overflow at ${vp.name}`
      );
    }

    await context.close();
  });
});
