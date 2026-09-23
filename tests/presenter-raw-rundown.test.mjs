/**
 * SPEC-67-01: Presenter raw rundown display and obsolete prop removal.
 *
 * Verifies:
 * 1. PresenterOperator.tsx accepts `rundownText?: string` and completely removes `runSheetItems`.
 * 2. PresentPage.tsx passes `rundownText={data.raw_payload || ''}` and removes `runSheetItems`.
 * 3. Exact whitespace-pre-wrap and overflow-y-auto container layout.
 * 4. Localization keys: `presenter.noRundownText` defined in keys.ts, catalogue-en.ts, catalogue-id.ts.
 * 5. Text content fidelity: preserves blank lines, leading spaces, punctuation, emoji verbatim.
 * 6. Executable absence guard proof with defect injection.
 */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const PRESENTER_OPERATOR_FILE = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
const PRESENT_PAGE_FILE = path.join(ROOT, 'spa', 'src', 'pages', 'PresentPage.tsx');

const srcUrl = (...parts) => pathToFileURL(path.join(ROOT, 'src', ...parts)).href;

const { catalogueKeys, resolveString } = await import(srcUrl('lib', 'i18n', 'index.ts'));
const { formatPresenterRunSheet } = await import(
  srcUrl('operator', 'present', 'presenter-model.ts')
);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanPresenterRunSheetSources(source, rel) {
  const findings = [];
  const clean = stripComments(source);
  const lines = clean.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // Defect 1: Obsolete runSheetItems reference
    if (/\brunSheetItems\b/.test(line)) {
      findings.push({
        rel,
        lineNo,
        kind: 'obsolete-runSheetItems-reference',
        line: line.trim(),
      });
    }

    // Defect 2: parsed_data.items reference in PresentPage
    if (rel.endsWith('PresentPage.tsx') && /\bparsed(_data)?\.items\b/.test(line)) {
      findings.push({
        rel,
        lineNo,
        kind: 'obsolete-parsed-items-reference',
        line: line.trim(),
      });
    }
  }

  return findings;
}

test('SPEC-67-01: PresenterOperator.tsx and PresentPage.tsx have zero references to runSheetItems', () => {
  const files = [
    { abs: PRESENTER_OPERATOR_FILE, rel: 'src/operator/present/PresenterOperator.tsx' },
    { abs: PRESENT_PAGE_FILE, rel: 'spa/src/pages/PresentPage.tsx' },
  ];

  const findings = files.flatMap(({ abs, rel }) => {
    const content = readFileSync(abs, 'utf8');
    return scanPresenterRunSheetSources(content, rel);
  });

  assert.deepEqual(
    findings,
    [],
    `Found obsolete runSheetItems references in presenter sources: ${JSON.stringify(findings, null, 2)}`
  );
});

