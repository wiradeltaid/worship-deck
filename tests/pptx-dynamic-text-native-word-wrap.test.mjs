/**
 * SPEC-83-01: PPTX Dynamic Text Native Word Wrap and Break Parity
 *
 * Verifies:
 * 1. Dynamic unmeasured text with wordWrap: true emits wrap="square" on <a:bodyPr> and ZERO <a:br/> tags.
 * 2. Dynamic unmeasured text with wordWrap: false emits wrap="none" on <a:bodyPr> and ZERO <a:br/> tags.
 * 3. Explicit \n and CRLF (\r\n) create distinct <a:p> elements without synthetic <a:br/> soft breaks.
 * 4. Static slide with authoritative wrapLines preserves authored <a:br/> soft breaks.
 * 5. Deterministic vertical height scaling (scale) and authored verticalAlign are applied for dynamic text.
 * 6. Real-file defect injection proofs asserting that injecting softBreakBefore on dynamic text fails the guard.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const { default: JSZip } = await import(
  pathToFileURL(path.join(ROOT, 'node_modules', 'jszip', 'lib', 'index.js')).href
);
const { generatePptxFromPlan } = await import(
  pathToFileURL(path.join(ROOT, 'src', 'lib', 'pptx-draw.ts')).href
);
const {
  resolveExplicitParagraphRunsForPptx,
} = await import(
  pathToFileURL(path.join(ROOT, 'src', 'lib', 'artifacts', 'render-model.ts')).href
);

const PPTX_DRAW_PATH = path.join(ROOT, 'src', 'lib', 'pptx-draw.ts');

function readPptxDrawSource() {
  return fs.readFileSync(PPTX_DRAW_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const HEBREWS_TEXT =
  'God, who at various times and in various ways spoke in time past to the fathers by the prophets, has in these last days spoken to us by His Son, whom He has appointed heir of all things, through whom also He made the worlds';

function makeDynamicScripturePlan(text = HEBREWS_TEXT) {
  return [
    {
      id: 'slide-scripture',
      kind: 'scripture',
      artifact: {
        runtimeVersion: 1,
        schemaVersion: 1,
        id: 'art-scripture',
        kind: 'scripture',
        layout: {
          backgroundColor: '#000000',
          elements: [
            {
              id: 'el-scripture-body',
              type: 'text',
              placeholderKey: 'scripture_text',
              text: text,
              // Intentionally NO wrapLines (dynamic unmeasured text)
              x: 4.83,
              y: 20,
              w: 90.34,
              h: 60,
              style: {
                fontSize: 45,
                fontColor: '#FFFFFF',
                fontFamily: 'Montserrat',
                fontWeight: 'bold',
                lineHeight: 1.2,
                verticalAlign: 'middle',
              },
            },
          ],
        },
      },
    },
  ];
}

function makeStaticPartitionedPlan() {
  return [
    {
      id: 'slide-static',
      kind: 'announcement',
      artifact: {
        runtimeVersion: 1,
        schemaVersion: 1,
        id: 'art-static',
        kind: 'announcement',
        layout: {
          backgroundColor: '#000000',
          elements: [
            {
              id: 'el-static-title',
              type: 'text',
              text: 'Announcements Title',
              wrapLines: ['Announcements', 'Title'],
              x: 10,
              y: 10,
              w: 80,
              h: 20,
              style: {
                fontSize: 36,
                fontColor: '#FFFFFF',
                fontFamily: 'Arial',
                lineHeight: 1.2,
              },
            },
          ],
        },
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// 1. Behavioral Tests
// ---------------------------------------------------------------------------

test('SPEC-83-01: Dynamic unmeasured text with wordWrap: true emits wrap="square" and ZERO <a:br/> breaks', async () => {
  const plan = makeDynamicScripturePlan();
  const buffer = await generatePptxFromPlan('2026-09-26', plan, 'none', undefined, { wordWrap: true });
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');

  // Verify DrawingML bodyPr has wrap="square", authored verticalAlign="middle" (anchor="ctr"), and normAutofit fontScale="100000"
  assert.match(
    slideXml,
    /<a:bodyPr\b[^>]*?wrap="square"/,
    'DrawingML text box must have wrap="square" when wordWrap is enabled'
  );
  assert.match(
    slideXml,
    /<a:bodyPr\b[^>]*?anchor="ctr"/,
    'DrawingML text box must preserve authored verticalAlign="middle" via anchor="ctr"'
  );
  assert.match(
    slideXml,
    /<a:normAutofit\s+fontScale="100000"\/>/,
    'DrawingML text box must lock normAutofit fontScale="100000" under SPEC-23-04'
  );

  // Verify dynamic unmeasured text frame contains ZERO <a:br/> breaks
  const brCount = (slideXml.match(/<a:br[\s/>]/g) || []).length;
  assert.equal(
    brCount,
    0,
    `Dynamic unmeasured text must have 0 <a:br/> breaks in DrawingML, found ${brCount}`
  );
});

test('SPEC-83-01: Dynamic unmeasured text with wordWrap: false emits wrap="none" and ZERO <a:br/> breaks', async () => {
  const plan = makeDynamicScripturePlan();
  const buffer = await generatePptxFromPlan('2026-09-26', plan, 'none', undefined, { wordWrap: false });
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');

  // Verify DrawingML bodyPr has wrap="none"
  assert.match(
    slideXml,
    /<a:bodyPr\b[^>]*?wrap="none"/,
    'DrawingML text box must have wrap="none" when wordWrap is disabled'
  );

  // Verify dynamic unmeasured text frame contains ZERO <a:br/> breaks
  const brCount = (slideXml.match(/<a:br[\s/>]/g) || []).length;
  assert.equal(
    brCount,
    0,
    `Dynamic unmeasured text with wrap=false must have 0 <a:br/> breaks, found ${brCount}`
  );
});

test('SPEC-83-01: Explicit \n and CRLF split into distinct <a:p> paragraphs without <a:br/>', async () => {
  const multilineText = 'First Paragraph\r\nSecond Paragraph\nThird Paragraph';
  const plan = makeDynamicScripturePlan(multilineText);
  const buffer = await generatePptxFromPlan('2026-09-26', plan, 'none', undefined, { wordWrap: true });
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');

  // Verify 3 distinct <a:p> paragraph elements
  const pCount = (slideXml.match(/<a:p[\s>]/g) || []).length;
  assert.equal(pCount, 3, `Expected 3 <a:p> paragraphs for 3 explicit lines, found ${pCount}`);

  // Zero <a:br/> breaks
  const brCount = (slideXml.match(/<a:br[\s/>]/g) || []).length;
  assert.equal(brCount, 0, `Expected 0 <a:br/> breaks, found ${brCount}`);
});

test('SPEC-83-01: Static slides with authoritative wrapLines preserve authored <a:br/> breaks', async () => {
  const plan = makeStaticPartitionedPlan();
  const buffer = await generatePptxFromPlan('2026-09-26', plan, 'none', undefined, { wordWrap: true });
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');

  // Authoritative wrapLines has 2 lines in 1 paragraph -> exactly 1 <a:br/> break
  const brCount = (slideXml.match(/<a:br[\s/>]/g) || []).length;
  assert.equal(
    brCount,
    1,
    `Static slide with wrapLines must preserve 1 authoritative <a:br/> break, found ${brCount}`
  );
});

test('SPEC-83-01: Unit test resolveExplicitParagraphRunsForPptx helper', () => {
  const singleLineEl = {
    type: 'text',
    text: 'Single line text',
  };
  assert.equal(
    resolveExplicitParagraphRunsForPptx(singleLineEl),
    undefined,
    'Single line text without newlines must return undefined'
  );

  const multiLineEl = {
    type: 'text',
    text: 'Line 1\r\nLine 2\nLine 3',
  };
  const runs = resolveExplicitParagraphRunsForPptx(multiLineEl);
  assert.ok(Array.isArray(runs), 'Multiline text must return array of PptxTextRun');
  assert.equal(runs.length, 3);
  assert.deepEqual(runs[0], { text: 'Line 1', options: { breakLine: true } });
  assert.deepEqual(runs[1], { text: 'Line 2', options: { breakLine: true } });
  assert.deepEqual(runs[2], { text: 'Line 3', options: undefined });
});

// ---------------------------------------------------------------------------
// 2. Source Guards & Defect Injection Proofs
// ---------------------------------------------------------------------------

test('SPEC-83-01: Real-file defect injection proofs for dynamic unmeasured text PPTX rendering', () => {
  const originalSource = readPptxDrawSource();

  function verifySource(source) {
    const hasExplicitRuns =
      /resolveExplicitParagraphRunsForPptx\(\s*element\s*\)/.test(source);
    const hasDynamicBranch =
      /if\s*\(\s*isDynamicText\s*&&\s*!hasAuthoritativeWrap\s*\)/.test(source);
    const hasAuthVerticalAlign =
      /valign\s*=\s*resolveVerticalAlign\(\s*style\s*\?\?\s*\{\}\s*\)/.test(source);

    return hasExplicitRuns && hasDynamicBranch && hasAuthVerticalAlign;
  }

  // Baseline on real disk file
  assert.equal(
    verifySource(readPptxDrawSource()),
    true,
    'Unmodified pptx-draw.ts must pass all SPEC-83 source guards'
  );

  const defects = [
    {
      name: 'Reverted to fallbackLayout.runs injecting softBreakBefore',
      mutator: (s) =>
        s.replace(
          /resolveExplicitParagraphRunsForPptx\(\s*element\s*\)\s*\?\?\s*text/,
          'fallbackLayout.runs.length > 1 ? fallbackLayout.runs : text'
        ),
    },
    {
      name: 'Missing resolveExplicitParagraphRunsForPptx invocation',
      mutator: (s) =>
        s.replace(/resolveExplicitParagraphRunsForPptx\(\s*element\s*\)/g, 'undefined'),
    },
    {
      name: 'Missing isDynamicText branch',
      mutator: (s) =>
        s.replace(/isDynamicText\s*&&\s*!hasAuthoritativeWrap/, '!hasAuthoritativeWrap && false'),
    },
  ];

  for (const { name, mutator } of defects) {
    const defectiveSource = mutator(originalSource);
    try {
      fs.writeFileSync(PPTX_DRAW_PATH, defectiveSource, 'utf8');
      assert.equal(
        verifySource(readPptxDrawSource()),
        false,
        `Must detect PPTX draw defect: ${name}`
      );
    } finally {
      fs.writeFileSync(PPTX_DRAW_PATH, originalSource, 'utf8');
    }
  }

  // Behavioral Real-File Defect Proof:
  // Mutate pptx-draw.ts to revert to fallbackLayout.runs (injecting synthetic soft breaks)
  // and execute a fresh child process to generate PPTX and assert DrawingML contains > 0 <a:br/> breaks.
  const defectivePptxDraw = originalSource.replace(
    /textRuns\s*=\s*resolveExplicitParagraphRunsForPptx\(\s*element\s*\)\s*\?\?\s*text;/,
    'textRuns = fallbackLayout.runs.length > 1 ? fallbackLayout.runs : text;'
  );
  try {
    fs.writeFileSync(PPTX_DRAW_PATH, defectivePptxDraw, 'utf8');
    const childScript = `
      import assert from "node:assert/strict";
      import JSZip from "jszip";
      import { generatePptxFromPlan } from "./src/lib/pptx-draw.ts";
      const plan = ${JSON.stringify(makeDynamicScripturePlan())};
      const buffer = await generatePptxFromPlan("2026-09-26", plan, "none", undefined, { wordWrap: true });
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file("ppt/slides/slide1.xml").async("string");
      const brCount = (xml.match(/<a:br[\\s\\/>]/g) || []).length;
      assert.ok(brCount > 0, "Mutated pptx-draw must emit > 0 <a:br/> breaks");
      process.stdout.write("BEHAVIORAL_DEFECT_CONFIRMED_BR_" + brCount);
    `;
    const out = execFileSync(
      process.execPath,
      [
        '--import',
        './tests/register-ts-resolve.mjs',
        '--experimental-strip-types',
        '--input-type=module',
        '-e',
        childScript,
      ],
      { encoding: 'utf8', cwd: ROOT }
    );
    assert.ok(
      out.includes('BEHAVIORAL_DEFECT_CONFIRMED_BR_'),
      'Child process execution must prove behavioral defect emits <a:br/> breaks'
    );
  } finally {
    fs.writeFileSync(PPTX_DRAW_PATH, originalSource, 'utf8');
  }

  assert.equal(readPptxDrawSource(), originalSource, 'pptx-draw.ts must be completely restored');
});
