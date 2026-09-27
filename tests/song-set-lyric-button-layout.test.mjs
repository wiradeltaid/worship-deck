/**
 * SPEC-86-02: Song-Set Lyric Action Dedicated Row Placement
 * Unit, structural layout hierarchy, fail-closed containment, and real-file defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dynamicFormBodyPath = path.join(rootDir, 'src', 'operator', 'DynamicFormBody.tsx');

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function getElementContentByTestId(cleanSrc, testId) {
  const marker = `data-testid="${testId}"`;
  const markerIndex = cleanSrc.indexOf(marker);
  if (markerIndex === -1) return null;
  const tagStart = cleanSrc.lastIndexOf('<div', markerIndex);
  if (tagStart === -1) return null;

  let depth = 0;
  let i = tagStart;
  while (i < cleanSrc.length) {
    if (cleanSrc.startsWith('<div', i)) {
      depth++;
      i += 4;
    } else if (cleanSrc.startsWith('</div>', i)) {
      depth--;
      i += 6;
      if (depth === 0) {
        return cleanSrc.slice(tagStart, i);
      }
    } else {
      i++;
    }
  }
  return null;
}

export function scanSongSetLyricButtonLayout(formPath = dynamicFormBodyPath) {
  const findings = [];
  const formSrc = fs.readFileSync(formPath, 'utf8');
  const cleanSrc = stripComments(formSrc);

  // 1. Selector controls row exists with explicit data-testid="song-set-selectors-row"
  const selectorsContent = getElementContentByTestId(cleanSrc, 'song-set-selectors-row');
  if (!selectorsContent) {
    findings.push('DynamicFormBody.tsx missing data-testid="song-set-selectors-row" or has unclosed <div> nesting');
  }

  // 2. Dedicated action row exists with explicit data-testid="song-set-action-row"
  const actionContent = getElementContentByTestId(cleanSrc, 'song-set-action-row');
  if (!actionContent) {
    findings.push('DynamicFormBody.tsx missing data-testid="song-set-action-row" or has unclosed <div> nesting');
  }

  // 3. Textarea must exist with data-testid="song-set-lyric-textarea"
  const textareaIndex = cleanSrc.indexOf('data-testid="song-set-lyric-textarea"');
  if (textareaIndex === -1) {
    findings.push('DynamicFormBody.tsx missing data-testid="song-set-lyric-textarea"');
  }

  // 4. Sequential ordering: Selectors row must precede Action row, which precedes Textarea
  const selectorsRowIndex = cleanSrc.indexOf('data-testid="song-set-selectors-row"');
  const actionRowIndex = cleanSrc.indexOf('data-testid="song-set-action-row"');

  if (selectorsRowIndex !== -1 && actionRowIndex !== -1) {
    if (selectorsRowIndex >= actionRowIndex) {
      findings.push('song-set-selectors-row must precede song-set-action-row in layout');
    }
  }
  if (actionRowIndex !== -1 && textareaIndex !== -1) {
    if (actionRowIndex >= textareaIndex) {
      findings.push('song-set-action-row must precede song-set-lyric-textarea in layout');
    }
  }

  // 5. Strict direct sibling adjacency: Prohibit ANY intervening JSX element or wrapper between selector row and action row
  if (selectorsRowIndex !== -1 && actionRowIndex !== -1 && selectorsRowIndex < actionRowIndex && selectorsContent) {
    const selectorsTagStart = cleanSrc.lastIndexOf('<div', selectorsRowIndex);
    const selectorsEnd = selectorsTagStart + selectorsContent.length;
    const actionTagStart = cleanSrc.lastIndexOf('<div', actionRowIndex);
    if (selectorsEnd <= actionTagStart) {
      const intermediate = cleanSrc
        .slice(selectorsEnd, actionTagStart)
        .replace(/\{\s*\}/g, '')
        .replace(/\{hasValidNum\s*&&\s*\(/g, '')
        .trim();
      if (intermediate.length > 0) {
        findings.push(`Direct sibling violation: unexpected intervening JSX content between rows: "${intermediate}"`);
      }
    } else {
      findings.push('Direct sibling violation: selectors row boundary overlaps action row');
    }
  }

  // 6. Fail-closed containment & exclusivity: Selectors row strictly contains 3 selectors and ZERO buttons
  if (selectorsContent) {
    if (!selectorsContent.includes('HymnNumberAutocomplete')) {
      findings.push('song-set-selectors-row must contain HymnNumberAutocomplete');
    }
    if (!selectorsContent.includes('values.songBookCode')) {
      findings.push('song-set-selectors-row must contain Book Code Select');
    }
    if (!selectorsContent.includes('values.background')) {
      findings.push('song-set-selectors-row must contain Background Select');
    }
    if (
      selectorsContent.includes('<Button') ||
      selectorsContent.includes('onToggleLyricEditor') ||
      selectorsContent.includes('data-testid="save-to-book-button"') ||
      selectorsContent.includes('data-testid="song-set-lyric-toggle-button"')
    ) {
      findings.push('song-set-selectors-row must NOT contain lyric action buttons (must be separated into action row)');
    }
  }

  // 7. Fail-closed containment: Action row must contain lyric toggle and save-to-book buttons
  if (actionContent) {
    if (!actionContent.includes('onToggleLyricEditor')) {
      findings.push('song-set-action-row must contain onToggleLyricEditor action button');
    }
    if (!actionContent.includes('data-testid="save-to-book-button"')) {
      findings.push('song-set-action-row must contain data-testid="save-to-book-button"');
    }
    if (!actionContent.includes('data-testid="song-set-lyric-toggle-button"')) {
      findings.push('song-set-action-row must contain data-testid="song-set-lyric-toggle-button"');
    }
  }

  return findings;
}

test('SPEC-86-02: SongSetSlotRenderer layout separation between selectors and dedicated action row', () => {
  const findings = scanSongSetLyricButtonLayout();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-86-02: Real-file defect injection — placing lyric toggle buttons back in selectors row fails separation guard', () => {
  const original = fs.readFileSync(dynamicFormBodyPath, 'utf8');
  try {
    // Defect: Relocate action row buttons back into selectors row
    const actionRowBlockRegex = /\{hasValidNum && \([\s\S]*?data-testid="song-set-action-row"[\s\S]*?<\/div>\s*\)\}/;
    const actionRowMatch = original.match(actionRowBlockRegex);
    assert.ok(actionRowMatch, 'must match action row in original');

    const targetRegex = /<\/Select>\s*<\/div>\s*<\/div>/;
    const targetMatch = original.match(targetRegex);
    assert.ok(targetMatch, 'must match end of selectors row in original');

    const defective = original
      .replace(actionRowMatch[0], '')
      .replace(targetRegex, `</Select>\n        </div>\n        ${actionRowMatch[0]}\n      </div>`);
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(dynamicFormBodyPath, defective);

    const findings = scanSongSetLyricButtonLayout();
    assert.ok(
      findings.some((f) => f.includes('must NOT contain lyric action buttons')),
      'Expected real-file defect injection putting buttons back in selectors row to fail separation guard'
    );
  } finally {
    fs.writeFileSync(dynamicFormBodyPath, original);
    assert.equal(fs.readFileSync(dynamicFormBodyPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-02: Real-file defect injection — removing data-testid="song-set-action-row" fails guard', () => {
  const original = fs.readFileSync(dynamicFormBodyPath, 'utf8');
  try {
    const defective = original.replace('data-testid="song-set-action-row"', 'data-testid="unlabeled-action-row"');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(dynamicFormBodyPath, defective);

    const findings = scanSongSetLyricButtonLayout();
    assert.ok(
      findings.some((f) => f.includes('missing data-testid="song-set-action-row"')),
      'Expected defect injection without action-row testid to fail guard'
    );
  } finally {
    fs.writeFileSync(dynamicFormBodyPath, original);
    assert.equal(fs.readFileSync(dynamicFormBodyPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-02: Real-file defect injection — displacing HymnNumberAutocomplete into action row fails containment guard', () => {
  const original = fs.readFileSync(dynamicFormBodyPath, 'utf8');
  try {
    // Defect: Displace HymnNumberAutocomplete out of selectors row into action row
    const autocompleteRegex = /<HymnNumberAutocomplete[\s\S]*?\/>/;
    const autoMatch = original.match(autocompleteRegex);
    assert.ok(autoMatch, 'must match autocomplete component');

    const defective = original
      .replace(autoMatch[0], '{/* displaced autocomplete */}')
      .replace('data-testid="song-set-action-row">', `data-testid="song-set-action-row">\n          ${autoMatch[0]}`);
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(dynamicFormBodyPath, defective);

    const findings = scanSongSetLyricButtonLayout();
    assert.ok(
      findings.some((f) => f.includes('song-set-selectors-row must contain HymnNumberAutocomplete')),
      'Expected defect injection displacing autocomplete to fail containment guard'
    );
  } finally {
    fs.writeFileSync(dynamicFormBodyPath, original);
    assert.equal(fs.readFileSync(dynamicFormBodyPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-02: Real-file defect injection — inverting row order fails sequential ordering guard', () => {
  const original = fs.readFileSync(dynamicFormBodyPath, 'utf8');
  try {
    const defective = original.replace(
      'data-testid="song-set-selectors-row"',
      'data-testid="song-set-temp-row"'
    ).replace(
      'data-testid="song-set-action-row"',
      'data-testid="song-set-selectors-row"'
    ).replace(
      'data-testid="song-set-temp-row"',
      'data-testid="song-set-action-row"'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(dynamicFormBodyPath, defective);

    const findings = scanSongSetLyricButtonLayout();
    assert.ok(
      findings.some((f) => f.includes('song-set-selectors-row must precede song-set-action-row')),
      'Expected inverted row order to fail sequential ordering guard'
    );
  } finally {
    fs.writeFileSync(dynamicFormBodyPath, original);
    assert.equal(fs.readFileSync(dynamicFormBodyPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-02: Real-file defect injection — missing lyric textarea fails fail-closed guard', () => {
  const original = fs.readFileSync(dynamicFormBodyPath, 'utf8');
  try {
    const defective = original.replace('data-testid="song-set-lyric-textarea"', 'data-testid="unlabeled-textarea"');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(dynamicFormBodyPath, defective);

    const findings = scanSongSetLyricButtonLayout();
    assert.ok(
      findings.some((f) => f.includes('missing data-testid="song-set-lyric-textarea"')),
      'Expected missing lyric textarea to fail guard'
    );
  } finally {
    fs.writeFileSync(dynamicFormBodyPath, original);
    assert.equal(fs.readFileSync(dynamicFormBodyPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-02: Real-file defect injection — intervening wrapper or control between rows fails strict adjacency guard', () => {
  const original = fs.readFileSync(dynamicFormBodyPath, 'utf8');
  try {
    const defective = original.replace(
      '{/* Dedicated Action Row */}',
      '<div className="intervening-wrapper"><Button type="button">Intervening Control</Button></div>\n      {/* Dedicated Action Row */}'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(dynamicFormBodyPath, defective);

    const findings = scanSongSetLyricButtonLayout();
    assert.ok(
      findings.some((f) => f.includes('Direct sibling violation')),
      'Expected intervening wrapper to fail strict adjacency guard'
    );
  } finally {
    fs.writeFileSync(dynamicFormBodyPath, original);
    assert.equal(fs.readFileSync(dynamicFormBodyPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-02: Real-file defect injection — unclosed div depth anomaly triggers boundary containment violation', () => {
  const original = fs.readFileSync(dynamicFormBodyPath, 'utf8');
  try {
    // Defect: Inject unclosed <div> in selectors row
    const defective = original.replace(
      'data-testid="song-set-selectors-row">',
      'data-testid="song-set-selectors-row"><div>'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(dynamicFormBodyPath, defective);

    const findings = scanSongSetLyricButtonLayout();
    assert.ok(
      findings.some((f) => f.includes('must NOT contain lyric action buttons') || f.includes('Direct sibling violation')),
      'Expected unclosed div anomaly to trigger boundary containment violation'
    );
  } finally {
    fs.writeFileSync(dynamicFormBodyPath, original);
    assert.equal(fs.readFileSync(dynamicFormBodyPath, 'utf8'), original, 'file must be restored identically');
  }
});
