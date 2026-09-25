/**
 * SPEC-78: PPTX Text Box Word Wrap Option on Export (WSD-W1)
 *
 * Verifies:
 * 1. generatePptxFromPlan defaults to wordWrap: true, emitting DrawingML text shapes with wrap="square".
 * 2. generatePptxFromPlan with wordWrap: false emits DrawingML text shapes with wrap="none".
 * 3. Soft breaks (<a:br/>) and paragraph boundaries (<a:p>) are preserved across both wrap modes.
 * 4. workers/pptx/draw.mjs forwards wordWrap from stdin payload to generatePptxFromPlan.
 * 5. internal/httpapi/server.go parses wrap query parameter into wordWrap boolean.
 * 6. spa/src/pages/RunSheetPage.tsx exposes the default wrap export and wrap=false toggle.
 * 7. Real-file defect injection proofs for PPTX wrap decoupling.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { default: JSZip } = await import(
  pathToFileURL(path.join(root, 'node_modules', 'jszip', 'lib', 'index.js')).href
);
const { generatePptxFromPlan } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'pptx-draw.ts')).href
);

function makePartitionedPlan() {
  return [
    {
      id: 'slide-1',
      kind: 'announcement',
      artifact: {
        runtimeVersion: 1,
        schemaVersion: 1,
        id: 'art-1',
        kind: 'announcement',
        layout: {
          backgroundColor: '#000000',
          elements: [
            {
              id: 'el-title',
              type: 'text',
              text: 'Opening Song Title Announcement',
              wrapLines: ['Opening Song Title', 'Announcement'],
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
            {
              id: 'el-body',
              type: 'text',
              text: 'First partitioned line of body text without newline but wrapped into two lines',
              wrapLines: [
                'First partitioned line of body text',
                'without newline but wrapped into two lines',
              ],
              x: 10,
              y: 35,
              w: 80,
              h: 30,
              style: {
                fontSize: 24,
                fontColor: '#E0E0E0',
                fontFamily: 'Arial',
                lineHeight: 1.2,
              },
            },
            {
              id: 'el-para',
              type: 'text',
              text: 'Paragraph One text content\nParagraph Two text content',
              x: 10,
              y: 70,
              w: 80,
              h: 25,
              style: {
                fontSize: 20,
                fontColor: '#D0D0D0',
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

function runWorker(payload) {
  return new Promise((resolve, reject) => {
    const proc = spawn(
      process.execPath,
      [
        '--import',
        './workers/pptx/register.mjs',
        '--experimental-strip-types',
        './workers/pptx/draw.mjs',
      ],
      { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] }
    );
    const stdout = [];
    const stderr = [];
    proc.stdout.on('data', (c) => stdout.push(c));
    proc.stderr.on('data', (c) => stderr.push(c));
    proc.on('error', reject);
    proc.on('close', (code) => {
      resolve({
        code,
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
    proc.stdin.end(JSON.stringify(payload));
  });
}

test('SPEC-78: default export generates DrawingML shapes with wrap="square" and preserves <a:br/> and <a:p>', async () => {
  const plan = makePartitionedPlan();
  const buffer = await generatePptxFromPlan('2026-09-25', plan, 'fade');
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');

  const bodyPrMatches = slideXml.match(/<a:bodyPr[^>]*>/g) || [];
  assert.ok(bodyPrMatches.length >= 3, 'expected at least 3 text bodyPr elements');
  for (const bodyPr of bodyPrMatches) {
    assert.match(bodyPr, /wrap="square"/, `expected wrap="square" in default mode, got: ${bodyPr}`);
    assert.doesNotMatch(bodyPr, /wrap="none"/, `wrap="none" must not be present in default mode: ${bodyPr}`);
  }

  // Soft line breaks (<a:br/>) preserved from partitioned wrapLines
  const brMatches = slideXml.match(/<a:br\/>/g) || [];
  assert.ok(brMatches.length >= 2, `expected at least 2 <a:br/> line breaks preserved, got ${brMatches.length}`);

  // Paragraph boundaries (<a:p>) preserved across distinct paragraphs
  const pMatches = slideXml.match(/<a:p>/g) || [];
  assert.ok(pMatches.length >= 4, `expected at least 4 <a:p> paragraph elements, got ${pMatches.length}`);
  assert.ok(slideXml.includes('Paragraph One text content'), 'paragraph 1 content preserved');
  assert.ok(slideXml.includes('Paragraph Two text content'), 'paragraph 2 content preserved');
});

test('SPEC-78: explicit wordWrap: false generates DrawingML shapes with wrap="none" and preserves <a:br/> and <a:p>', async () => {
  const plan = makePartitionedPlan();
  const buffer = await generatePptxFromPlan('2026-09-25', plan, 'fade', undefined, { wordWrap: false });
  const zip = await JSZip.loadAsync(buffer);
  const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');

  const bodyPrMatches = slideXml.match(/<a:bodyPr[^>]*>/g) || [];
  assert.ok(bodyPrMatches.length >= 3, 'expected at least 3 text bodyPr elements');
  for (const bodyPr of bodyPrMatches) {
    assert.match(bodyPr, /wrap="none"/, `expected wrap="none" when wordWrap is false, got: ${bodyPr}`);
    assert.doesNotMatch(bodyPr, /wrap="square"/, `wrap="square" must not be present when wordWrap is false: ${bodyPr}`);
  }

  const brMatches = slideXml.match(/<a:br\/>/g) || [];
  assert.ok(brMatches.length >= 2, `expected at least 2 <a:br/> line breaks preserved when wordWrap is false, got ${brMatches.length}`);

  const pMatches = slideXml.match(/<a:p>/g) || [];
  assert.ok(pMatches.length >= 4, `expected at least 4 <a:p> paragraph elements when wordWrap is false, got ${pMatches.length}`);
  assert.ok(slideXml.includes('Paragraph One text content'), 'paragraph 1 content preserved in wrap:false');
  assert.ok(slideXml.includes('Paragraph Two text content'), 'paragraph 2 content preserved in wrap:false');
});

test('SPEC-78: worker forwards wordWrap option from stdin JSON', async () => {
  const plan = makePartitionedPlan();

  // Test worker with wordWrap: false
  const resNoWrap = await runWorker({
    serviceDate: '2026-09-25',
    transition: 'fade',
    plan,
    wordWrap: false,
  });
  assert.equal(resNoWrap.code, 0, resNoWrap.stderr);
  const zipNoWrap = await JSZip.loadAsync(resNoWrap.stdout);
  const xmlNoWrap = await zipNoWrap.file('ppt/slides/slide1.xml').async('string');
  const bodyPrNoWrap = xmlNoWrap.match(/<a:bodyPr[^>]*>/g) || [];
  assert.ok(bodyPrNoWrap.length >= 3);
  for (const tag of bodyPrNoWrap) {
    assert.match(tag, /wrap="none"/);
  }

  // Test worker with default (omitted wordWrap)
  const resDefault = await runWorker({
    serviceDate: '2026-09-25',
    transition: 'fade',
    plan,
  });
  assert.equal(resDefault.code, 0, resDefault.stderr);
  const zipDefault = await JSZip.loadAsync(resDefault.stdout);
  const xmlDefault = await zipDefault.file('ppt/slides/slide1.xml').async('string');
  const bodyPrDefault = xmlDefault.match(/<a:bodyPr[^>]*>/g) || [];
  assert.ok(bodyPrDefault.length >= 3);
  for (const tag of bodyPrDefault) {
    assert.match(tag, /wrap="square"/);
  }
});

test('SPEC-78: Go HTTP server server.go parses wrap query parameter contract', () => {
  const serverPath = path.join(root, 'internal', 'httpapi', 'server.go');
  const content = fs.readFileSync(serverPath, 'utf8');

  assert.ok(
    content.includes('parseWordWrapParam(r.URL.Query().Get("wrap"))'),
    'server.go must parse wrap query parameter via parseWordWrapParam'
  );
  assert.ok(
    content.includes('if wrapParam == "false" || wrapParam == "0"'),
    'server.go must check wrap == "false" || wrap == "0"'
  );
  assert.ok(
    content.includes('"wordWrap":    wordWrap,'),
    'server.go must pass wordWrap in payload to pptx.Draw'
  );
});

test('SPEC-78: RunSheetPage provides PPTX download with default word wrap and wrap=false option', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'RunSheetPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');

  assert.ok(
    content.includes('/api/services/${svc.id}/pptx'),
    'RunSheetPage must link to default PPTX download endpoint'
  );
  assert.ok(
    content.includes('/api/services/${svc.id}/pptx?wrap=false'),
    'RunSheetPage must link to wrap=false option'
  );
  assert.ok(
    content.includes('Word Wrap in PowerPoint (Default)'),
    'RunSheetPage must offer Word Wrap Default label'
  );
  assert.ok(
    content.includes('Disable PowerPoint Word Wrap'),
    'RunSheetPage must offer Disable PowerPoint Word Wrap label'
  );
});

test('SPEC-78: guard proof — injected forced wrap="none" defect is detected', async () => {
  const drawModulePath = path.join(root, 'src', 'lib', 'pptx-draw.ts');
  const original = fs.readFileSync(drawModulePath, 'utf8');
  try {
    // Inject defect: force wrap to always be false regardless of wordWrap option
    const mutated = original.replace('const wrap = wordWrap;', 'const wrap = false;');
    assert.notEqual(mutated, original, 'mutation replacement must succeed');
    fs.writeFileSync(drawModulePath, mutated);

    const plan = makePartitionedPlan();
    const res = await runWorker({ serviceDate: '2026-09-25', transition: 'fade', plan });
    assert.equal(res.code, 0, res.stderr);

    const zip = await JSZip.loadAsync(res.stdout);
    const slideXml = await zip.file('ppt/slides/slide1.xml').async('string');

    // Default mode should have failed to produce wrap="square" and instead produced wrap="none"
    const bodyPrMatches = slideXml.match(/<a:bodyPr[^>]*>/g) || [];
    const hasSquare = bodyPrMatches.some((b) => b.includes('wrap="square"'));
    const hasNone = bodyPrMatches.some((b) => b.includes('wrap="none"'));

    assert.equal(hasSquare, false, 'defect injection must cause default mode to lose wrap="square"');
    assert.equal(hasNone, true, 'defect injection must cause default mode to emit wrap="none"');
  } finally {
    fs.writeFileSync(drawModulePath, original);
    const restored = fs.readFileSync(drawModulePath, 'utf8');
    assert.equal(restored, original, 'source file must be restored identically after defect proof');
  }
});
