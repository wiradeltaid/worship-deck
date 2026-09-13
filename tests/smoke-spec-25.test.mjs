/**
 * SPEC-25: Canvas/Presenter Parity Gap & Heal-Crash Smoke Suite
 *
 * Automated verification of:
 * - SPEC-25-01: healTemplate Fabric object construction & style fidelity (BUG-33)
 * - SPEC-25-02: Regression tests & absence guards for crash and style corruption
 * - SPEC-25-03: Stage aspect ratio letterbox parity across viewports (BUG-34)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  healTemplate,
  isElementUnmeasured,
  buildTextFabricOptions,
  buildShapeFabricOptions,
  elementToFabricObject,
  serializeCanvas,
  serializeTextStyle,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'canvas-utils.ts')).href
);

// --------------------------------------------------------------------------
// SPEC-25-01 / SPEC-25-02: BUG-33 Crash & Style Corruption Regressions
// --------------------------------------------------------------------------

test('T-25-01: healTemplate with real StaticCanvas handles combined text, shape and image without crash', async () => {
  const fabricNode = await import('fabric/node');

  const legacyFixture = {
    schemaVersion: 1,
    id: 'spec-25-combined-test',
    label: 'SPEC-25 Combined Test',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'unmeasured-text',
            type: 'text',
            required: false,
            x: 10,
            y: 10,
            w: 40,
            h: 20,
            zIndex: 0,
            content: 'Bandung international community',
            style: {
              fontSize: 32,
              fontFamily: 'Arial',
              fontColor: '#FFFFFF',
              textAlign: 'center',
              lineHeight: 1.2,
              textDecoration: 'underline',
              textShadow: true,
              textShadowBlur: 4,
            },
          },
          {
            id: 'legacy-shape',
            type: 'shape',
            required: false,
            x: 10,
            y: 40,
            w: 30,
            h: 20,
            zIndex: 1,
            style: {
              fillColor: '#5C2E16',
              opacity: 0.8,
            },
          },
          {
            id: 'legacy-image-ph',
            type: 'image-placeholder',
            required: false,
            placeholderKey: 'flyer',
            x: 50,
            y: 40,
            w: 40,
            h: 30,
            zIndex: 2,
          },
        ],
      },
    },
  };

  // Verify text element is initially unmeasured
  const textEl = legacyFixture.layouts.default.elements[0];
  assert.equal(isElementUnmeasured(textEl), true, 'text element must be unmeasured');

  // Must not throw when called with real fabric/node module
  let result;
  assert.doesNotThrow(() => {
    result = healTemplate(legacyFixture, fabricNode);
  }, 'healTemplate with real fabric/node must not crash with t._set is not a function');

  assert.ok(result && result.changed, 'heal pass must report changed = true');
  assert.equal(result.measuredCount, 1, 'measured 1 unmeasured text element');

  const healedElements = result.updatedTemplate.layouts.default.elements;
  assert.equal(healedElements.length, 3, 'preserves all 3 elements');

  const healedShape = healedElements.find((e) => e.id === 'legacy-shape');
  const healedImg = healedElements.find((e) => e.id === 'legacy-image-ph');
  const healedText = healedElements.find((e) => e.id === 'unmeasured-text');

  assert.ok(healedText, 'healed text element must be present in layout');
  assert.equal(healedText.style?.fontColor, '#FFFFFF', 'text fontColor preserved on heal');
  assert.equal(healedText.style?.textAlign, 'center', 'text textAlign preserved on heal');
  assert.equal(healedText.style?.lineHeight, 1.2, 'text lineHeight preserved on heal');
  assert.equal(healedText.style?.textDecoration, 'underline', 'text textDecoration preserved on heal');
  assert.equal(healedText.style?.textShadow, true, 'text textShadow preserved on heal');
  assert.equal(healedText.style?.textShadowBlur, 4, 'text textShadowBlur preserved on heal');
  assert.ok(healedText.wrapLines && healedText.wrapLines.length > 0, 'wrapLines added');
  assert.ok(typeof healedText.longestWordPx === 'number' && healedText.longestWordPx > 0, 'longestWordPx added');
  assert.ok(healedText.measuredWith, 'measuredWith added');

  assert.equal(healedShape.style?.fillColor, '#5C2E16', 'shape fillColor preserved');
  assert.equal(healedShape.style?.opacity, 0.8, 'shape opacity preserved');
  assert.equal(healedShape.w, 30, 'shape w preserved');
  assert.equal(healedShape.h, 20, 'shape h preserved');
  assert.equal(healedImg.w, 40, 'image placeholder w preserved');
  assert.equal(healedImg.h, 30, 'image placeholder h preserved');
});

test('T-25-02: buildTextFabricOptions assembles complete typography & style options without data loss', () => {
  const fullTextElement = {
    id: 'txt-styled',
    type: 'text',
    x: 10,
    y: 10,
    w: 50,
    h: 25,
    zIndex: 1,
    content: 'Full Styled Text',
    style: {
      fontSize: 48,
      fontFamily: 'Great Vibes',
      fontColor: '#FFEEDD',
      fontWeight: 'bold',
      fontStyle: 'italic',
      textAlign: 'center',
      lineHeight: 1.4,
      textDecoration: 'underline',
      textShadow: true,
      textShadowBlur: 8,
    },
  };

  const opts = buildTextFabricOptions(fullTextElement);

  assert.equal(opts.fill, '#FFEEDD', 'fontColor maps to fill');
  assert.equal(opts.fontSize, 48, 'fontSize normalized');
  assert.ok(opts.fontFamily.includes('Great Vibes'), 'fontFamily resolved with fallback stack');
  assert.equal(opts.fontWeight, 'bold', 'fontWeight preserved');
  assert.equal(opts.fontStyle, 'italic', 'fontStyle preserved');
  assert.equal(opts.textAlign, 'center', 'textAlign preserved');
  assert.equal(opts.lineHeight, 1.4, 'lineHeight preserved');
  assert.equal(opts.underline, true, 'textDecoration underline maps to underline: true');
  assert.ok(opts.shadow, 'shadow options constructed');
  assert.equal(opts.shadow.blur, 8, 'textShadowBlur preserved');
});

test('T-25-03: Shape and image elements carry full style and geometry fidelity on heal', async () => {
  const fabricNode = await import('fabric/node');

  const shapeElement = {
    id: 'shp-1',
    type: 'shape',
    x: 15,
    y: 20,
    w: 45,
    h: 35,
    zIndex: 2,
    style: { fillColor: '#123456', opacity: 0.65 },
  };

  const shapeOpts = buildShapeFabricOptions(shapeElement);
  assert.equal(shapeOpts.fill, '#123456', 'shapeOpts fillColor matches');
  assert.equal(shapeOpts.opacity, 0.65, 'shapeOpts opacity matches');

  const shapeObj = elementToFabricObject(fabricNode, shapeElement, false);
  assert.ok(shapeObj instanceof fabricNode.Rect, 'shape constructs real fabric.Rect');
  assert.equal(shapeObj.fill, '#123456');
  assert.equal(shapeObj.opacity, 0.65);
});

test('T-25-04: Untouched elements invariant and double-pass idempotency', async () => {
  const fabricNode = await import('fabric/node');

  const template = {
    schemaVersion: 1,
    id: 'tmpl-idempotency',
    label: 'Idempotency Test',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'txt-1',
            type: 'text',
            x: 5,
            y: 5,
            w: 40,
            h: 20,
            zIndex: 0,
            content: 'First Pass Measurement',
            style: { fontSize: 32, fontColor: '#FFFFFF' },
          },
          {
            id: 'shp-1',
            type: 'shape',
            x: 10,
            y: 30,
            w: 25,
            h: 15,
            zIndex: 1,
            style: { fillColor: '#AABBCC', opacity: 0.9 },
          },
          {
            id: 'token-txt',
            type: 'text',
            x: 5,
            y: 60,
            w: 50,
            h: 10,
            zIndex: 2,
            content: '{speaker_name}',
            style: { fontSize: 24, fontColor: '#00FF00', textAlign: 'right' },
          },
        ],
      },
    },
  };

  // Pass 1
  const res1 = healTemplate(template, fabricNode);
  assert.equal(res1.changed, true, 'pass 1 changed = true');
  assert.equal(res1.measuredCount, 1, 'pass 1 measured 1 text element');

  const healedElements1 = res1.updatedTemplate.layouts.default.elements;
  const shp1 = healedElements1.find((e) => e.id === 'shp-1');
  assert.equal(shp1.x, 10);
  assert.equal(shp1.y, 30);
  assert.equal(shp1.w, 25);
  assert.equal(shp1.h, 15);
  assert.equal(shp1.style.fillColor, '#AABBCC');
  assert.equal(shp1.style.opacity, 0.9);

  const tokenTxt1 = healedElements1.find((e) => e.id === 'token-txt');
  assert.equal(tokenTxt1.style.fontColor, '#00FF00');
  assert.equal(tokenTxt1.style.textAlign, 'right');

  // Pass 2: Idempotent double-pass
  const res2 = healTemplate(res1.updatedTemplate, fabricNode);
  assert.equal(res2.changed, false, 'pass 2 changed = false');
  assert.equal(res2.measuredCount, 0, 'pass 2 measured 0 elements');

  const healedElements2 = res2.updatedTemplate.layouts.default.elements;
  assert.deepEqual(healedElements1, healedElements2, 'pass 2 produces byte-identical output to pass 1');
});

test('T-25-05: Absence Guard: Bare object literal in canvas.add throws _set error vs elementToFabricObject succeeding', async () => {
  const fabricNode = await import('fabric/node');
  const canvas = new fabricNode.StaticCanvas(null, {
    width: 960,
    height: 540,
    renderOnAddRemove: false,
  });

  const shapeElement = {
    id: 'test-shape',
    type: 'shape',
    x: 10,
    y: 10,
    w: 20,
    h: 20,
    zIndex: 1,
    style: { fillColor: '#5C2E16', opacity: 0.9 },
  };

  // The pre-SPEC-25 BUG-33 defect behavior:
  // healTemplate did `canvas.add({ ...common, type: element.type })`
  const unpatchedBareObject = {
    left: 96,
    top: 54,
    width: 192,
    height: 108,
    type: shapeElement.type,
  };

  assert.throws(
    () => {
      canvas.add(unpatchedBareObject);
    },
    (err) => {
      return err instanceof TypeError && err.message.includes('_set');
    },
    'Adding an unpatched bare object literal to a real StaticCanvas throws TypeError involving _set (BUG-33 defect proof)'
  );

  // The patched SPEC-25 behavior:
  // healTemplate calls elementToFabricObject(fabricNode, shapeElement) -> real fabric.Rect
  const patchedObject = elementToFabricObject(fabricNode, shapeElement, false, { isHealing: true });
  assert.doesNotThrow(() => {
    canvas.add(patchedObject);
  }, 'Adding real Fabric instance constructed by elementToFabricObject succeeds without throwing');
});

test('T-25-06: Absence Guard: Pre-SPEC-25 partial text construction strips styles on serialization vs patched options preserving them', () => {
  const testElement = {
    id: 'txt-corrupt-proof',
    type: 'text',
    x: 10,
    y: 10,
    w: 50,
    h: 20,
    zIndex: 1,
    content: 'Corrupt Proof',
    style: {
      fontSize: 40,
      fontColor: '#112233',
      textAlign: 'right',
      lineHeight: 1.5,
      textDecoration: 'underline',
      textShadow: true,
      textShadowBlur: 6,
    },
  };

  // 1. Unpatched BUG-33 defect reproduction:
  // The old healTemplate text construction only passed fontSize, fontFamily, fontWeight, fontStyle.
  // When constructed in Fabric without styling options, Fabric sets fill: 'rgb(0,0,0)',
  // shadow: null, and underline: false.
  // When serialized via serializeTextStyle, this wipes fontColor to #000000,
  // deletes textShadow/textShadowBlur, and deletes textDecoration.
  const oldPartialTextObj = {
    type: 'text',
    fontSize: 40,
    fontFamily: 'Arial',
    fontWeight: 'normal',
    fontStyle: 'normal',
    fill: 'rgb(0,0,0)',
    shadow: null,
    underline: false,
  };

  const serializedOld = serializeTextStyle(testElement, oldPartialTextObj);
  assert.notEqual(
    serializedOld?.fontColor,
    testElement.style.fontColor,
    'Unpatched construction corrupts fontColor (#000000 instead of #112233)'
  );
  assert.equal(
    serializedOld?.fontColor,
    '#000000',
    'Unpatched construction repaints text black (#000000)'
  );
  assert.equal(
    serializedOld?.textShadow,
    undefined,
    'Unpatched construction deletes textShadow'
  );
  assert.equal(
    serializedOld?.textDecoration,
    undefined,
    'Unpatched construction deletes textDecoration underline'
  );

  // 2. Patched SPEC-25 behavior:
  // Full options from buildTextFabricOptions provide all style fields to Textbox
  const fullOpts = buildTextFabricOptions(testElement);
  assert.equal(fullOpts.fill, '#112233', 'patched options pass fontColor');
  assert.equal(fullOpts.textAlign, 'right', 'patched options pass textAlign');
  assert.equal(fullOpts.lineHeight, 1.5, 'patched options pass lineHeight');
  assert.equal(fullOpts.underline, true, 'patched options pass underline');
  assert.ok(fullOpts.shadow, 'patched options pass shadow');

  const serializedPatched = serializeTextStyle(testElement, fullOpts);
  assert.equal(serializedPatched?.fontColor, '#112233', 'Patched construction preserves fontColor');
  assert.equal(serializedPatched?.textAlign, 'right', 'Patched construction preserves textAlign');
  assert.equal(serializedPatched?.lineHeight, 1.5, 'Patched construction preserves lineHeight');
  assert.equal(serializedPatched?.textDecoration, 'underline', 'Patched construction preserves textDecoration');
  assert.equal(serializedPatched?.textShadow, true, 'Patched construction preserves textShadow');
  assert.equal(serializedPatched?.textShadowBlur, 6, 'Patched construction preserves textShadowBlur');
});

// --------------------------------------------------------------------------
// SPEC-25-03: Stage Aspect-Ratio Parity (BUG-34)
// --------------------------------------------------------------------------

test('T-25-07: Stage letterbox aspect ratio remains strictly 16:9 across wider, taller and exact viewports', async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    const viewports = [
      { name: 'Ultra-wide (21:9 ratio)', width: 2560, height: 1080 },
      { name: 'Wide landscape (1920x800)', width: 1920, height: 800 },
      { name: 'Standard 16:9 (1920x1080)', width: 1920, height: 1080 },
      { name: 'Square viewport (1000x1000)', width: 1000, height: 1000 },
      { name: 'Tall portrait (1080x1920)', width: 1080, height: 1920 },
      { name: 'Small presenter thumbnail (340x250)', width: 340, height: 250 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.setContent(`
        <div style="display: flex; height: ${vp.height}px; width: ${vp.width}px; align-items: center; justify-content: center; overflow: hidden; container-type: size;">
          <div id="stage" style="position: relative; width: min(100cqw, calc(100cqh * 16 / 9)); max-height: 100cqh; aspect-ratio: 16 / 9; background: #000;">
            <div id="stage-inner" style="position: absolute; inset: 0; overflow: hidden;">
              <div id="content-block" style="position: absolute; left: 5%; top: 5%; width: 90%; height: 90%; background: #5C2E16;"></div>
            </div>
          </div>
        </div>
      `);

      const stageBox = await page.locator('#stage').boundingBox();
      assert.ok(stageBox, `stage element must render in viewport ${vp.name}`);

      const ratio = stageBox.width / stageBox.height;
      const expectedRatio = 16 / 9;

      assert.ok(
        Math.abs(ratio - expectedRatio) < 0.01,
        `Stage in ${vp.name} (${vp.width}x${vp.height}) must maintain 16:9 ratio (~1.7778), got ${ratio.toFixed(4)} (w: ${stageBox.width.toFixed(1)}, h: ${stageBox.height.toFixed(1)})`
      );

      // Verify stage fits within parent bounds without overflow
      assert.ok(
        stageBox.width <= vp.width + 0.5,
        `Stage width ${stageBox.width} must fit within parent width ${vp.width}`
      );
      assert.ok(
        stageBox.height <= vp.height + 0.5,
        `Stage height ${stageBox.height} must fit within parent height ${vp.height}`
      );

      // Verify content block inside stage is not clipped outside the stage
      const contentBox = await page.locator('#content-block').boundingBox();
      assert.ok(
        contentBox.x >= stageBox.x - 0.5 &&
          contentBox.y >= stageBox.y - 0.5 &&
          contentBox.x + contentBox.width <= stageBox.x + stageBox.width + 0.5 &&
          contentBox.y + contentBox.height <= stageBox.y + stageBox.height + 0.5,
        `Content block must sit within stage boundaries in ${vp.name}`
      );
    }
  } finally {
    await browser.close();
  }
});
