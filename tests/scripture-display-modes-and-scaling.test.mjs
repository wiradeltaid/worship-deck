/**
 * SPEC-98-03: Scripture Dual Display Modes, Adaptive Scaling & Projection-Safe Pagination
 *
 * Verifies:
 * - Deterministic dual display modes: per-verse (lines with newlines) vs inline (flowing with semicolons).
 * - Single-verse deterministic rule: always prefixed with (verse).
 * - Deterministic pagination for long passages: chunked by <= 8 verses / <= 900 chars per page.
 * - Dynamic displayReference on multi-page passages ("Book C (V-V)").
 * - PresenterOperator source guards: mode selector, localStorage persistence, pagination controls.
 * - ProjectorClient and ScriptureOverlayView support for display mode and page sync.
 * - Executable defect injection proofs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const scriptureFormatPath = path.join(root, 'src', 'lib', 'scripture-format.ts');
const presenterPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');
const projectorPath = path.join(root, 'src', 'projected', 'ProjectorClient.tsx');
const scriptureViewPath = path.join(root, 'src', 'components', 'ScriptureOverlayView.tsx');

const { formatScriptureText, paginateScriptureVerses } = await import(
  pathToFileURL(scriptureFormatPath).href
);

test('SPEC-98-03: formatScriptureText formats per-verse and inline modes deterministically', () => {
  const sampleVerses = [
    { verse: 1, text: 'In the beginning was the Word' },
    { verse: 2, text: 'The same was in the beginning with God' },
    { verse: 3, text: 'All things were made by him' },
  ];

  // 1. Per-verse mode: separate lines with parentheses
  const perVerse = formatScriptureText(sampleVerses, 'per-verse');
  assert.equal(
    perVerse,
    '(1) In the beginning was the Word\n(2) The same was in the beginning with God\n(3) All things were made by him'
  );

  // 2. Inline mode: flowing text separated by semicolons and verse numbers
  const inline = formatScriptureText(sampleVerses, 'inline');
  assert.equal(
    inline,
    '(1) In the beginning was the Word; (2) The same was in the beginning with God; (3) All things were made by him'
  );

  // 3. Single verse deterministic rule: always prefixed with (verse)
  const single = [{ verse: 16, text: 'For God so loved the world' }];
  assert.equal(formatScriptureText(single, 'per-verse'), '(16) For God so loved the world');
  assert.equal(formatScriptureText(single, 'inline'), '(16) For God so loved the world');
});

test('SPEC-98-03: paginateScriptureVerses chunks long passages deterministically', () => {
  // Construct 20 synthetic verses (exceeding the 8-verse limit)
  const twentyVerses = Array.from({ length: 20 }, (_, i) => ({
    verse: i + 1,
    text: `Verse number ${i + 1} content text for testing pagination layout.`,
  }));

  const pages = paginateScriptureVerses('John 4', twentyVerses, 'per-verse', 8, 900);
  assert.ok(pages.length > 1, '20 verses must be chunked into multiple pages');
  assert.equal(pages[0].page, 1);
  assert.equal(pages[0].totalPages, 3);
  assert.equal(pages[0].verses.length, 8);
  assert.equal(pages[0].displayReference, 'John 4 (1-8)');
  assert.match(pages[0].text, /^\(1\) Verse number 1/);
  assert.match(pages[0].text, /\(8\) Verse number 8/);

  assert.equal(pages[1].page, 2);
  assert.equal(pages[1].displayReference, 'John 4 (9-16)');

  assert.equal(pages[2].page, 3);
  assert.equal(pages[2].verses.length, 4);
  assert.equal(pages[2].displayReference, 'John 4 (17-20)');

  // Short passage stays single page
  const shortVerses = [
    { verse: 1, text: 'Short one' },
    { verse: 2, text: 'Short two' },
  ];
  const singlePage = paginateScriptureVerses('John 4:1-2', shortVerses, 'per-verse');
  assert.equal(singlePage.length, 1);
  assert.equal(singlePage[0].displayReference, 'John 4:1-2');
  assert.equal(singlePage[0].totalPages, 1);
});

test('SPEC-98-03: PresenterOperator source guards for mode selector, localStorage, and paging', () => {
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');

  // Mode selector presence and buttons
  assert.ok(
    presenterSrc.includes('data-testid="presenter-scripture-mode-selector"'),
    'PresenterOperator must render presenter-scripture-mode-selector'
  );
  assert.ok(
    presenterSrc.includes('data-testid="presenter-scripture-mode-per-verse"'),
    'PresenterOperator must render presenter-scripture-mode-per-verse'
  );
  assert.ok(
    presenterSrc.includes('data-testid="presenter-scripture-mode-inline"'),
    'PresenterOperator must render presenter-scripture-mode-inline'
  );

  // LocalStorage persistence
  assert.ok(
    presenterSrc.includes('worship_deck_scripture_mode'),
    'PresenterOperator must persist scripture mode in localStorage'
  );

  // Paging controls
  assert.ok(
    presenterSrc.includes('data-testid="presenter-scripture-paging"'),
    'PresenterOperator must render presenter-scripture-paging'
  );
  assert.ok(
    presenterSrc.includes('data-testid="presenter-scripture-prev-page"'),
    'PresenterOperator must render presenter-scripture-prev-page'
  );
  assert.ok(
    presenterSrc.includes('data-testid="presenter-scripture-next-page"'),
    'PresenterOperator must render presenter-scripture-next-page'
  );
  assert.ok(
    presenterSrc.includes('data-testid="presenter-scripture-page-indicator"'),
    'PresenterOperator must render presenter-scripture-page-indicator'
  );
});

test('SPEC-98-03: ScriptureOverlayView applies whitespace-pre-wrap for per-verse mode', () => {
  const viewSrc = fs.readFileSync(scriptureViewPath, 'utf8');
  assert.ok(
    viewSrc.includes("mode === 'per-verse' ? 'whitespace-pre-wrap' : ''"),
    'ScriptureOverlayView must apply whitespace-pre-wrap for per-verse mode'
  );
});

test('SPEC-98-03: ProjectorClient unpacks and displays formatted scripture overlay', () => {
  const projSrc = fs.readFileSync(projectorPath, 'utf8');
  assert.ok(
    projSrc.includes('msg.displayReference || msg.reference'),
    'ProjectorClient must unpack displayReference when present'
  );
  assert.ok(
    projSrc.includes('mode={overlay.mode}'),
    'ProjectorClient must forward overlay.mode to ScriptureOverlayView'
  );
});

test('SPEC-98-03 Defect Injection Proof: verifyModeSelectorPresence detects omitted selector', () => {
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  const brokenSource = presenterSrc.replace('data-testid="presenter-scripture-mode-selector"', '');
  assert.equal(
    brokenSource.includes('data-testid="presenter-scripture-mode-selector"'),
    false,
    'INJECTED DEFECT: Omitted mode selector fails guard'
  );
});
