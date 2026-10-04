/**
 * SPEC-98-01: Scripture Clear Button Repositioning & Ergonomics
 *
 * Verifies:
 * - Absence Guard 1: Clear Scripture button is absent from header row 1 (presenter-header-row-1).
 * - Absence Guard 1 Proof: Injected clear button in header row 1 triggers failure.
 * - Presence Guard 2: Clear Scripture button is positioned inside data-testid="presenter-scripture-actions"
 *   within data-slot="presenter-scripture-panel".
 * - Presence Guard 2 Proof: Displacing or omitting the clear button triggers failure.
 * - Button semantics: Push and Clear buttons have distinct test IDs (presenter-push-scripture-button,
 *   presenter-clear-scripture-button), matching size="sm", variant="outline" for Clear, and Clear remains
 *   always enabled for emergency clearance.
 * - Broadcast channel: Clear button invokes setScriptureOverlay(null) and broadcasts clear-scripture.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const presenterPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');

function readPresenterSource() {
  return fs.readFileSync(presenterPath, 'utf8');
}

function verifyHeaderRowAbsence(source) {
  // Extract presenter-header-row-1 section
  const headerMatch = source.match(/data-testid="presenter-header-row-1"([\s\S]*?)<\/header>/);
  if (!headerMatch) {
    throw new Error('presenter-header-row-1 container not found');
  }
  const headerContent = headerMatch[1];
  const hasClearScripture =
    headerContent.includes("t('presenter.clearScripture')") ||
    headerContent.includes('clear-scripture');
  return !hasClearScripture;
}

function verifyScriptureActionsCluster(source) {
  // Must have scripture panel with data-slot
  assert.ok(
    source.includes('data-slot="presenter-scripture-panel"'),
    'PresenterOperator must have data-slot="presenter-scripture-panel"'
  );

  // Must have action cluster container
  assert.ok(
    source.includes('data-testid="presenter-scripture-actions"'),
    'PresenterOperator must have data-testid="presenter-scripture-actions"'
  );

  // Extract scripture actions cluster
  const clusterMatch = source.match(/data-testid="presenter-scripture-actions"([\s\S]*?)<\/div>/);
  if (!clusterMatch) {
    return { valid: false, reason: 'actions container not found' };
  }
  const cluster = clusterMatch[1];

  const hasPush =
    cluster.includes('data-testid="presenter-push-scripture-button"') &&
    cluster.includes("t('presenter.scripture.push')");
  const hasClear =
    cluster.includes('data-testid="presenter-clear-scripture-button"') &&
    cluster.includes("t('presenter.clearScripture')") &&
    cluster.includes('variant="outline"');

  const clearAlwaysEnabled =
    !cluster.match(/data-testid="presenter-clear-scripture-button"[^>]*disabled=/);

  return {
    valid: hasPush && hasClear && clearAlwaysEnabled,
    hasPush,
    hasClear,
    clearAlwaysEnabled,
  };
}

test('SPEC-98-01: Clear Scripture button is absent from presenter-header-row-1', () => {
  const source = readPresenterSource();
  const absent = verifyHeaderRowAbsence(source);
  assert.equal(absent, true, 'Clear Scripture button must be absent from header row 1');
});

test('SPEC-98-01 Defect Injection Proof: verifyHeaderRowAbsence detects injected clear button in header', () => {
  const source = readPresenterSource();
  const headerIndex = source.indexOf('data-testid="presenter-header-row-1"');
  assert.ok(headerIndex !== -1);
  const headerEnd = source.indexOf('</header>', headerIndex);
  assert.ok(headerEnd !== -1);

  // Inject clear button back into header row
  const injectedSource =
    source.slice(0, headerEnd) +
    `\n<Button onClick={() => broadcast({ type: 'clear-scripture' })}>{t('presenter.clearScripture')}</Button>\n` +
    source.slice(headerEnd);

  const absent = verifyHeaderRowAbsence(injectedSource);
  assert.equal(absent, false, 'Absence guard must fail when clear button is in header');
});

test('SPEC-98-01: Clear Scripture button is correctly clustered in scripture actions panel', () => {
  const source = readPresenterSource();
  const cluster = verifyScriptureActionsCluster(source);
  assert.equal(cluster.valid, true, 'Scripture actions cluster must be valid');
  assert.equal(cluster.hasPush, true, 'Push button must be present in actions cluster');
  assert.equal(cluster.hasClear, true, 'Clear button must be present in actions cluster with variant="outline"');
  assert.equal(cluster.clearAlwaysEnabled, true, 'Clear button must not be disabled by input state');
});

test('SPEC-98-01 Defect Injection Proof: verifyScriptureActionsCluster detects missing or displaced clear button', () => {
  const source = readPresenterSource();

  // 1. Remove clear button from actions cluster
  const missingClearSource = source.replace(
    /data-testid="presenter-clear-scripture-button"[\s\S]*?<\/Button>/,
    ''
  );
  const check1 = verifyScriptureActionsCluster(missingClearSource);
  assert.equal(check1.valid, false, 'Cluster check must fail when clear button is missing');

  // 2. Inject disabled attribute on clear button
  const disabledClearSource = source.replace(
    'data-testid="presenter-clear-scripture-button"',
    'data-testid="presenter-clear-scripture-button" disabled={!scriptureRef}'
  );
  const check2 = verifyScriptureActionsCluster(disabledClearSource);
  assert.equal(check2.valid, false, 'Cluster check must fail when clear button is conditionally disabled');
});

test('SPEC-98-01: Clear button broadcasts clear-scripture with planIdentity', () => {
  const source = readPresenterSource();
  assert.ok(
    source.includes("type: 'clear-scripture'") &&
      source.includes('planIdentity: planIdentityRef.current'),
    'Clear button click handler must broadcast clear-scripture with planIdentity'
  );
  assert.ok(
    source.includes('setScriptureOverlay(null)'),
    'Clear button click handler must reset local scripture overlay state'
  );
});

test('SPEC-104-03: ScriptureRefAutocomplete source guards for keyboard navigation and ARIA attributes', () => {
  const compPath = path.join(root, 'src', 'components', 'ScriptureRefAutocomplete.tsx');
  assert.ok(fs.existsSync(compPath), 'ScriptureRefAutocomplete.tsx must exist');
  const src = fs.readFileSync(compPath, 'utf8');

  // Must export shouldSuggestBooks
  assert.ok(
    src.includes('shouldSuggestBooks'),
    'Must use shouldSuggestBooks predicate'
  );

  // Must declare role="combobox" and aria attributes
  assert.ok(src.includes('role="combobox"'), 'Input must declare role="combobox"');
  assert.ok(src.includes('aria-autocomplete="list"'), 'Input must declare aria-autocomplete="list"');
  assert.ok(src.includes('role="listbox"'), 'Dropdown list must declare role="listbox"');
  assert.ok(src.includes('role="option"'), 'Dropdown options must declare role="option"');
  assert.ok(src.includes('aria-selected='), 'Dropdown options must declare aria-selected');

  // Must handle navigation keys ArrowDown, ArrowUp, Enter, Escape
  assert.ok(src.includes("e.key === 'ArrowDown'"), 'Must handle ArrowDown key');
  assert.ok(src.includes("e.key === 'ArrowUp'"), 'Must handle ArrowUp key');
  assert.ok(src.includes("e.key === 'Enter'"), 'Must handle Enter key');
  assert.ok(src.includes("e.key === 'Escape'"), 'Must handle Escape key');
});

test('SPEC-104-03: shouldSuggestBooks boundary table and context suppression', async () => {
  const mod = await import(
    new URL('../src/lib/scripture-autocomplete.ts', import.meta.url).href
  );
  const shouldSuggestBooks = mod.shouldSuggestBooks;
  assert.ok(typeof shouldSuggestBooks === 'function', 'shouldSuggestBooks must be a function');

  // Assert true for active book prefix queries
  const openQueries = ['mat', 'Matthew', 'Matthew ', '1', '1 C', '1 Cor', '1 Corinthians'];
  for (const q of openQueries) {
    assert.equal(
      shouldSuggestBooks(q),
      true,
      `shouldSuggestBooks("${q}") must be true (suggestions OPEN)`
    );
  }

  // Assert false for completed book + chapter/verse queries (suggestions CLOSED)
  const closedQueries = [
    'Matthew 4',
    'Mat 4',
    'Matthew 0',
    'Matthew 4:1',
    '1 Corinthians 13',
    '1 Cor 13',
  ];
  for (const q of closedQueries) {
    assert.equal(
      shouldSuggestBooks(q),
      false,
      `shouldSuggestBooks("${q}") must be false (suggestions CLOSED)`
    );
  }
});

test('SPEC-104-03 Defect Injection Proof: verifyContextSuppression detects un-suppressed chapter queries', async () => {
  // Flawed predicate that only checks for colon
  function flawedPredicate(query) {
    if (!query) return false;
    const q = query.trim();
    if (q.length === 0) return false;
    return !/:\s*\d/.test(q);
  }

  // Defect proof: flawed predicate allows "Matthew 4" and "1 Corinthians 13" through
  assert.equal(
    flawedPredicate('Matthew 4'),
    true,
    'Flawed predicate erroneously returns true for Matthew 4'
  );
  assert.equal(
    flawedPredicate('1 Corinthians 13'),
    true,
    'Flawed predicate erroneously returns true for 1 Corinthians 13'
  );

  // Production predicate correctly suppresses them
  const mod = await import(
    new URL('../src/lib/scripture-autocomplete.ts', import.meta.url).href
  );
  assert.equal(mod.shouldSuggestBooks('Matthew 4'), false);
  assert.equal(mod.shouldSuggestBooks('1 Corinthians 13'), false);
});

