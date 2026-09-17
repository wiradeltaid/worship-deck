/**
 * Lyric continuous join and DEC-004 Supplement S7 parsing rules (L1–L6).
 * Mirrors internal/plan/lyrics_test.go.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  splitLyricsLabeled,
  splitLyricsIntoSlides,
  lookupHymnByNumber,
  lookupHymnByTitleFuzzy,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'lyrics.ts')).href
);

test('continuous join: terminal punctuation joins with space (when continuousJoin: true)', () => {
  const slides = splitLyricsLabeled(
    `Verse 1
Hope in the coming of the Lord.
We have this faith that Christ alone imparts.`,
    { continuousJoin: true }
  );
  assert.equal(slides.length, 1);
  assert.equal(slides[0].label, '1/1');
  assert.equal(
    slides[0].text,
    'Hope in the coming of the Lord. We have this faith that Christ alone imparts.'
  );
  assert.ok(!slides[0].text.includes('\n'));
});

test('continuous join: punctuation before closing quote joins with space (when continuousJoin: true)', () => {
  const slides = splitLyricsLabeled(
    `Verse 1
He said, "Hope in the Lord."
We trust His Word.`,
    { continuousJoin: true }
  );
  assert.equal(slides.length, 1);
  assert.equal(
    slides[0].text,
    'He said, "Hope in the Lord." We trust His Word.'
  );
});

test('continuous join: no terminal punctuation joins with "; " (when continuousJoin: true)', () => {
  const slides = splitLyricsLabeled(
    `Verse 1
Shall awake and shout and sing
Hallelujah! Christ is King!`,
    { continuousJoin: true }
  );
  assert.equal(slides.length, 1);
  assert.equal(
    slides[0].text,
    'Shall awake and shout and sing; Hallelujah! Christ is King!'
  );
});

// L1: Numbered refrain headers are recognized
test('L1: Reff 1 / Chorus 2 headers are recognized as refrain headers, not lyric lines', () => {
  const slides = splitLyricsLabeled(`Verse 1
Line 1
Reff 1
Refrain 1 text
Verse 2
Line 2
Chorus 2
Refrain 2 text`);
  assert.deepEqual(slides, [
    { label: '1/2', text: 'Line 1' },
    { label: 'Reff', text: 'Refrain 1 text' },
    { label: '2/2', text: 'Line 2' },
    { label: 'Chorus', text: 'Refrain 2 text' },
  ]);
});

// L2: Distinct refrains per verse preserved verbatim
test('L2: two verses each with their own distinct refrain body — both refrains survive verbatim', () => {
  const slides = splitLyricsLabeled(`Verse 1
V1 text
Chorus
Chorus 1 distinct
Verse 2
V2 text
Chorus
Chorus 2 distinct`);
  assert.deepEqual(slides, [
    { label: '1/2', text: 'V1 text' },
    { label: 'Chorus', text: 'Chorus 1 distinct' },
    { label: '2/2', text: 'V2 text' },
    { label: 'Chorus', text: 'Chorus 2 distinct' },
  ]);
});

// L3: Bodyless refrain inherits nearest preceding non-empty refrain
test('L3: bodyless refrain inherits nearest preceding non-empty refrain', () => {
  const slides = splitLyricsLabeled(`Verse 1
V1 text
Chorus
Chorus Alpha
Verse 2
V2 text
Chorus
Verse 3
V3 text
Chorus
Chorus Beta
Verse 4
V4 text
Chorus`);
  assert.deepEqual(slides, [
    { label: '1/4', text: 'V1 text' },
    { label: 'Chorus', text: 'Chorus Alpha' },
    { label: '2/4', text: 'V2 text' },
    { label: 'Chorus', text: 'Chorus Alpha' },
    { label: '3/4', text: 'V3 text' },
    { label: 'Chorus', text: 'Chorus Beta' },
    { label: '4/4', text: 'V4 text' },
    { label: 'Chorus', text: 'Chorus Beta' },
  ]);
});

// L4: Slide order equals written order; no verse->refrain interleaving is invented
test('L4: emitted order equals written order; no verse->refrain interleaving is invented', () => {
  const slides = splitLyricsLabeled(`Verse 1
V1 text
Verse 2
V2 text
Chorus
Chorus text`);
  assert.deepEqual(slides, [
    { label: '1/2', text: 'V1 text' },
    { label: '2/2', text: 'V2 text' },
    { label: 'Chorus', text: 'Chorus text' },
  ]);
});

// L5: A blank line inside one section produces multiple slides
test('L5: a blank line inside one verse produces two slides', () => {
  const slides = splitLyricsLabeled(`Verse 1
Line 1
Line 2

Line 3
Line 4`);
  assert.deepEqual(slides, [
    { label: '1/1', text: 'Line 1\nLine 2' },
    { label: '1/1', text: 'Line 3\nLine 4' },
  ]);
});

// L6: Section far longer than 320 characters with no blank line produces one slide
test('L6: a section far longer than 320 characters with no blank line produces one slide', () => {
  const longLines = Array.from({ length: 15 }, (_, i) => {
    return `Phrase number ${i + 1} with enough words to grow the continuous string`;
  });
  const lyrics = `Verse 1\n${longLines.join('\n')}`;
  const slides = splitLyricsLabeled(lyrics);
  assert.equal(slides.length, 1);
  assert.equal(slides[0].label, '1/1');
  assert.ok(slides[0].text.length > 320, `expected text > 320 chars, got ${slides[0].text.length}`);
});

test('preserveLineBreaks keeps newlines instead of continuous join', () => {
  const slides = splitLyricsLabeled(
    `Verse 1
Shall awake and shout and sing
Hallelujah! Christ is King!`,
    { preserveLineBreaks: true }
  );
  assert.equal(slides.length, 1);
  assert.equal(
    slides[0].text,
    'Shall awake and shout and sing\nHallelujah! Christ is King!'
  );
  assert.ok(!slides[0].text.includes(';'));
});

test('unlabeled fallback: blank-line stanzas with empty label', () => {
  const slides = splitLyricsLabeled(`First stanza line 1
First stanza line 2

Second stanza line 1
Second stanza line 2`);
  assert.deepEqual(slides, [
    { label: '', text: 'First stanza line 1\nFirst stanza line 2' },
    { label: '', text: 'Second stanza line 1\nSecond stanza line 2' },
  ]);
});

test('Smart Poetic Line Break: semicolons and length-balanced breaks', () => {
  const slides = splitLyricsLabeled(`Verse 1
God Himself is with us; Let us all adore Him,
And with awe appear before Him.
Verse 2
Praise to the Lord, the Almighty, the King of creation!`);
  assert.equal(slides.length, 2);
  assert.equal(
    slides[0].text,
    'God Himself is with us;\nLet us all adore Him,\nAnd with awe appear before Him.'
  );
  assert.equal(
    slides[1].text,
    'Praise to the Lord, the Almighty,\nthe King of creation!'
  );
});

test('Smart Poetic Line Break: Rescue the Perishing cadence, preposition, and punctuation breaks', () => {
  const input = `Verse 1
Rescue the perishing,
Care for the dying;
Snatch them in pity from sin and the grave;
Weep o'er the erring one,
Lift up the fallen,
Tell them of Jesus, the mighty to save.`;

  const slides = splitLyricsLabeled(input);
  assert.equal(slides.length, 1);
  const expected = [
    'Rescue the perishing,',
    'Care for the dying;',
    'Snatch them in pity',
    'from sin and the grave;',
    "Weep o'er the erring one,",
    'Lift up the fallen,',
    'Tell them of Jesus,',
    'the mighty to save.',
  ].join('\n');

  assert.equal(slides[0].text, expected);
});

test('splitLyricsIntoSlides returns array of string texts', () => {
  const texts = splitLyricsIntoSlides(`Verse 1
Line 1
Verse 2
Line 2`);
  assert.deepEqual(texts, ['Line 1', 'Line 2']);
});

test('S7 corpus claim: none of the 695 shipped hymns uses numbered refrains or blank lines inside sections', () => {
  const raw = JSON.parse(fs.readFileSync(path.join(root, 'data', 'song-book', 'sdah.json'), 'utf8'));
  const hymns = Array.isArray(raw) ? raw : raw.hymns || raw.songs || Object.values(raw);
  assert.equal(hymns.length, 695);

  for (const h of hymns) {
    const lyrics = h.lyrics || '';
    const lines = lyrics.split(/\r?\n/);
    for (const l of lines) {
      assert.ok(
        !/^(Chorus|Reff|Refrain)\s+\d+/i.test(l.trim()),
        `Hymn #${h.number} has numbered refrain header: "${l}"`
      );
    }

    let inSection = false;
    let hasLinesInSection = false;
    let seenBlank = false;
    for (const rawLine of lines) {
      const trimmed = rawLine.trim();
      if (/^(Verse(\s+\d+)?|Chorus(\s+\d+)?|Reff(\s+\d+)?|Refrain(\s+\d+)?)\s*$/i.test(trimmed)) {
        inSection = true;
        hasLinesInSection = false;
        seenBlank = false;
      } else if (trimmed === '') {
        if (inSection && hasLinesInSection) {
          seenBlank = true;
        }
      } else {
        if (inSection && seenBlank) {
          assert.fail(`Hymn #${h.number} has blank line inside section before line "${trimmed}"`);
        }
        if (inSection) {
          hasLinesInSection = true;
        }
      }
    }
  }

  // Pin SDAH 1 output
  const hymn1 = hymns.find((h) => h.number === 1);
  assert.ok(hymn1);
  const slides = splitLyricsLabeled(hymn1.lyrics);
  assert.equal(slides.length, 3);
  assert.equal(slides[0].label, '1/3');
  assert.equal(slides[1].label, '2/3');
  assert.equal(slides[2].label, '3/3');
});

test('lookupHymnByNumber and lookupHymnByTitleFuzzy resolve on (bookCode, number)', () => {
  const h1 = lookupHymnByNumber(1);
  if (h1) {
    assert.equal(h1.bookCode, 'SDAH');
    assert.equal(h1.number, 1);
  }
  const byTitle = lookupHymnByTitleFuzzy('Praise to the Lord');
  if (byTitle) {
    assert.equal(byTitle.bookCode, 'SDAH');
    assert.equal(byTitle.number, 1);
  }
});
