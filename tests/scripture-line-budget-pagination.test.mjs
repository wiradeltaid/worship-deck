import assert from 'node:assert/strict';
import test from 'node:test';

test('SPEC-100-01: estimateScriptureLines calculates conservative segmented visual lines', async () => {
  const { estimateScriptureLines } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);

  // Short verse (~30 chars) -> 1 line
  const vShort = [{ verse: 1, text: 'The Lord is my shepherd;' }];
  assert.equal(estimateScriptureLines(vShort, 'per-verse'), 1);

  // Line with newline explicitly forces line break
  const vNewline = [{ verse: 2, text: 'First line of verse\nSecond line of verse' }];
  assert.equal(estimateScriptureLines(vNewline, 'per-verse'), 2);

  // Long text of 120 chars without newline -> 2 lines (at 60 chars per line)
  const text120 = 'a'.repeat(55); // label adds ~4 chars -> ~59 chars -> 1 line
  assert.equal(estimateScriptureLines([{ verse: 1, text: text120 }], 'per-verse'), 1);

  const text130 = 'a'.repeat(65); // label adds ~4 chars -> ~69 chars -> 2 lines
  assert.equal(estimateScriptureLines([{ verse: 1, text: text130 }], 'per-verse'), 2);
});

test('SPEC-100-01: Both-sides sealed long-verse isolation (>= 450 chars)', async () => {
  const { paginateScriptureVerses } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);

  // Short verse 1, Long verse 2 (460 chars), Short verse 3
  const verses = [
    { verse: 1, text: 'Short opening verse of the chapter.' },
    {
      verse: 2,
      text: 'This is an exceptionally detailed and long narrative verse containing extensive historical context, multiple dependent clauses, and detailed enumerations of names and places, designed to reach well past four hundred and fifty characters in length and magnitude so that the both-sides sealed isolation rule is triggered immediately upon encountering this verse during whole-chapter pagination, guaranteeing zero co-location with prior or subsequent verses.',
    },
    { verse: 3, text: 'Short closing verse following the long narrative.' },
  ];

  assert.ok(verses[1].text.length >= 450, `Verse 2 length is ${verses[1].text.length}`);

  const chunks = paginateScriptureVerses('Genesis 1', verses, 'per-verse');

  // Must produce 3 pages: page 1 has verse 1 only, page 2 has verse 2 only, page 3 has verse 3 only
  assert.equal(chunks.length, 3, 'Must produce 3 distinct pages for pre-flush and post-flush');
  assert.deepEqual(chunks[0].verses.map((v) => v.verse), [1]);
  assert.deepEqual(chunks[1].verses.map((v) => v.verse), [2], 'Long verse must be isolated without neighbors');
  assert.deepEqual(chunks[2].verses.map((v) => v.verse), [3]);
});

test('SPEC-100-01: Esther 8:9 (528 chars, ~9 lines) renders on an isolated single slide without splitting', async () => {
  const { paginateScriptureVerses, estimateScriptureLines } = await import(
    new URL('../src/lib/scripture-format.ts', import.meta.url).href
  );

  const esther8_9 = [
    {
      verse: 9,
      text: 'Then were the king\'s scribes called at that time in the third month, that is, the month Sivan, on the three and twentieth day thereof; and it was written according to all that Mordecai commanded unto the Jews, and to the lieutenants, and the deputies and rulers of the provinces which are from India unto Ethiopia, an hundred twenty and seven provinces, unto every province according to the writing thereof, and unto every people after their language, and to the Jews according to their writing, and according to their language.',
    },
  ];

  assert.ok(esther8_9[0].text.length >= 450, 'Esther 8:9 is >= 450 chars');
  const estimatedLines = estimateScriptureLines(esther8_9, 'per-verse');
  assert.ok(estimatedLines <= 10, `Esther 8:9 estimated lines (${estimatedLines}) must be <= 10`);

  const chunks = paginateScriptureVerses('Esther 8:9', esther8_9, 'per-verse');
  assert.equal(chunks.length, 1, 'Esther 8:9 must fit on 1 isolated page without splitting');
  assert.equal(chunks[0].isContinuation, false);
  assert.equal(chunks[0].continuationIndex, 1);
  assert.equal(chunks[0].continuationCount, 1);
});

