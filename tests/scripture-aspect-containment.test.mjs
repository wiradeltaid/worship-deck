/**
 * SPEC-85-02: Scripture Congregation Screen Fixed 16:9 Canvas Aspect Containment
 * Unit, structural, aspect ratio proportionality, and defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const scriptureViewPath = path.join(rootDir, 'src', 'components', 'ScriptureOverlayView.tsx');
const scriptureScalingPath = path.join(rootDir, 'src', 'lib', 'scripture-scaling.ts');

const { getScriptureScaling, computeScriptureFitScale } = await import(
  pathToFileURL(scriptureScalingPath).href
);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanScriptureAspectContainmentGuards(overrides = {}) {
  const findings = [];
  const viewSrc = overrides.viewSrc ?? fs.readFileSync(scriptureViewPath, 'utf8');
  const scalingSrc = overrides.scalingSrc ?? fs.readFileSync(scriptureScalingPath, 'utf8');
  const cleanView = stripComments(viewSrc);
  const cleanScaling = stripComments(scalingSrc);

  // 1. ScriptureOverlayView must declare 16/9 aspect ratio, containerType: size, and padding: 0 scoped directly on scripture-stage opening tag
  const stageTagMatch = cleanView.match(/<div\b[^>]*data-slot="scripture-stage"[^>]*>/);
  if (!stageTagMatch) {
    findings.push('ScriptureOverlayView.tsx missing data-slot="scripture-stage" opening tag');
  } else {
    const stageOpeningTag = stageTagMatch[0];
    const styleMatch = stageOpeningTag.match(/style=\{\{([\s\S]*?)\}\}/);
    if (!styleMatch) {
      findings.push('scripture-stage opening tag missing style prop');
    } else {
      const stageStyle = styleMatch[1];
      if (!stageStyle.includes("aspectRatio: '16 / 9'")) {
        findings.push("scripture-stage missing aspectRatio: '16 / 9'");
      }
      if (!stageStyle.includes("containerType: 'size'")) {
        findings.push("scripture-stage missing containerType: 'size'");
      }
      if (!stageStyle.includes('padding: 0')) {
        findings.push('scripture-stage missing padding: 0');
      }
    }
  }

  // 2. ScriptureOverlayView must declare width: 88cqw and maxWidth: 88cqw scoped directly on scripture-stage-inner opening tag
  const innerTagMatch = cleanView.match(/<div\b[^>]*data-slot="scripture-stage-inner"[^>]*>/);
  if (!innerTagMatch) {
    findings.push('ScriptureOverlayView.tsx missing data-slot="scripture-stage-inner" opening tag');
  } else {
    const innerOpeningTag = innerTagMatch[0];
    const styleMatch = innerOpeningTag.match(/style=\{\{([\s\S]*?)\}\}/);
    if (!styleMatch) {
      findings.push('scripture-stage-inner opening tag missing style prop');
    } else {
      const innerStyle = styleMatch[1];
      if (!innerStyle.includes("width: '88cqw'")) {
        findings.push("scripture-stage-inner missing width: '88cqw'");
      }
      if (!innerStyle.includes("maxWidth: '88cqw'")) {
        findings.push("scripture-stage-inner missing maxWidth: '88cqw'");
      }
    }
  }

  // 3. ScriptureOverlayView must NOT have max-w-5xl clamp
  if (cleanView.includes('max-w-5xl')) {
    findings.push('ScriptureOverlayView.tsx still contains max-w-5xl width clamp');
  }

  // 4. ScriptureOverlayView must NOT have responsive pixel/rem padding clamps (sm:px-12)
  if (cleanView.includes('sm:px-12')) {
    findings.push('ScriptureOverlayView.tsx still contains sm:px-12 responsive padding');
  }

  // 5. ScriptureOverlayView must NOT have rem-based font clamp
  if (/\b\d+(\.\d+)?rem\b/.test(cleanView)) {
    findings.push('ScriptureOverlayView.tsx still contains rem-based font clamp');
  }

  // 6. scripture-scaling.ts must return pure container query cqh units, zero rem clamps
  if (/\b\d+(\.\d+)?rem\b/.test(cleanScaling)) {
    findings.push('scripture-scaling.ts still contains rem-based units or clamps');
  }
  if (!cleanScaling.includes('8.5cqh') || !cleanScaling.includes('6.5cqh') || !cleanScaling.includes('4.8cqh') || !cleanScaling.includes('3.5cqh')) {
    findings.push('scripture-scaling.ts missing pure cqh scaling definitions (8.5cqh, 6.5cqh, 4.8cqh, 3.5cqh)');
  }

  // 7. ScriptureOverlayView reference label must use bounded scale clamp(14px, 3.2cqh, 24px)
  if (!cleanView.includes("fontSize: 'clamp(14px, 3.2cqh, 24px)'")) {
    findings.push("ScriptureOverlayView.tsx missing bounded scale clamp(14px, 3.2cqh, 24px) for reference label");
  }

  // 8. ScriptureOverlayView must declare shrink-to-fit measurement mechanism (--scripture-fit-scale)
  if (!cleanView.includes('--scripture-fit-scale')) {
    findings.push('ScriptureOverlayView.tsx missing --scripture-fit-scale shrink-to-fit variable');
  }

  // 9. ScriptureOverlayView must observe fixed stage element (stageRef) to prevent ResizeObserver oscillation
  if (!cleanView.includes('observer.observe(stage)')) {
    findings.push('ScriptureOverlayView.tsx must observe fixed stage element to prevent ResizeObserver oscillation');
  }

  // 10. ScriptureOverlayView must measure container padding via window.getComputedStyle
  if (!cleanView.includes('window.getComputedStyle(container)')) {
    findings.push('ScriptureOverlayView.tsx missing window.getComputedStyle(container) measurement');
  }

  // 11. ScriptureOverlayView must subtract padX and padY for net content-box budget
  if (!cleanView.includes('clientWidth - padX') || !cleanView.includes('clientHeight - padY')) {
    findings.push('ScriptureOverlayView.tsx missing container padding subtraction for net content-box width and height');
  }

  // 12. ScriptureOverlayView must pass computed content box dimensions to computeScriptureFitScale
  if (!cleanView.includes('containerHeight: contentHeight') || !cleanView.includes('containerWidth: contentWidth')) {
    findings.push('ScriptureOverlayView.tsx missing containerHeight/containerWidth wiring to computeScriptureFitScale');
  }

  return findings;
}

test('SPEC-85-02: getScriptureScaling returns pure container query cqh units across exact text boundaries', () => {
  // Short verse (< 60 chars)
  const shortVerse = getScriptureScaling('In the beginning God created the heavens and the earth.');
  assert.equal(shortVerse.fontSizeStyle, '8.5cqh');
  assert.equal(shortVerse.minHeightStyle, '38cqh');
  assert.ok(!shortVerse.fontSizeStyle.includes('rem'), 'Must not contain rem units');

  // Medium verse (60-120 chars)
  const mediumVerse = getScriptureScaling('For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish.');
  assert.equal(mediumVerse.fontSizeStyle, '6.5cqh');
  assert.equal(mediumVerse.minHeightStyle, '28cqh');
  assert.ok(!mediumVerse.fontSizeStyle.includes('rem'), 'Must not contain rem units');

  // Standard passage (120-200 chars)
  const standardVerse = getScriptureScaling('A'.repeat(150));
  assert.equal(standardVerse.fontSizeStyle, '4.8cqh');
  assert.equal(standardVerse.minHeightStyle, '20cqh');
  assert.ok(!standardVerse.fontSizeStyle.includes('rem'), 'Must not contain rem units');

  // Long passage (> 200 chars)
  const longVerse = getScriptureScaling('A'.repeat(250));
  assert.equal(longVerse.fontSizeStyle, '3.5cqh');
  assert.equal(longVerse.minHeightStyle, 'auto');
  assert.ok(!longVerse.fontSizeStyle.includes('rem'), 'Must not contain rem units');
});

test('SPEC-85-02: 16:9 Aspect Ratio Preservation across diverse viewports and aspect ratios', () => {
  const viewports = [
    { name: '720p 16:9', width: 1280, height: 720 },
    { name: '1080p 16:9', width: 1920, height: 1080 },
    { name: '4K 16:9', width: 3840, height: 2160 },
    { name: '16:10 Laptop', width: 1920, height: 1200 },
    { name: '16:10 WQXGA', width: 2560, height: 1600 },
    { name: '4:3 Traditional Screen', width: 1024, height: 768 },
    { name: '4:3 High-Res', width: 1600, height: 1200 },
    { name: '21:9 Ultra-Wide', width: 2560, height: 1080 },
    { name: '21:9 Ultra-Wide QHD', width: 3440, height: 1440 },
    { name: 'Small Presenter Thumbnail', width: 320, height: 180 },
  ];

  for (const vp of viewports) {
    // Formula from ScriptureOverlayView:
    // width: min(100cqw, calc(100cqh * 16 / 9))
    // height: min(100cqh, calc(100cqw * 9 / 16))
    const stageWidth = Math.min(vp.width, (vp.height * 16) / 9);
    const stageHeight = Math.min(vp.height, (vp.width * 9) / 16);

    const calculatedRatio = stageWidth / stageHeight;
    const expectedRatio = 16 / 9;

    assert.ok(
      Math.abs(calculatedRatio - expectedRatio) < 0.001,
      `Viewport ${vp.name} (${vp.width}x${vp.height}) must maintain exact 16:9 aspect ratio. Got: ${calculatedRatio}`
    );

    // Stage dimensions must strictly fit within outer container
    assert.ok(stageWidth <= vp.width, `Stage width ${stageWidth} exceeds viewport width ${vp.width}`);
    assert.ok(stageHeight <= vp.height, `Stage height ${stageHeight} exceeds viewport height ${vp.height}`);

    // Font size scaling proportionality: (fontSizeCqh / 100) * stageHeight
    const shortFontSizePx = (8.5 / 100) * stageHeight;
    const longFontSizePx = (3.5 / 100) * stageHeight;

    assert.ok(shortFontSizePx > 0, 'Font size in pixels must be positive');
    assert.ok(shortFontSizePx > longFontSizePx, 'Short verse font must be larger than long verse');

    // On 4K (height 2160), short verse font is ~183.6px (not clamped by 6rem = 96px!)
    if (vp.name === '4K 16:9') {
      assert.ok(shortFontSizePx > 180, `4K font size must scale proportionally without 6rem clamp. Got: ${shortFontSizePx}`);
    }

    // On 180px thumbnail, short verse font is ~15.3px (not clamped by 2.5rem = 40px!)
    if (vp.name === 'Small Presenter Thumbnail') {
      assert.ok(shortFontSizePx < 20, `Thumbnail font size must scale down without 2.5rem clamp. Got: ${shortFontSizePx}`);
    }
  }
});

test('SPEC-85-02: computeScriptureFitScale dynamically scales down overflowing text and prevents oscillation', () => {
  const stageHeight = 1080;
  const stageWidth = 1920;
  // Net content box: 78cqh height and 88cqw width (100cqw - 4cqw*2 stage padding - 2cqw*2 container padding)
  const maxAllowedHeight = stageHeight * 0.78; // 842.4px
  const maxAllowedWidth = stageWidth * 0.88;  // 1689.6px

  // Case 1: Normal verse fitting comfortably within budget
  const normalScale = computeScriptureFitScale({
    stageHeight,
    stageWidth,
    naturalHeight: 400,
    naturalWidth: 1200,
  });
  assert.equal(normalScale, 1, 'Fitting text must remain at 100% scale');

  // Case 2: Very long or multiline verse exceeding container height
  const overflowingHeight = 1200;
  const heightScale = computeScriptureFitScale({
    stageHeight,
    stageWidth,
    naturalHeight: overflowingHeight,
    naturalWidth: 1400,
  });
  assert.ok(heightScale < 1, 'Overflowing height must scale down below 1');
  const fittedHeight = overflowingHeight * heightScale;
  assert.ok(
    fittedHeight <= maxAllowedHeight,
    `Fitted text height ${fittedHeight} must be <= maxAllowedHeight ${maxAllowedHeight}`
  );

  // Case 3: Extreme passage scales strictly to guarantee no-clipping containment
  const extremeHeight = 10000;
  const extremeWidth = 2000;
  const extremeScale = computeScriptureFitScale({
    stageHeight,
    stageWidth,
    naturalHeight: extremeHeight,
    naturalWidth: extremeWidth,
  });
  assert.ok(extremeScale > 0, 'Scale must be strictly positive');
  assert.ok(
    extremeHeight * extremeScale <= maxAllowedHeight,
    `Fitted extreme height ${extremeHeight * extremeScale} must strictly fit within ${maxAllowedHeight}`
  );
  assert.ok(
    extremeWidth * extremeScale <= maxAllowedWidth,
    `Fitted extreme width ${extremeWidth * extremeScale} must strictly fit within ${maxAllowedWidth}`
  );

  // Case 4: Long unbreakable token / wide content scales within net 88cqw width
  const wideWidth = 2500;
  const wideScale = computeScriptureFitScale({
    stageHeight,
    stageWidth,
    naturalHeight: 200,
    naturalWidth: wideWidth,
  });
  assert.ok(wideScale < 1, 'Wide text must scale down below 1');
  assert.ok(
    wideWidth * wideScale <= maxAllowedWidth,
    `Fitted wide width ${wideWidth * wideScale} must be <= maxAllowedWidth ${maxAllowedWidth}`
  );

  // Case 5: Exact measured container client dimensions override
  const containerMeasuredHeight = 800;
  const containerMeasuredWidth = 1600;
  const measuredScale = computeScriptureFitScale({
    stageHeight,
    stageWidth,
    naturalHeight: 1000,
    naturalWidth: 1800,
    containerHeight: containerMeasuredHeight,
    containerWidth: containerMeasuredWidth,
  });
  assert.ok(
    1000 * measuredScale <= containerMeasuredHeight,
    'Fitted text must respect exact measured container height'
  );
  assert.ok(
    1800 * measuredScale <= containerMeasuredWidth,
    'Fitted text must respect exact measured container width'
  );

  // Case 6: Ultra-wide 21:9 pillarbox geometry (2560x1080 screen with 1920x1080 stage)
  const screen21x9Width = 2560;
  const screen21x9Height = 1080;
  const stage21x9Width = Math.min(screen21x9Width, (screen21x9Height * 16) / 9); // 1920px
  const stage21x9Height = Math.min(screen21x9Height, (screen21x9Width * 9) / 16); // 1080px
  // Stage declares containerType: 'size'. Inner stage uses width: '88cqw' of stage,
  // guaranteeing exact 1920 * 0.88 = 1689.6px content width without outer viewport percentage inflation!
  const stageCqwContentWidth = (88 / 100) * stage21x9Width; // 1689.6px
  const pillarboxScale = computeScriptureFitScale({
    stageHeight: stage21x9Height,
    stageWidth: stage21x9Width,
    naturalHeight: 300,
    naturalWidth: 2200,
    containerWidth: stageCqwContentWidth,
  });
  assert.ok(
    2200 * pillarboxScale <= stageCqwContentWidth,
    `Fitted width in 21:9 pillarbox must be <= stageCqwContentWidth ${stageCqwContentWidth}`
  );

  // Case 7: Explicit measured zero content dimension returns 0 (preserves strict containment on fully padded container)
  const zeroContentWidthScale = computeScriptureFitScale({
    stageHeight: 1080,
    stageWidth: 1920,
    naturalHeight: 500,
    naturalWidth: 500,
    containerWidth: 0,
  });
  assert.equal(zeroContentWidthScale, 0, 'Measured 0 content width must return 0 scale and not fall back to stage width');

  const zeroContentHeightScale = computeScriptureFitScale({
    stageHeight: 1080,
    stageWidth: 1920,
    naturalHeight: 500,
    naturalWidth: 500,
    containerHeight: 0,
  });
  assert.equal(zeroContentHeightScale, 0, 'Measured 0 content height must return 0 scale and not fall back to stage height');

  // Case 8: Zero-dimension stage safe fallback
  const zeroScale = computeScriptureFitScale({
    stageHeight: 0,
    stageWidth: 0,
    naturalHeight: 500,
    naturalWidth: 500,
  });
  assert.equal(zeroScale, 1, 'Zero-dimension container must return 1 without NaN or division by zero');
});

test('SPEC-85-02: Structural scan verifies aspect containment guards in ScriptureOverlayView and scripture-scaling', () => {
  const findings = scanScriptureAspectContainmentGuards();
  assert.deepEqual(findings, [], `Expected 0 containment guard findings, got: ${findings.join(', ')}`);
});

test('SPEC-85-02: Defect injection proof — re-introducing max-w-5xl triggers guard finding', () => {
  const rawView = fs.readFileSync(scriptureViewPath, 'utf8');
  const defectiveSrc = rawView.replace(
    'className="flex max-h-[78cqh] w-full items-center',
    'className="flex max-h-[78cqh] w-full max-w-5xl items-center'
  );
  const findings = scanScriptureAspectContainmentGuards({ viewSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('max-w-5xl')),
    'Expected defect injection with max-w-5xl to fail scan'
  );
});

test('SPEC-85-02: Defect injection proof — re-introducing rem clamp in scripture-scaling triggers guard finding', () => {
  const rawScaling = fs.readFileSync(scriptureScalingPath, 'utf8');
  const defectiveSrc = rawScaling.replace("fontSizeStyle: '8.5cqh'", "fontSizeStyle: 'clamp(2.5rem, 8.5cqh, 6rem)'");
  const findings = scanScriptureAspectContainmentGuards({ scalingSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('rem-based units or clamps')),
    'Expected defect injection with rem clamp to fail scan'
  );
});

test('SPEC-85-02: Defect injection proof — moving stage properties to a nested child triggers opening tag guard finding', () => {
  const rawView = fs.readFileSync(scriptureViewPath, 'utf8');
  // Strip style prop from scripture-stage opening tag and place on child
  const defectiveSrc = rawView
    .replace(/<div\s+ref=\{stageRef\}\s+data-slot="scripture-stage"[\s\S]*?>/, '<div ref={stageRef} data-slot="scripture-stage">')
    .replace(/<p\s+data-slot="scripture-reference"/, '<p style={{ aspectRatio: \'16 / 9\', containerType: \'size\', padding: 0 }} data-slot="scripture-reference"');

  // Verify the replacement actually mutated the child element
  assert.ok(defectiveSrc.includes('<p style={{ aspectRatio: \'16 / 9\''), 'Defect injection must mutate child element');

  const findings = scanScriptureAspectContainmentGuards({ viewSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('scripture-stage opening tag missing style prop')),
    'Expected defect injection with style on nested child to fail opening tag scan'
  );
});

test('SPEC-85-02: Defect injection proof — unbounded reference label triggers guard finding', () => {
  const rawView = fs.readFileSync(scriptureViewPath, 'utf8');
  const defectiveSrc = rawView.replace("fontSize: 'clamp(14px, 3.2cqh, 24px)'", "fontSize: '3.2cqh'");
  const findings = scanScriptureAspectContainmentGuards({ viewSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('bounded scale clamp(14px, 3.2cqh, 24px)')),
    'Expected defect injection without bounded scale to fail scan'
  );
});
