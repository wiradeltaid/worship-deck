import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';
import {
  resolveFallbackLongestTokenWidthPx,
  resolveFallbackTextLayout,
  partitionParagraphTokens,
  measureTokenWidthPx,
  measureSpaceWidthPx,
  resolveTextRunsForPptx,
  resolveElementTextForPptx,
  estimateTextFitScale,
  resolveWrapLineCount,
  resolvePptxVerticalAlign,
  validateWrapLines,
  splitCollapsibleWords,
  resolveTextFitScale,
  MIN_TEXT_FIT_SCALE,
  REFERENCE_CANVAS,
} from '../src/lib/artifacts/render-model.ts';
import { generatePptxFromPlan } from '../src/lib/pptx-draw.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function createReproElement(overrides = {}) {
  return {
    id: 'spec-30-repro-el',
    type: 'text',
    x: 0,
    y: 0,
    w: 102.154541015625,
    h: 100,
    zIndex: 0,
    text: 'Bandung international community',
    style: {
      fontSize: 180,
      fontFamily: 'Arial',
      lineHeight: 0.8,
      verticalAlign: 'middle',
      textAlign: 'center',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SPEC-30-01: Shared Deterministic Fallback Measurement & Line Partitioner
// ---------------------------------------------------------------------------

test('T-30-01: Shared deterministic token measurement and fallback longest-token width', () => {
  // 1. Non-empty element has finite, positive fallback width (never 0)
  const repro = createReproElement();
  const fallbackWidth = resolveFallbackLongestTokenWidthPx(repro);
  assert.ok(
    Number.isFinite(fallbackWidth) && fallbackWidth > 0,
    `Fallback longest-token width must be finite positive, got ${fallbackWidth}`
  );

  // 'international' is 13 chars with narrow glyphs (i, t, l, r). Proportional advance: 5.60em * 180 = 1008px.
  assert.equal(fallbackWidth, 1008, 'Longest word "international" measures 1008px at 180px font');

  // 2. Comfortable fixture stays at scale 1, while 180px repro computes scale < 1
  const reproScale = estimateTextFitScale(repro);
  assert.ok(
    reproScale < 1.0,
    `180px reproduction must scale down to fit width, got scale ${reproScale}`
  );
  assert.equal(reproScale, 0.97, 'Width ratio 980.68 / 1008 quantizes to scale 0.97');

  // Comfortable fixture: 50% width box at 32px font
  const comfortable = createReproElement({
    w: 80,
    h: 50,
    text: 'Comfortable Word Fit',
    style: { fontSize: 32, lineHeight: 1.2 },
  });
  const comfortableScale = estimateTextFitScale(comfortable);
  assert.equal(
    comfortableScale,
    1,
    `Comfortable fixture must stay at scale 1, got ${comfortableScale}`
  );

  // 3. Stored measurement is preferred when valid
  const measuredEl = createReproElement({
    longestWordPx: 600,
    measuredWith: {
      fontFamily: 'Arial',
      fontSize: 180,
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
  });
  assert.equal(
    resolveFallbackLongestTokenWidthPx(measuredEl),
    600,
    'Valid stored longestWordPx must be preferred over headless calculation'
  );

  // 4. Stale/mismatched measurement selects fallback
  const staleEl = createReproElement({
    longestWordPx: 600,
    measuredWith: {
      fontFamily: 'Arial',
      fontSize: 100, // mismatch from 180!
      fontWeight: 'normal',
      fontStyle: 'normal',
    },
  });
  assert.equal(
    resolveFallbackLongestTokenWidthPx(staleEl),
    1008,
    'Mismatched measurement must select deterministic fallback calculation'
  );

  // 5. Empty/blank element handling
  assert.equal(resolveFallbackLongestTokenWidthPx(createReproElement({ text: '' })), 0);
  assert.equal(measureTokenWidthPx('', 32), 0);
});

// ---------------------------------------------------------------------------
// SPEC-30-02: Fallback Whole-Token PPTX Run Partitioning & Convergence
// ---------------------------------------------------------------------------

test('T-30-02: Fallback whole-token PPTX runs and soft-break emission for reproduction fixture', async () => {
  const repro = createReproElement();

  // 1. resolveTextRunsForPptx returns three complete-token runs with softBreakBefore
  const runs = resolveTextRunsForPptx(repro);
  assert.ok(Array.isArray(runs), 'Must return PptxTextRun array for wrapped fallback');
  assert.equal(runs.length, 3, 'Must partition into exactly 3 lines');

  assert.deepEqual(runs, [
    { text: 'Bandung', options: {} },
    { text: 'international', options: { softBreakBefore: true } },
    { text: 'community', options: { softBreakBefore: true } },
  ]);

  // Ensure no character-fragment substrings
  for (const r of runs) {
    assert.ok(!r.text.includes('internationa') || r.text === 'international', 'No character split in international');
    assert.ok(!r.text.startsWith('l '), 'No orphan leading letter fragment');
  }

  // 2. resolveElementTextForPptx returns joined complete lines
  const joinedText = resolveElementTextForPptx(repro);
  assert.equal(joinedText, 'Bandung\ninternational\ncommunity');

  // 3. End-to-end generatePptxFromPlan OOXML verification
  const planItem = {
    artifact: {
      runtimeVersion: 1,
      instanceId: 'inst-30',
      templateId: 'custom-08bbe5aa',
      label: 'Repro Slide',
      baseType: 'general',
      layoutKey: 'default',
      layout: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [repro],
      },
    },
  };

  const buffer = await generatePptxFromPlan('2026-09-14', [planItem], 'none');
  const zip = await JSZip.loadAsync(buffer);
  const slide1Xml = await zip.file('ppt/slides/slide1.xml')?.async('string');
  assert.ok(slide1Xml, 'ppt/slides/slide1.xml must exist');

  // Must contain one <a:p> with two <a:br/> elements
  const brCount = (slide1Xml.match(/<a:br\b[^>]*\/>/g) || []).length;
  assert.equal(brCount, 2, `slide1.xml must contain exactly 2 <a:br/> soft breaks, found ${brCount}`);

  // Must contain complete tokens in text runs
  assert.ok(slide1Xml.includes('<a:t>Bandung</a:t>'), 'Contains complete word "Bandung"');
  assert.ok(slide1Xml.includes('<a:t>international</a:t>'), 'Contains complete word "international"');
  assert.ok(slide1Xml.includes('<a:t>community</a:t>'), 'Contains complete word "community"');

  // Must not contain character-split fragments
  assert.ok(!slide1Xml.includes('<a:t>internationa</a:t>'), 'No fragmented "internationa"');
  assert.ok(!slide1Xml.includes('<a:t>l community</a:t>'), 'No fragmented "l community"');
});

// ---------------------------------------------------------------------------
// SPEC-30-03: Structural Boundaries, Whitespace, Punctuation & Non-Breaking Spaces
// ---------------------------------------------------------------------------

test('T-30-03: Explicit newlines, blank paragraphs, whitespace & non-breaking space preservation', () => {
  // 1. Explicit paragraphs with blank paragraph preservation: 'one\n\ntwo'
  const multilineEl = createReproElement({
    w: 50,
    h: 50,
    text: 'one\n\ntwo',
    style: { fontSize: 32 },
  });

  const runs = resolveTextRunsForPptx(multilineEl);
  assert.ok(Array.isArray(runs), 'Must return runs array');
  assert.equal(runs.length, 3, 'Must emit 3 runs for one\\n\\ntwo');
  assert.deepEqual(runs, [
    { text: 'one', options: { breakLine: true } },
    { text: '', options: { breakLine: true } },
    { text: 'two', options: {} },
  ]);

  // 2. Normalization of repeated ordinary whitespace
  const spacesEl = createReproElement({
    w: 80,
    h: 40,
    text: 'Word1    Word2\t\tWord3',
    style: { fontSize: 32 },
  });
  const spacesLayout = resolveFallbackTextLayout(spacesEl);
  assert.equal(spacesLayout.lines[0], 'Word1 Word2 Word3', 'Ordinary whitespace collapses to single space');

  // 3. Attached punctuation remains intact
  const punctEl = createReproElement({
    w: 80,
    h: 40,
    text: 'Hello, world! (Ready?)',
    style: { fontSize: 32 },
  });
  const punctLayout = resolveFallbackTextLayout(punctEl);
  assert.equal(punctLayout.lines[0], 'Hello, world! (Ready?)');

  // 4. Non-breaking space ( ) is an unbreakable boundary across fallback and validateWrapLines
  const nbspText = 'John Doe and Jane Doe';
  const splitWords = splitCollapsibleWords(nbspText);
  assert.deepEqual(splitWords, ['John Doe', 'and', 'Jane Doe'], 'NBSP preserved as intra-token character');

  // Snapshot splitting NBSP into two words is rejected
  assert.equal(
    validateWrapLines(nbspText, ['John', 'Doe and Jane Doe']),
    null,
    'validateWrapLines must reject candidate line that splits NBSP into separate words'
  );

  // Intact snapshot preserving NBSP is accepted
  const validNbspLines = validateWrapLines(nbspText, ['John Doe', 'and Jane Doe']);
  assert.deepEqual(validNbspLines, ['John Doe', 'and Jane Doe'], 'Intact NBSP snapshot is preserved');

  const nbspEl = createReproElement({
    w: 30, // narrow box forcing wrap
    h: 40,
    text: nbspText,
    style: { fontSize: 32 },
  });
  const nbspLayout = resolveFallbackTextLayout(nbspEl);
  for (const line of nbspLayout.lines) {
    if (line.includes('John')) {
      assert.ok(line.includes('John Doe'), 'John and Doe remain unbroken across nbsp in fallback');
    }
  }
});

// ---------------------------------------------------------------------------
// SPEC-30-04: Scale Floor Bounding & Token Indivisibility
// ---------------------------------------------------------------------------

test('T-30-04: Long unbroken token clamping to MIN_TEXT_FIT_SCALE and top-anchoring', () => {
  // 100-character unbroken string that cannot fit even at scale floor
  const giantWord = 'A'.repeat(100);
  const overflowEl = createReproElement({
    w: 20,
    h: 15,
    text: giantWord,
    style: { fontSize: 100 },
  });

  const scale = estimateTextFitScale(overflowEl);
  assert.equal(
    scale,
    MIN_TEXT_FIT_SCALE,
    `Scale must clamp strictly to MIN_TEXT_FIT_SCALE (${MIN_TEXT_FIT_SCALE}), got ${scale}`
  );

  // Indivisibility: must remain 1 line and 1 run, never character-split
  const layout = resolveFallbackTextLayout(overflowEl);
  assert.equal(layout.lineCount, 1, 'Unbroken token remains single line');
  assert.equal(layout.lines[0], giantWord, 'Word content preserved verbatim without character splitting');

  // Top-anchored vertical alignment when residual overflow occurs
  const vAlign = resolvePptxVerticalAlign(overflowEl);
  assert.equal(vAlign, 'top', 'Must top-anchor when scale hits floor and content exceeds box height');
  assert.equal(layout.verticalAlign, 'top', 'Fallback layout verticalAlign must also top-anchor');
});

// ---------------------------------------------------------------------------
// SPEC-30-05: Real Microsoft PowerPoint Desktop COM Automated Open & Slide Export
// ---------------------------------------------------------------------------

test('T-30-05: Real Microsoft PowerPoint COM Automated Open & Slide Export Verification (Windows Host)', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('Microsoft PowerPoint COM automation is only available on Windows host');
    return;
  }

  let comAvailable = false;
  try {
    const checkScript = `
      try {
        $p = New-Object -ComObject PowerPoint.Application
        $p.Quit()
        Write-Output "AVAILABLE"
      } catch {
        Write-Output "UNAVAILABLE"
      }
    `;
    const res = execFileSync('powershell', ['-NoProfile', '-Command', checkScript], {
      encoding: 'utf8',
      timeout: 10000,
    });
    comAvailable = res.includes('AVAILABLE');
  } catch {
    comAvailable = false;
  }

  if (!comAvailable) {
    t.skip('Microsoft PowerPoint application is not installed on this host');
    return;
  }

  const workDir = path.join(root, '.work', 'test-spec-30-com');
  fs.mkdirSync(workDir, { recursive: true });

  const tempPptx = path.join(workDir, `repro-${Date.now()}.pptx`);
  const tempPng = path.join(workDir, `repro-${Date.now()}.png`);

  try {
    // Test with real template parameters: y = -4.32% top-anchored, 180px, lineHeight 0.8
    const repro = createReproElement({
      y: -4.32321632191445,
      style: {
        fontSize: 180,
        fontFamily: 'Arial',
        lineHeight: 0.8,
        verticalAlign: 'top',
        textAlign: 'left',
        fontColor: '#FFFFFF',
      },
    });
    const planItem = {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'inst-30-com',
        templateId: 'custom-08bbe5aa',
        label: 'COM Repro Slide',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#0F172A',
          elements: [repro],
        },
      },
    };

    const buffer = await generatePptxFromPlan('2026-09-14', [planItem], 'none');
    fs.writeFileSync(tempPptx, buffer);

    const comScript = `
      $ppt = New-Object -ComObject PowerPoint.Application
      try {
        $pres = $ppt.Presentations.Open("${tempPptx.replace(/\\/g, '\\\\')}", [Microsoft.Office.Core.MsoTriState]::msoTrue, [Microsoft.Office.Core.MsoTriState]::msoFalse, [Microsoft.Office.Core.MsoTriState]::msoFalse)
        $slide = $pres.Slides.Item(1)
        $slide.Export("${tempPng.replace(/\\/g, '\\\\')}", "PNG", 1920, 1080)

        $shape = $slide.Shapes.Item(1)
        $range = $shape.TextFrame.TextRange
        $lines = $range.Lines()
        $lineCount = $lines.Count
        $boundTop = $range.BoundTop
        $boundHeight = $range.BoundHeight
        $slideHeight = 405
        $coverage = $boundHeight / $slideHeight

        $pres.Close()
        Write-Output ("SUCCESS:LINES=" + $lineCount + ":BOUND_TOP=" + $boundTop + ":COVERAGE=" + $coverage)
      } finally {
        $ppt.Quit()
      }
    `;

    const comRes = execFileSync('powershell', ['-NoProfile', '-Command', comScript], {
      encoding: 'utf8',
      timeout: 30000,
    });

    assert.ok(comRes.includes('SUCCESS'), 'PowerPoint COM export must succeed without crash or repair prompt');

    // Substantive visual conformance assertions:
    const match = comRes.match(/SUCCESS:LINES=(\d+):BOUND_TOP=([-\d.]+):COVERAGE=([-\d.]+)/);
    assert.ok(match, `Must extract COM conformance metrics from output: ${comRes}`);
    const actualLines = parseInt(match[1], 10);
    const actualBoundTop = parseFloat(match[2]);
    const actualCoverage = parseFloat(match[3]);

    assert.equal(actualLines, 3, `Must render exactly 3 complete-word lines in PowerPoint, got ${actualLines}`);
    // With negative half-leading compensation for tight line-height (0.8),
    // top-anchored bleeding text is offset by topShiftInches = ((1.0 - 0.8)/2 * 130.95) / 72 = +13.10 pt,
    // so -17.51 pt + 13.10 pt lands the top glyph ascender exactly at the slide top edge (-4.41 pt).
    const topCompPt = ((1.0 - 0.8) / 2) * 130.95;
    const expectedTopPt = (repro.y / 100) * 405 + topCompPt;
    assert.ok(
      Math.abs(actualBoundTop - expectedTopPt) < 1.0,
      `Top-anchored text must preserve compensated leading position (${expectedTopPt.toFixed(2)} pt), got ${actualBoundTop}`
    );
    assert.ok(actualCoverage >= 0.70, `Text must cover at least 70% of slide height without large empty space, got ${(actualCoverage * 100).toFixed(1)}%`);

    assert.ok(fs.existsSync(tempPng), 'Rendered PNG must exist');
    const pngSize = fs.statSync(tempPng).size;
    assert.ok(pngSize > 10000, `Rendered slide image must have valid content (size: ${pngSize} bytes)`);
  } finally {
    if (fs.existsSync(tempPptx)) fs.unlinkSync(tempPptx);
    if (fs.existsSync(tempPng)) fs.unlinkSync(tempPng);
  }
});