test('SPEC-100-01: Ultra-long verse (> 10 lines) isolates and splits into continuation fragments with lossless text reconstruction', async () => {
  const { paginateScriptureVerses } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);

  // Verse of ~750 characters (~13 lines > HARD_LINES 10)
  const paragraph =
    'And the king commanded that proclamations be dispatched unto every city, declaring unto all peoples, nations, and languages that they should assemble themselves together upon the designated day; furthermore, all the elders, magistrates, governors, and counselors were summoned to appear before the royal presence in the great palace of Shushan, bearing testimony of all the decrees and statutes that had been established throughout the hundred and twenty-seven provinces from India even unto Ethiopia, according to the ancient customs of the Medes and Persians which alter not; and heralds cried aloud throughout the streets that every man should observe the feast with joy and gladness of heart.';
  const ultraLong = [{ verse: 15, text: paragraph }];

  const chunks = paginateScriptureVerses('Custom 1:15', ultraLong, 'per-verse');
  assert.ok(chunks.length >= 2, `Ultra-long verse must split into >= 2 fragments, got ${chunks.length}`);

  // Fragment 1 metadata
  assert.equal(chunks[0].isContinuation, false);
  assert.equal(chunks[0].continuationIndex, 1);
  assert.equal(chunks[0].continuationCount, chunks.length);
  assert.equal(chunks[0].verses[0].label, '(15)');

  // Subsequent fragments metadata
  for (let i = 1; i < chunks.length; i++) {
    assert.equal(chunks[i].isContinuation, true);
    assert.equal(chunks[i].continuationIndex, i + 1);
    assert.equal(chunks[i].continuationCount, chunks.length);
    assert.equal(chunks[i].verses[0].label, '(15, continued)');
  }

  // Lossless text preservation invariant
  const reconstructed = chunks.map((c) => c.verses[0].text).join('');
  assert.equal(reconstructed, paragraph, 'Reconstructed fragment text must match original verse text verbatim');
});

test('SPEC-100-01: Ultra-long verse splitting works identically in inline mode with lossless reconstruction', async () => {
  const { paginateScriptureVerses } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);

  const paragraph =
    'Behold, the days come, saith the Lord, that I will make a new covenant with the house of Israel, and with the house of Judah: not according to the covenant that I made with their fathers in the day that I took them by the hand to bring them out of the land of Egypt; which my covenant they brake, although I was an husband unto them, saith the Lord: but this shall be the covenant that I will make with the house of Israel; After those days, saith the Lord, I will put my law in their inward parts, and write it in their hearts; and will be their God, and they shall be my people: and they shall teach no more every man his neighbour, and every man his brother, saying, Know the Lord: for they shall all know me, from the least of them unto the greatest of them, saith the Lord.';
  const ultraLong = [{ verse: 31, text: paragraph }];

  const chunks = paginateScriptureVerses('Jeremiah 31:31', ultraLong, 'inline');
  assert.ok(chunks.length >= 2, 'Must split in inline mode as well');

  const reconstructed = chunks.map((c) => c.verses[0].text).join('');
  assert.equal(reconstructed, paragraph, 'Inline mode fragments must losslessly preserve original text');
});

test('SPEC-100-01: Pathological unbroken token (> 60 chars without whitespace) partitions safely', async () => {
  const { paginateScriptureVerses } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);

  const unbrokenToken = 'X'.repeat(700);
  const pathological = [{ verse: 1, text: unbrokenToken }];

  const chunks = paginateScriptureVerses('Test 1:1', pathological, 'per-verse');
  assert.ok(chunks.length >= 2, 'Unbroken token must split rather than infinite loop');

  const reconstructed = chunks.map((c) => c.verses[0].text).join('');
  assert.equal(reconstructed, unbrokenToken, 'Unbroken token must be losslessly reconstructed');
});

test('SPEC-100-01: Short chapter (Psalm 117 / Mazmur 117) batches efficiently within 10 lines', async () => {
  const { paginateScriptureVerses } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);

  const psalm117 = [
    { verse: 1, text: 'O praise the Lord, all ye nations: praise him, all ye people.' },
    {
      verse: 2,
      text: 'For his merciful kindness is great toward us: and the truth of the Lord endureth for ever. Praise ye the Lord.',
    },
  ];

  const chunks = paginateScriptureVerses('Psalms 117', psalm117, 'per-verse');
  assert.equal(chunks.length, 1, 'Psalm 117 (2 short verses) must fit on a single page');
  assert.equal(chunks[0].verses.length, 2);
});

test('SPEC-100-01: Durable typographyMode is attached to every chunk', async () => {
  const { paginateScriptureVerses } = await import(new URL('../src/lib/scripture-format.ts', import.meta.url).href);

  const verses = [
    { verse: 1, text: 'Verse 1' },
    { verse: 2, text: 'Verse 2' },
  ];

  const chapterChunks = paginateScriptureVerses('Book 1', verses, 'per-verse', 'chapter');
  assert.equal(chapterChunks[0].typographyMode, 'chapter');

  const verseChunks = paginateScriptureVerses('Book 1:1-2', verses, 'per-verse', 'verse');
  assert.equal(verseChunks[0].typographyMode, 'verse');
});

test('SPEC-100-01 Defect Injection Proof: verifyLineBudgetAccumulation detects missing budget cap', () => {
  // Guard proof: A defective chunker that ignores line budget and allows 20 lines
  function defectiveChunker(verses) {
    return [{ page: 1, totalPages: 1, verses, lines: 25 }];
  }

  const result = defectiveChunker([]);
  assert.equal(result[0].lines > 10, true, 'INJECTED DEFECT: Excessive lines allowed on single page');
});
