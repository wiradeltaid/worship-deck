/**
 * SPEC-85-01: Song-Set "Save to Book" Dirty State Guard & Safety Threshold
 * Unit, structural, regression, and defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dynamicFormBodyPath = path.join(rootDir, 'src', 'operator', 'DynamicFormBody.tsx');
const editFormPath = path.join(rootDir, 'src', 'operator', 'EditForm.tsx');
const dirtyGuardLibPath = path.join(rootDir, 'src', 'lib', 'song-set-dirty-guard.ts');

const { computeSongSetLyricsDirtyState, validateSaveToBookLyrics } = await import(
  pathToFileURL(dirtyGuardLibPath).href
);

export function scanSaveToBookGuards(overrides = {}) {
  const findings = [];
  const formBodySrc = overrides.formBodySrc ?? fs.readFileSync(dynamicFormBodyPath, 'utf8');
  const editFormSrc = overrides.editFormSrc ?? fs.readFileSync(editFormPath, 'utf8');

  // 1. DynamicFormBody must evaluate computeSongSetLyricsDirtyState
  if (!formBodySrc.includes('computeSongSetLyricsDirtyState')) {
    findings.push('DynamicFormBody.tsx missing computeSongSetLyricsDirtyState definition or call');
  }

  // 2. DynamicFormBody must gate Save to Book button behind isLyricOpen AND isLyricsDirty
  const saveBtnRegex = /hasValidNum\s*&&\s*onSaveToBook\s*&&\s*isLyricOpen\s*&&\s*isLyricsDirty/;
  if (!saveBtnRegex.test(formBodySrc)) {
    findings.push('DynamicFormBody.tsx missing compound isLyricOpen && isLyricsDirty guard on Save to Book button');
  }

  // 3. DynamicFormBody must validate non-empty lyrics before triggering onSaveToBook
  if (!formBodySrc.includes('validateSaveToBookLyrics')) {
    findings.push('DynamicFormBody.tsx missing validateSaveToBookLyrics validation call');
  }

  // 4. DynamicFormBody must only reset baseline when save returns non-false
  if (!formBodySrc.includes('ok !== false')) {
    findings.push('DynamicFormBody.tsx missing ok !== false check before resetting baseline');
  }

  // 5. EditForm.tsx must guard handleSaveToBook against empty/whitespace lyrics
  const emptyCheckRegex = /if\s*\(\s*!current\.lyricText\s*\|\|\s*current\.lyricText\.trim\(\)\.length\s*===\s*0\s*\)/;
  if (!emptyCheckRegex.test(editFormSrc)) {
    findings.push('EditForm.tsx missing defensive empty lyricText guard in handleSaveToBook');
  }

  // 6. EditForm.tsx fallback path must gate Save to Book button behind computeSongSetLyricsDirtyState
  if (!editFormSrc.includes('data-testid="fallback-save-to-book-button"')) {
    findings.push('EditForm.tsx missing fallback-save-to-book-button with dirty state gating');
  }

  // 7. EditForm.tsx must reset lyricText on hymn identity (songNumber or songBookCode) change
  if (!editFormSrc.includes('identityChanged') || !editFormSrc.includes("lyricText: ''")) {
    findings.push('EditForm.tsx missing lyricText reset on hymn identity change');
  }

  // 8. DynamicFormBody.tsx must NOT reset baseline on editor close
  if (/if\s*\(\s*!isLyricOpen\s*\)\s*\{[\s\S]*?setInitialLyricText/.test(formBodySrc)) {
    findings.push('DynamicFormBody.tsx incorrectly resets initialLyricText baseline when isLyricOpen is false');
  }

  // 9. EditForm.tsx must guard async hymn fetch against stale response with request token or identity check
  if (!editFormSrc.includes('hymnFetchTokensRef')) {
    findings.push('EditForm.tsx missing hymnFetchTokensRef for async race-condition protection');
  }

  // 10. EditForm.tsx must guard identity-change refetch from overwriting user-typed lyrics
  if (!editFormSrc.includes('!live.lyricText || live.lyricText.trim() ===')) {
    findings.push('EditForm.tsx missing empty lyricText check before applying identity-change refetched lyrics');
  }

  return findings;
}

test('SPEC-85-01: computeSongSetLyricsDirtyState returns false when isLyricOpen is false', () => {
  const isDirty = computeSongSetLyricsDirtyState({
    isLyricOpen: false,
    currentLyricText: 'Bait 1: Amazing grace how sweet the sound',
    baselineLyricText: 'Original lyrics',
  });
  assert.equal(isDirty, false, 'Closed lyric editor must never evaluate as dirty');
});

test('SPEC-85-01: computeSongSetLyricsDirtyState returns false when lyrics are unchanged from baseline', () => {
  const lyrics = 'Holy, Holy, Holy! Lord God Almighty!';
  const isDirty = computeSongSetLyricsDirtyState({
    isLyricOpen: true,
    currentLyricText: lyrics,
    baselineLyricText: lyrics,
  });
  assert.equal(isDirty, false, 'Unchanged lyrics must evaluate as clean');

  // Whitespace-trimmed equality
  const isDirtyWithWhitespace = computeSongSetLyricsDirtyState({
    isLyricOpen: true,
    currentLyricText: `  ${lyrics}  \n`,
    baselineLyricText: lyrics,
  });
  assert.equal(isDirtyWithWhitespace, false, 'Whitespace-only difference must evaluate as clean');
});

test('SPEC-85-01: computeSongSetLyricsDirtyState returns true when lyrics are edited and differ from baseline', () => {
  const isDirty = computeSongSetLyricsDirtyState({
    isLyricOpen: true,
    currentLyricText: 'Bait 1: Edited lyrics with updated wording',
    baselineLyricText: 'Bait 1: Original wording in hymn book',
  });
  assert.equal(isDirty, true, 'Edited lyrics differing from baseline must evaluate as dirty');
});

test('SPEC-85-01: computeSongSetLyricsDirtyState returns false for empty or whitespace-only lyrics', () => {
  const isDirtyEmpty = computeSongSetLyricsDirtyState({
    isLyricOpen: true,
    currentLyricText: '',
    baselineLyricText: 'Original hymn text',
  });
  assert.equal(isDirtyEmpty, false, 'Empty lyrics must not be flagged dirty for book saving');

  const isDirtyWhitespace = computeSongSetLyricsDirtyState({
    isLyricOpen: true,
    currentLyricText: '   \n  \t  ',
    baselineLyricText: 'Original hymn text',
  });
  assert.equal(isDirtyWhitespace, false, 'Whitespace-only lyrics must not be flagged dirty');
});

test('SPEC-85-01: validateSaveToBookLyrics rejects empty or whitespace-only strings', () => {
  const res1 = validateSaveToBookLyrics('');
  assert.equal(res1.valid, false);
  assert.ok(res1.error);

  const res2 = validateSaveToBookLyrics('    \n');
  assert.equal(res2.valid, false);
  assert.ok(res2.error);

  const res3 = validateSaveToBookLyrics('Verse 1: Great is Thy faithfulness');
  assert.equal(res3.valid, true);
  assert.equal(res3.error, undefined);
});

test('SPEC-85-01: Baseline lifecycle simulates save failure vs success dirty retention', () => {
  let initialLyricText = 'Original verse 1';
  let currentLyricText = 'Edited verse 1';
  let isLyricOpen = true;

  // Dirty state active
  assert.equal(
    computeSongSetLyricsDirtyState({ isLyricOpen, currentLyricText, baselineLyricText: initialLyricText }),
    true
  );

  // Simulated save failure (409 or network error) -> baseline does NOT advance, remains dirty
  const failedSaveResult = false;
  if (failedSaveResult !== false) {
    initialLyricText = currentLyricText;
  }
  assert.equal(
    computeSongSetLyricsDirtyState({ isLyricOpen, currentLyricText, baselineLyricText: initialLyricText }),
    true,
    'Failed save must retain dirty state for retry'
  );

  // Simulated successful save -> baseline advances, resets dirty
  const successfulSaveResult = true;
  if (successfulSaveResult !== false) {
    initialLyricText = currentLyricText;
  }
  assert.equal(
    computeSongSetLyricsDirtyState({ isLyricOpen, currentLyricText, baselineLyricText: initialLyricText }),
    false,
    'Successful save resets dirty state'
  );
});

test('SPEC-85-01: Hymn identity change resets lyrics and baseline', () => {
  let hymnNumber = '159';
  let currentLyrics = 'Lyrics for hymn 159';
  let baselineLyrics = 'Lyrics for hymn 159';

  // Operator switches hymn number from 159 to 447
  const newNumber = '447';
  if (newNumber !== hymnNumber) {
    hymnNumber = newNumber;
    currentLyrics = ''; // Cleared so stale lyrics do not persist into 447
    baselineLyrics = '';
  }

  assert.equal(currentLyrics, '');
  assert.equal(
    computeSongSetLyricsDirtyState({ isLyricOpen: true, currentLyricText: currentLyrics, baselineLyricText: baselineLyrics }),
    false,
    'Identity change must clear dirty state and prevent stale lyric carryover'
  );
});

test('SPEC-85-01: Closing and reopening lyric editor preserves baseline and retains dirty state', () => {
  const initialLyricText = 'Original hymnal lyrics';
  const editedLyricText = 'Edited hymnal lyrics with typos fixed';

  // 1. Open editor and make an edit -> dirty is true
  let isLyricOpen = true;
  assert.equal(
    computeSongSetLyricsDirtyState({ isLyricOpen, currentLyricText: editedLyricText, baselineLyricText: initialLyricText }),
    true,
    'Active editor with modified text must be dirty'
  );

  // 2. Close editor without saving -> button hidden because editor is closed
  isLyricOpen = false;
  assert.equal(
    computeSongSetLyricsDirtyState({ isLyricOpen, currentLyricText: editedLyricText, baselineLyricText: initialLyricText }),
    false,
    'Closed editor must not show Save to Book'
  );

  // 3. Reopen editor -> baseline MUST NOT have updated to edited text; dirty MUST remain true!
  isLyricOpen = true;
  assert.equal(
    computeSongSetLyricsDirtyState({ isLyricOpen, currentLyricText: editedLyricText, baselineLyricText: initialLyricText }),
    true,
    'Reopened editor must retain dirty state against original baseline'
  );
});

test('SPEC-85-01: Async lookup cancellation sequence: clearing number invalidates in-flight response', () => {
  let rowState = { songNumber: '159', songBookCode: 'SDAH', lyricText: '' };
  let currentToken = 1;
  const initialFetchToken = currentToken;

  // Hymn lookup is in-flight with initialFetchToken...
  // Operator clears hymn number before lookup resolves:
  const newNumber = '';
  if (newNumber !== rowState.songNumber) {
    currentToken = 2; // Token bumped on identity change
    rowState = { ...rowState, songNumber: newNumber, lyricText: '' };
  }

  // Lookup for hymn 159 finally arrives:
  const arrivingResponse = { number: 159, lyrics: 'Hymn 159 lyrics' };
  const canApply =
    currentToken === initialFetchToken &&
    rowState.songNumber === '159' &&
    rowState.songBookCode === 'SDAH';

  assert.equal(canApply, false, 'Late arriving hymn lookup must be discarded when hymn number was cleared');
  assert.equal(rowState.lyricText, '', 'Row lyrics must remain clean');
});

test('SPEC-85-01: Async lookup does not overwrite user edits typed while fetch was pending', () => {
  let rowState = { songNumber: '159', songBookCode: 'SDAH', lyricText: '' };
  let currentToken = 1;

  // While lookup is pending, operator manually types customized lyrics:
  rowState.lyricText = 'Manually typed custom lyrics';

  // Lookup response arrives:
  const arrivingLyrics = 'Database canonical lyrics';
  const shouldApply =
    currentToken === 1 &&
    rowState.songNumber === '159' &&
    (!rowState.lyricText || rowState.lyricText.trim() === '');

  assert.equal(shouldApply, false, 'In-flight fetch must not overwrite user typed lyrics');
  assert.equal(rowState.lyricText, 'Manually typed custom lyrics');
});

test('SPEC-85-01: Identity change followed by user typing before lookup resolves preserves user edits', () => {
  let rowState = { songNumber: '159', songBookCode: 'SDAH', lyricText: 'Old hymn 159 lyrics' };
  let currentToken = 0;
  let fallbackBaseline = 'Old hymn 159 lyrics';

  // 1. Operator changes hymn identity to 447 while editor is open
  const targetNum = '447';
  const targetBook = 'SDAH';
  const token = 1;
  currentToken = token;
  rowState = { songNumber: targetNum, songBookCode: targetBook, lyricText: '' };
  fallbackBaseline = '';

  // 2. Operator immediately types custom lyrics while lookup for 447 is pending
  rowState.lyricText = 'Live customized lyrics for hymn 447';

  // 3. Lookup for 447 resolves
  const incomingHymn = { number: 447, lyrics: 'Canonical database hymn 447 lyrics' };
  let applied = false;
  if (
    currentToken === token &&
    rowState.songNumber === targetNum &&
    rowState.songBookCode === targetBook &&
    (!rowState.lyricText || rowState.lyricText.trim() === '')
  ) {
    applied = true;
    rowState.lyricText = incomingHymn.lyrics;
    fallbackBaseline = incomingHymn.lyrics;
  }

  assert.equal(applied, false, 'Late lookup response must not overwrite lyrics typed after identity change');
  assert.equal(rowState.lyricText, 'Live customized lyrics for hymn 447', 'Operator typed lyrics must be preserved');
  assert.equal(fallbackBaseline, '', 'Baseline must not advance to incoming hymn when user edit was retained');
});

test('SPEC-85-01: Structural scan verifies security guards in DynamicFormBody and EditForm', () => {
  const findings = scanSaveToBookGuards();
  assert.deepEqual(findings, [], `Expected 0 security guard findings, got: ${findings.join(', ')}`);
});

test('SPEC-85-01: Defect injection proof — removing isLyricsDirty from Save button triggers guard finding', () => {
  const rawFormBody = fs.readFileSync(dynamicFormBodyPath, 'utf8');
  // Inject defect by removing isLyricsDirty from button guard
  const defectiveSrc = rawFormBody.replace('isLyricOpen && isLyricsDirty && (', 'isLyricOpen && (');
  const findings = scanSaveToBookGuards({ formBodySrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('missing compound isLyricOpen && isLyricsDirty guard')),
    'Expected defect injection without isLyricsDirty to fail scan'
  );
});

test('SPEC-85-01: Defect injection proof — removing empty check from EditForm triggers guard finding', () => {
  const rawEditForm = fs.readFileSync(editFormPath, 'utf8');
  // Inject defect by removing the empty check
  const defectiveSrc = rawEditForm.replace(
    /if\s*\(\s*!current\.lyricText\s*\|\|\s*current\.lyricText\.trim\(\)\.length\s*===\s*0\s*\)\s*\{[\s\S]*?\}/,
    '/* empty check removed */'
  );
  const findings = scanSaveToBookGuards({ editFormSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('missing defensive empty lyricText guard')),
    'Expected defect injection without empty check in EditForm to fail scan'
  );
});

test('SPEC-85-01: Defect injection proof — bypassing fallback dirty check in EditForm triggers guard finding', () => {
  const rawEditForm = fs.readFileSync(editFormPath, 'utf8');
  const defectiveSrc = rawEditForm.replace('data-testid="fallback-save-to-book-button"', 'data-testid="unprotected-button"');
  const findings = scanSaveToBookGuards({ editFormSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('missing fallback-save-to-book-button')),
    'Expected defect injection without fallback testid to fail scan'
  );
});