// ---------------------------------------------------------------------------
// SPEC-30-06: Executable Absence-Guards and Defect Detection Proofs
// ---------------------------------------------------------------------------

test('T-30-06: Executable Absence Guard Proofs for SPEC-30 invariants', async () => {
  const repro = createReproElement();

  // Defect Proof 1: Zero-width fallback defect injection
  // If fallback width is defectively forced to 0, resolveTextFitScale returns 1.0 (blind to width)
  const defectiveZeroWidthScale = resolveTextFitScale({
    contentWidth: 0, // Injected defect!
    contentHeight: 144,
    boxWidth: 980.68,
    boxHeight: 540,
    fontSizePx: 180,
  });
  assert.equal(
    defectiveZeroWidthScale,
    1.0,
    'Injected zero-width defect must produce scale 1.0 (blind to width)'
  );

  // Production path with resolveFallbackLongestTokenWidthPx prevents this defect:
  const productionWidth = resolveFallbackLongestTokenWidthPx(repro);
  assert.equal(productionWidth, 1008, 'Production path derives real positive width');
  const productionScale = resolveTextFitScale({
    contentWidth: productionWidth,
    contentHeight: 144,
    boxWidth: 980.68,
    boxHeight: 540,
    fontSizePx: 180,
  });
  assert.equal(productionScale, 0.97, 'Production width properly triggers scale down to 0.97');

  // Defect Proof 2: Missing fallback partitioning defect proof
  // An unpartitioned single string in DrawingML produces 0 <a:br/> soft breaks, leaving
  // PowerPoint to perform character-level splits on overlong words.
  const rawSingleParagraphBuffer = await generatePptxFromPlan(
    '2026-09-14',
    [
      {
        artifact: {
          runtimeVersion: 1,
          instanceId: 'inst-raw',
          templateId: 'tpl-raw',
          label: 'Raw Slide',
          baseType: 'general',
          layoutKey: 'default',
          layout: {
            aspectRatio: '16:9',
            backgroundColor: '#000000',
            elements: [
              {
                id: 'raw-el',
                type: 'text',
                x: 0,
                y: 0,
                w: 100,
                h: 100,
                text: 'UnpartitionedSingleLineText',
                style: { fontSize: 32 },
              },
            ],
          },
        },
      },
    ],
    'none'
  );
  const rawZip = await JSZip.loadAsync(rawSingleParagraphBuffer);
  const rawXml = await rawZip.file('ppt/slides/slide1.xml')?.async('string');
  assert.ok(!rawXml?.includes('<a:br'), 'Unpartitioned text produces 0 <a:br/> soft breaks');

  // In contrast, production reproduction export MUST contain exactly 2 <a:br/> soft breaks:
  const prodBuffer = await generatePptxFromPlan('2026-09-14', [
    {
      artifact: {
        runtimeVersion: 1,
        instanceId: 'inst-prod',
        templateId: 'tpl-prod',
        label: 'Prod Slide',
        baseType: 'general',
        layoutKey: 'default',
        layout: {
          aspectRatio: '16:9',
          backgroundColor: '#000000',
          elements: [repro],
        },
      },
    },
  ], 'none');
  const prodZip = await JSZip.loadAsync(prodBuffer);
  const prodXml = await prodZip.file('ppt/slides/slide1.xml')?.async('string');
  const prodBrCount = (prodXml?.match(/<a:br\b[^>]*\/>/g) || []).length;
  assert.equal(prodBrCount, 2, 'Production fallback partitioning emits exactly 2 <a:br/> soft breaks');

  // Defect Proof 3: Intra-token character-level split injection
  assert.equal(
    validateWrapLines('international', ['internationa', 'l']),
    null,
    'Injected intra-token split must be rejected by validateWrapLines'
  );

  // Malformed wrapLines fixture falling back to clean whole-token runs
  const malformedEl = createReproElement({
    wrapLines: ['Band', 'ung international community'], // Malformed split!
  });
  const malformedRuns = resolveTextRunsForPptx(malformedEl);
  assert.ok(Array.isArray(malformedRuns), 'Malformed wrapLines must fall back to whole-token partition');
  assert.equal(malformedRuns.length, 3, 'Falls back to clean 3-line partition');
  assert.deepEqual(
    malformedRuns.map((r) => r.text),
    ['Bandung', 'international', 'community'],
    'Must not emit fragmented words when wrapLines is malformed'
  );

  // Trusted snapshot fixture verification
  const trustedEl = createReproElement({
    wrapLines: ['Bandung', 'international community'],
  });
  const trustedRuns = resolveTextRunsForPptx(trustedEl);
  assert.equal(trustedRuns.length, 2, 'Trusted snapshot takes authoritative wrapLines path');

  // Placeholder-substituted fallback text verification
  const placeholderEl = createReproElement({
    placeholderKey: 'sermon_title',
    text: 'Walking in Faith and Truth Today',
  });
  const phWidth = resolveFallbackLongestTokenWidthPx(placeholderEl);
  assert.ok(phWidth > 0, 'Placeholder substituted text derives positive finite width');
  const phRuns = resolveTextRunsForPptx(placeholderEl);
  assert.ok(Array.isArray(phRuns) || typeof phRuns === 'string', 'Placeholder substituted text resolves runs cleanly');
});