test('SPEC-67-01: PresenterOperator.tsx accepts rundownText and renders whitespace-pre-wrap sidebar', () => {
  const content = readFileSync(PRESENTER_OPERATOR_FILE, 'utf8');

  // Must declare rundownText prop
  assert.match(
    content,
    /rundownText\??\s*:\s*string/,
    'PresenterOperator props must declare rundownText?: string'
  );

  // Must use whitespace-pre-wrap
  assert.match(
    content,
    /whitespace-pre-wrap/,
    'PresenterOperator must style rundown text with whitespace-pre-wrap'
  );

  // Must use overflow-y-auto
  assert.match(
    content,
    /overflow-y-auto/,
    'PresenterOperator must preserve overflow-y-auto on sidebar container'
  );

  // Must render localized empty state
  assert.match(
    content,
    /t\(\s*['"]presenter\.noRundownText['"]\s*\)/,
    'PresenterOperator must render t("presenter.noRundownText") for empty rundown'
  );
});

test('SPEC-67-01: PresentPage.tsx passes raw_payload as rundownText', () => {
  const content = readFileSync(PRESENT_PAGE_FILE, 'utf8');

  assert.match(
    content,
    /rundownText=\{(data\.)?raw_payload\s*\|\|\s*['"]['"]\}/,
    'PresentPage.tsx must pass rundownText={data.raw_payload || ""}'
  );
});

test('SPEC-67-01: Localization key presenter.noRundownText is defined in en and id catalogues', () => {
  const enKeys = catalogueKeys('en');
  const idKeys = catalogueKeys('id');

  assert.ok(
    enKeys.includes('presenter.noRundownText'),
    'catalogueKeys("en") must include presenter.noRundownText'
  );
  assert.ok(
    idKeys.includes('presenter.noRundownText'),
    'catalogueKeys("id") must include presenter.noRundownText'
  );

  const en = resolveString('presenter.noRundownText', 'en');
  const id = resolveString('presenter.noRundownText', 'id');

  assert.equal(en, 'No rundown text provided');
  assert.equal(id, 'Tidak ada teks susunan acara');
});

test('SPEC-67-01: Rundown raw text fidelity preserves newlines, spaces, emoji, and punctuation', () => {
  const sampleRawText = `SABBATH, AUGUST 22, 2026
DIVINE SERVICE 🎉

  1. Call to Worship: Elder John & Family
  2. Opening Song: SDAH #159 "Praise to the Lord"
     - Congregation stands!

Pastoral Notes:
• Welcome visitors to fellowship lunch
• Youth practice @ 3:00 PM`;

  const fallback = resolveString('presenter.noRundownText', 'en');

  // Verify formatPresenterRunSheet preserves raw_payload verbatim without trimming or loss
  const populated = formatPresenterRunSheet(sampleRawText, fallback);
  assert.equal(populated.isEmpty, false);
  assert.equal(populated.text, sampleRawText, 'Raw rundown text must match verbatim');
  assert.ok(populated.text.includes('🎉'));
  assert.ok(populated.text.includes('  1. Call to Worship'));
  assert.ok(populated.text.includes('\n\n'));
  assert.equal(populated.text.split('\n').length, 10);

  // Empty state handling
  const empty1 = formatPresenterRunSheet('', fallback);
  assert.equal(empty1.isEmpty, true);
  assert.equal(empty1.text, 'No rundown text provided');

  const empty2 = formatPresenterRunSheet('   \n\t  ', fallback);
  assert.equal(empty2.isEmpty, true);
  assert.equal(empty2.text, 'No rundown text provided');

  const empty3 = formatPresenterRunSheet(null, fallback);
  assert.equal(empty3.isEmpty, true);
  assert.equal(empty3.text, 'No rundown text provided');

  const empty4 = formatPresenterRunSheet(undefined, fallback);
  assert.equal(empty4.isEmpty, true);
  assert.equal(empty4.text, 'No rundown text provided');
});

test('SPEC-67-01: Executable Absence Guard Proof — Real-File Defect Injection', () => {
  const originalPresenter = readFileSync(PRESENTER_OPERATOR_FILE, 'utf8');
  const originalPresentPage = readFileSync(PRESENT_PAGE_FILE, 'utf8');

  try {
    // 1. Inject defect into real PresenterOperator.tsx on disk
    const dirtyPresenter = originalPresenter.replace(
      'rundownText?: string;',
      'rundownText?: string;\n  runSheetItems: ParsedItem[];'
    );
    writeFileSync(PRESENTER_OPERATOR_FILE, dirtyPresenter, 'utf8');

    const presenterFindings = scanPresenterRunSheetSources(
      readFileSync(PRESENTER_OPERATOR_FILE, 'utf8'),
      'src/operator/present/PresenterOperator.tsx'
    );
    assert.ok(
      presenterFindings.some((f) => f.kind === 'obsolete-runSheetItems-reference'),
      'Guard must detect injected runSheetItems defect in real PresenterOperator.tsx'
    );

    // 2. Inject defect into real PresentPage.tsx on disk
    const dirtyPresentPage = originalPresentPage.replace(
      'rundownText={data.raw_payload || \'\'}',
      'rundownText={data.raw_payload || \'\'}\n      runSheetItems={parsed.items || []}'
    );
    writeFileSync(PRESENT_PAGE_FILE, dirtyPresentPage, 'utf8');

    const pageFindings = scanPresenterRunSheetSources(
      readFileSync(PRESENT_PAGE_FILE, 'utf8'),
      'spa/src/pages/PresentPage.tsx'
    );
    assert.ok(
      pageFindings.some((f) => f.kind === 'obsolete-runSheetItems-reference'),
      'Guard must detect injected runSheetItems defect in real PresentPage.tsx'
    );
    assert.ok(
      pageFindings.some((f) => f.kind === 'obsolete-parsed-items-reference'),
      'Guard must detect injected parsed.items defect in real PresentPage.tsx'
    );
  } finally {
    // Restore real files immediately
    writeFileSync(PRESENTER_OPERATOR_FILE, originalPresenter, 'utf8');
    writeFileSync(PRESENT_PAGE_FILE, originalPresentPage, 'utf8');
  }

  // Confirm clean state after restore
  const cleanPresenter = scanPresenterRunSheetSources(
    readFileSync(PRESENTER_OPERATOR_FILE, 'utf8'),
    'src/operator/present/PresenterOperator.tsx'
  );
  const cleanPage = scanPresenterRunSheetSources(
    readFileSync(PRESENT_PAGE_FILE, 'utf8'),
    'spa/src/pages/PresentPage.tsx'
  );
  assert.equal(cleanPresenter.length, 0, 'PresenterOperator.tsx must be clean after restore');
  assert.equal(cleanPage.length, 0, 'PresentPage.tsx must be clean after restore');
});
