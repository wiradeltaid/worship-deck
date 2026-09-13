/**
 * SPEC-26: Canvas vs Presenter Visual & Framing Parity Smoke Suite
 *
 * Automated verification of:
 * - SPEC-26-01: Committed two-engine visual parity harness importing shipped modules
 * - SPEC-26-02: BUG-35 geometry drift fix on save & text engine reconciliation
 * - SPEC-26-03: Parity regression assertions & proven absence guards
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import {
  startBrowserEnvironment,
  stopBrowserEnvironment,
  loginViaUi,
  DEFAULT_ADMIN_USER,
  DEFAULT_ADMIN_PASS,
} from './helpers/browser-harness.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 1. Requirement 1: Directly import shipped modules from src/
const {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  elementToFabricObject,
  buildTextFabricOptions,
  applyFabricTextFit,
  serializeCanvas,
  pctToPx,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
assert.ok(fs.existsSync(artifactSlidePath), 'ArtifactSlide.tsx source must exist in src/components/artifacts/');

const registryPath = path.join(root, 'data', 'default-registry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

// --------------------------------------------------------------------------
// Helper: Sweep divergence evaluation across templates
// --------------------------------------------------------------------------
async function runTwoEngineParitySweep(page) {
  const totals = { FIT: 0, CLIP: 0, OVERRUN: 0, WRAP: 0, GEOM: 0, templates: 0, elements: 0 };
  const elementMetrics = [];
  const findingsByTemplate = {};

  for (const tpl of registry) {
    const layout = tpl.layouts?.default;
    if (!layout || !Array.isArray(layout.elements) || !layout.elements.length) continue;
    totals.templates++;

    await page.evaluate((l) => window.__SET_LAYOUT__(l), layout);
    await page.waitForFunction(() => window.__READY__ === true, null, { timeout: 15000 });

    const d = await page.evaluate(() => ({
      fabric: window.__FABRIC__,
      css: window.__CSS__,
      stage: window.__STAGE__,
    }));

    const findings = [];
    for (const el of layout.elements) {
      const f = d.fabric?.[el.id];
      const c = d.css?.[el.id];
      if (!f || !c) continue;
      totals.elements++;

      const SW = d.stage.width;
      const SH = d.stage.height;
      const n = (v, dim) => (dim === 'x' ? (v / SW) * 960 : (v / SH) * 540);
      const authored = {
        l: (el.x / 100) * 960,
        t: (el.y / 100) * 540,
        w: (el.w / 100) * 960,
        h: (el.h / 100) * 540,
      };
      const cb = {
        l: n(c.box.left, 'x'),
        t: n(c.box.top, 'y'),
        w: n(c.box.width, 'x'),
        h: n(c.box.height, 'y'),
      };

      const xDiffPct = Math.abs(cb.l - f.authoredLeft) / 960;
      const yDiffPct = Math.abs(cb.t - f.authoredTop) / 540;
      const wDiffPct = Math.abs(cb.w - f.width) / 960;
      const hDiffPct = Math.abs(cb.h - (f.clipHeight ?? f.height)) / 540;

      elementMetrics.push({
        templateId: tpl.id,
        elementId: el.id,
        type: el.type,
        xDiffPct,
        yDiffPct,
        wDiffPct,
        hDiffPct,
        cssFont: el.type === 'text' ? parseFloat(c.content?.computedFontSize || '0') : undefined,
        fabFont: el.type === 'text' ? f.fontSize : undefined,
        cssLines: el.type === 'text' ? c.content?.lineRects?.length : undefined,
        fabLines: el.type === 'text' ? (f.textLines || []).length : undefined,
      });

      // GEOM: box geometry disagrees by > 1px at 960x540
      if (
        Math.abs(cb.l - f.authoredLeft) > 1 ||
        Math.abs(cb.t - f.authoredTop) > 1 ||
        Math.abs(cb.w - f.width) > 1
      ) {
        findings.push(`GEOM ${el.id}: fabric(${f.authoredLeft.toFixed(1)},${f.authoredTop.toFixed(1)} w${f.width.toFixed(1)}) vs css(${cb.l.toFixed(1)},${cb.t.toFixed(1)} w${cb.w.toFixed(1)})`);
        totals.GEOM++;
      }

      if (el.type !== 'text' || !c.content) continue;

      // FIT: Painted font size disagreement between Fabric and ArtifactSlide
      const cssFont = parseFloat(c.content.computedFontSize || '0');
      const fabFont = f.fontSize ?? 32;
      if (Math.abs(cssFont - fabFont) > 1) {
        findings.push(`FIT ${el.id}: ArtifactSlide (${cssFont.toFixed(1)}px) vs Fabric (${fabFont.toFixed(1)}px)`);
        totals.FIT++;
      }

      // CLIP: content clipped in ArtifactSlide but unclipped in Fabric
      if (!f.hasClipPath && c.content.scrollHeight > Math.round(c.box.height) + 1) {
        findings.push(`CLIP ${el.id}: content ${c.content.scrollHeight}px in a ${Math.round(c.box.height)}px box — unclipped in Fabric`);
        totals.CLIP++;
      }

      // OVERRUN: Fabric paints below the authored box bottom
      const paintedHeight = f.hasClipPath ? (f.clipHeight ?? f.height) : (f.calcTextHeight ?? f.height);
      const fabricBottom = f.authoredTop + paintedHeight;
      const overrun = fabricBottom - (authored.t + authored.h);
      if (overrun > 1) {
        findings.push(`OVERRUN ${el.id}: Fabric paints ${overrun.toFixed(1)}px below authored box bottom`);
        totals.OVERRUN++;
      }

      // WRAP: line breaking differences
      const cssLines = c.content.lineRects?.length;
      const fabLines = (f.textLines || []).length;
      if (fabLines && cssLines && fabLines !== cssLines) {
        findings.push(`WRAP ${el.id}: Fabric ${fabLines} line(s) vs CSS ${cssLines} line(s)`);
        totals.WRAP++;
      }
    }

    if (findings.length > 0) {
      findingsByTemplate[tpl.id] = findings;
    }
  }

  return { totals, elementMetrics, findingsByTemplate };
}

// --------------------------------------------------------------------------
// SPEC-26-01 / SPEC-26-03: Two-engine visual parity sweep
// --------------------------------------------------------------------------

test('T-26-01: Two-engine visual parity harness imports shipped modules and evaluates 32 shipped templates', async () => {
  assert.ok(fs.existsSync(artifactSlidePath), 'ArtifactSlide component must exist in src/components/artifacts/ArtifactSlide.tsx');
  assert.ok(typeof elementToFabricObject === 'function', 'Must directly import elementToFabricObject from src/');
  assert.ok(typeof buildTextFabricOptions === 'function', 'Must directly import buildTextFabricOptions from src/');

  const env = await startBrowserEnvironment({ dbName: 'spec26-harness.db' });
  try {
    const page = await env.browser.newPage({ viewport: { width: 1000, height: 1120 } });
    await loginViaUi(page, env.baseUrl, DEFAULT_ADMIN_USER, DEFAULT_ADMIN_PASS);
    await page.goto(`${env.baseUrl}/services/diagnostic-parity`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.__SET_LAYOUT__ === 'function', null, { timeout: 10000 });

    const { totals, elementMetrics, findingsByTemplate } = await runTwoEngineParitySweep(page);

    console.log(`[SPEC-26-01 Harness] Swept ${totals.templates} templates / ${totals.elements} elements:`);
    console.log(`  GEOM:    ${totals.GEOM}`);
    console.log(`  WRAP:    ${totals.WRAP}`);
    console.log(`  FIT:     ${totals.FIT}`);
    console.log(`  CLIP:    ${totals.CLIP}`);
    console.log(`  OVERRUN: ${totals.OVERRUN}`);

    assert.equal(totals.templates, 32, 'Must evaluate all 32 shipped canvas templates');
    assert.equal(totals.elements, 64, 'Must evaluate all 64 elements across shipped templates');

    // SPEC-26-02 / SPEC-26-03 Target: 0 across all divergence categories
    assert.equal(totals.GEOM, 0, `GEOM divergence must be 0, got ${totals.GEOM}: ${JSON.stringify(findingsByTemplate)}`);
    assert.equal(totals.WRAP, 0, `WRAP divergence must be 0, got ${totals.WRAP}: ${JSON.stringify(findingsByTemplate)}`);
    assert.equal(totals.FIT, 0, `FIT divergence must be 0, got ${totals.FIT}: ${JSON.stringify(findingsByTemplate)}`);
    assert.equal(totals.CLIP, 0, `CLIP divergence must be 0, got ${totals.CLIP}: ${JSON.stringify(findingsByTemplate)}`);
    assert.equal(totals.OVERRUN, 0, `OVERRUN divergence must be 0, got ${totals.OVERRUN}: ${JSON.stringify(findingsByTemplate)}`);

    // Requirement 2: Normalized box x/y/w/h agree within 1% across all elements
    for (const m of elementMetrics) {
      assert.ok(m.xDiffPct <= 0.01, `Template ${m.templateId} el ${m.elementId} xDiffPct must be <= 1%, got ${m.xDiffPct * 100}%`);
      assert.ok(m.yDiffPct <= 0.01, `Template ${m.templateId} el ${m.elementId} yDiffPct must be <= 1%, got ${m.yDiffPct * 100}%`);
      assert.ok(m.wDiffPct <= 0.01, `Template ${m.templateId} el ${m.elementId} wDiffPct must be <= 1%, got ${m.wDiffPct * 100}%`);
      assert.ok(m.hDiffPct <= 0.01, `Template ${m.templateId} el ${m.elementId} hDiffPct must be <= 1%, got ${m.hDiffPct * 100}%`);

      if (m.type === 'text') {
        // Assert painted font size agrees within 1%
        const fontDiffPct = Math.abs(m.cssFont - m.fabFont) / m.cssFont;
        assert.ok(fontDiffPct <= 0.01, `Template ${m.templateId} el ${m.elementId} painted font size must agree within 1%, got CSS=${m.cssFont} Fab=${m.fabFont}`);

        // Assert line count agrees exactly
        assert.equal(m.cssLines, m.fabLines, `Template ${m.templateId} el ${m.elementId} line count must agree exactly, got CSS=${m.cssLines} Fab=${m.fabLines}`);
      }
    }

    await page.close();
  } finally {
    await stopBrowserEnvironment(env);
  }
});

// --------------------------------------------------------------------------
// SPEC-26-02 / SPEC-26-03: BUG-35 Regression Guard (Save without edit is no-op)
// --------------------------------------------------------------------------

class MockFabricObject {
  constructor(opts = {}) {
    this.type = opts.type || 'textbox';
    Object.assign(this, opts);
    this.data = opts.data || {};
  }
  get(key) {
    if (key === 'data') return this.data;
    return this[key];
  }
  set(keyOrObj, val) {
    if (typeof keyOrObj === 'object') Object.assign(this, keyOrObj);
    else this[keyOrObj] = val;
  }
}

class MockCanvas {
  constructor(objects = []) {
    this._objects = objects;
  }
  getObjects() {
    return [...this._objects];
  }
}

test('T-26-02: BUG-35 regression guard: serializeCanvas round-trip on all unedited templates is a strict no-op', () => {
  for (const tpl of registry) {
    const layout = tpl.layouts?.default;
    if (!layout || !Array.isArray(layout.elements)) continue;

    const mockObjects = layout.elements.map((el) => {
      const authoredW = pctToPx(el.w, CANVAS_WIDTH);
      const authoredH = pctToPx(el.h, CANVAS_HEIGHT);
      return new MockFabricObject({
        type: el.type === 'text' ? 'textbox' : el.type === 'shape' ? 'rect' : 'image',
        left: pctToPx(el.x, CANVAS_WIDTH),
        top: pctToPx(el.y, CANVAS_HEIGHT),
        // Simulate Fabric self-widening on unedited objects
        width: authoredW + 50,
        height: authoredH + 20,
        scaleX: 1,
        scaleY: 1,
        data: {
          elementId: el.id,
          authoredWidth: authoredW,
          authoredHeight: authoredH,
          userResizedWidth: false,
          userResizedHeight: false,
          userMoved: false,
        },
      });
    });

    const canvas = new MockCanvas(mockObjects);
    const serialized = serializeCanvas(canvas, layout, new Map(), { isHealingSave: false });

    for (let i = 0; i < layout.elements.length; i++) {
      const orig = layout.elements[i];
      const saved = serialized.find((e) => e.id === orig.id);
      assert.ok(saved, `Element ${orig.id} must be preserved in serialized output`);
      assert.equal(saved.x, orig.x, `Template ${tpl.id} el ${orig.id}.x must remain unchanged`);
      assert.equal(saved.y, orig.y, `Template ${tpl.id} el ${orig.id}.y must remain unchanged`);
      assert.equal(saved.w, orig.w, `Template ${tpl.id} el ${orig.id}.w must remain unchanged (BUG-35 regression)`);
      assert.equal(saved.h, orig.h, `Template ${tpl.id} el ${orig.id}.h must remain unchanged`);
    }
  }
});

// --------------------------------------------------------------------------
// SPEC-26-03: Absence-Guard Proofs (Executable verification against production modules)
// --------------------------------------------------------------------------

test('T-26-03: Absence-Guard Proof 1: serializeCanvas guards against computed width overwriting authored geometry (BUG-35)', () => {
  const sermonLayout = registry.find((t) => t.id === 'sermon').layouts.default;
  const origE1 = sermonLayout.elements.find((e) => e.id === 'e1');
  const authoredW = pctToPx(origE1.w, CANVAS_WIDTH);
  const authoredH = pctToPx(origE1.h, CANVAS_HEIGHT);

  // 1. Patched execution: Unedited element with authored dimensions preserved despite Fabric self-widening
  const cleanMock = new MockFabricObject({
    type: 'textbox',
    left: pctToPx(origE1.x, CANVAS_WIDTH),
    top: pctToPx(origE1.y, CANVAS_HEIGHT),
    width: authoredW + 124.3, // Fabric self-widened to 424.4px
    height: authoredH,
    scaleX: 1,
    scaleY: 1,
    data: {
      elementId: origE1.id,
      authoredWidth: authoredW,
      authoredHeight: authoredH,
      userResizedWidth: false,
      userResizedHeight: false,
      userMoved: false,
    },
  });

  const cleanSaved = serializeCanvas(new MockCanvas([cleanMock]), sermonLayout, new Map(), { isHealingSave: false });
  assert.equal(
    cleanSaved[0].w,
    origE1.w,
    `Production serializeCanvas must preserve authored width ${origE1.w}% when unedited, got ${cleanSaved[0].w}%`
  );

  // 2. Injected defect execution: Pre-SPEC-26 defect where userResizedWidth was assumed or authored width was unconstrained
  const defectiveMock = new MockFabricObject({
    type: 'textbox',
    left: pctToPx(origE1.x, CANVAS_WIDTH),
    top: pctToPx(origE1.y, CANVAS_HEIGHT),
    width: authoredW + 124.3,
    height: authoredH,
    scaleX: 1,
    scaleY: 1,
    data: {
      elementId: origE1.id,
      authoredWidth: authoredW,
      authoredHeight: authoredH,
      userResizedWidth: true, // Defect injection: force serializeCanvas to accept measured width
      userResizedHeight: false,
      userMoved: false,
    },
  });

  const defectiveSaved = serializeCanvas(new MockCanvas([defectiveMock]), sermonLayout, new Map(), { isHealingSave: false });
  assert.notEqual(
    defectiveSaved[0].w,
    origE1.w,
    'Absence guard proof: defect injection causes width to diverge from authored width'
  );
  assert.ok(
    defectiveSaved[0].w > origE1.w,
    `Defective width must be wider than authored (${defectiveSaved[0].w} > ${origE1.w})`
  );
});

test('T-26-03: Absence-Guard Proof 2: applyFabricTextFit establishes Canvas text fit policy matching ArtifactSlide (FIT)', () => {
  const sermonLayout = registry.find((t) => t.id === 'sermon').layouts.default;
  const sermonE1 = sermonLayout.elements.find((e) => e.id === 'e1');
  const authoredW = pctToPx(sermonE1.w, CANVAS_WIDTH);
  const authoredH = pctToPx(sermonE1.h, CANVAS_HEIGHT);

  class MockMeasuringTextbox {
    constructor(opts = {}) {
      this.type = 'textbox';
      Object.assign(this, opts);
      this.data = opts.data || {};
    }
    set(k, v) { this[k] = v; }
    initDimensions() {
      // At base font size 69.41px, {sermon_title} width is 424.4px (exceeds 300px box)
      this.dynamicMinWidth = (this.fontSize / 69.41) * 424.4;
    }
    calcTextHeight() {
      return (this.fontSize / 69.41) * 83;
    }
    getLineWidth() {
      return this.dynamicMinWidth;
    }
  }

  const mockFabric = {
    Rect: class {
      constructor(opts) { Object.assign(this, opts); }
    },
  };

  const tb = new MockMeasuringTextbox({
    fontSize: 69.41,
    left: pctToPx(sermonE1.x, CANVAS_WIDTH),
    top: pctToPx(sermonE1.y, CANVAS_HEIGHT),
    width: authoredW,
    height: authoredH,
    textLines: ['{sermon_title}'],
    data: { elementId: 'e1' },
  });

  // Before fit policy applied: fontSize is un-shrunk at 69.41px (broken FIT parity)
  assert.equal(tb.fontSize, 69.41, 'Raw Fabric Textbox starts at un-shrunk 69.41px');
  assert.equal(tb.data.fitScale, undefined, 'Raw Fabric Textbox has no fitScale applied');

  // Execute production applyFabricTextFit
  applyFabricTextFit(tb, sermonE1, mockFabric);

  // After fit policy applied: fontSize scaled down to fit 300px box, fitScale < 1 recorded
  assert.ok(
    tb.fontSize <= 49,
    `Production applyFabricTextFit must scale down font size to <= 49px to fit 300px box, got ${tb.fontSize}px`
  );
  assert.ok(
    tb.data.fitScale < 1,
    `Production applyFabricTextFit must record fitScale < 1 in data, got ${tb.data.fitScale}`
  );
});

test('T-26-03: Absence-Guard Proof 3: applyFabricTextFit bounds text with clipPath preventing overrun (CLIP/OVERRUN)', () => {
  const sermonLayout = registry.find((t) => t.id === 'sermon').layouts.default;
  const sermonE1 = sermonLayout.elements.find((e) => e.id === 'e1');
  const authoredW = pctToPx(sermonE1.w, CANVAS_WIDTH);
  const authoredH = pctToPx(sermonE1.h, CANVAS_HEIGHT);

  class MockMeasuringTextbox {
    constructor(opts = {}) {
      this.type = 'textbox';
      Object.assign(this, opts);
      this.data = opts.data || {};
    }
    set(k, v) { this[k] = v; }
    initDimensions() {}
    calcTextHeight() { return authoredH + 50; } // Overruns box by 50px
    getLineWidth() { return authoredW; }
  }

  const mockFabric = {
    Rect: class {
      constructor(opts) { Object.assign(this, opts); }
    },
  };

  const tb = new MockMeasuringTextbox({
    fontSize: 69.41,
    left: pctToPx(sermonE1.x, CANVAS_WIDTH),
    top: pctToPx(sermonE1.y, CANVAS_HEIGHT),
    width: authoredW,
    height: authoredH,
    textLines: ['{sermon_title}'],
    data: { elementId: 'e1' },
  });

  // Before fit policy applied: clipPath is undefined, allowing unclipped painting outside box
  assert.equal(tb.clipPath, undefined, 'Raw Fabric Textbox lacks clipPath');

  // Execute production applyFabricTextFit
  applyFabricTextFit(tb, sermonE1, mockFabric);

  // After fit policy applied: clipPath is attached matching authored box bounds
  assert.ok(tb.clipPath, 'Production applyFabricTextFit must attach clipPath');
  assert.equal(tb.clipPath.width, authoredW, 'clipPath width must match authored box width');
  assert.equal(tb.clipPath.height, authoredH, 'clipPath height must match authored box height');
  assert.equal(tb.clipPath.absolutePositioned, true, 'clipPath must be absolutePositioned');
});
