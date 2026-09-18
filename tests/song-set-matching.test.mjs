import test from 'node:test';
import assert from 'node:assert/strict';

test('SPEC-44-04: 3-pass song set matching algorithm matches labels, positions, and detects overflow', async () => {
  const { matchSongSets } = await import('../src/lib/song-set-matching.ts');

  const slots = [
    { variableName: 'ds_opening_song', title: 'Opening Song', position: 1 },
    { variableName: 'praise_song_1', title: 'Praise 1', position: 2 },
    { variableName: 'praise_song_2', title: 'Praise 2', position: 3 },
    { variableName: 'praise_song_3', title: 'Praise 3', position: 4 },
    { variableName: 'ds_closing_song', title: 'Closing Song', position: 5 },
  ];

  const candidates = [
    { line: 'Opening Song: SDAH 100', bookCode: 'SDAH', number: 100, title: 'Great Is Thy Faithfulness', lyrics: 'Verse 1' },
    { line: 'Praise 1: SDAH 159', bookCode: 'SDAH', number: 159, title: 'Praise to the Lord', lyrics: 'Verse 1' },
    { line: 'Praise 2: Hymn 250', bookCode: 'SDAH', number: 250, title: 'Faith of Our Fathers', lyrics: 'Verse 1' },
    { line: 'Closing Song: SDAH 1', bookCode: 'SDAH', number: 1, title: 'Praise God', lyrics: 'Verse 1' },
  ];

  const result = matchSongSets(candidates, slots, {
    label_slots: [
      { label: 'Opening Song', target: 'ds_opening_song' },
      { label: 'Closing Song', target: 'ds_closing_song' },
    ],
    slot_family_prefix: 'praise_song',
  });

  // Pass 1: Label match
  assert.equal(result.suggestions['ds_opening_song']?.songNumber, 100);
  assert.equal(result.suggestions['ds_opening_song']?.matchKind, 'label');
  assert.equal(result.suggestions['ds_closing_song']?.songNumber, 1);
  assert.equal(result.suggestions['ds_closing_song']?.matchKind, 'label');

  // Pass 2: Positional match
  assert.equal(result.suggestions['praise_song_1']?.songNumber, 159);
  assert.equal(result.suggestions['praise_song_1']?.matchKind, 'positional');
  assert.equal(result.suggestions['praise_song_2']?.songNumber, 250);
  assert.equal(result.suggestions['praise_song_2']?.matchKind, 'positional');

  // Pass 3: Overflow & unfilled
  assert.equal(result.songOverflow.length, 0);
  assert.deepEqual(result.songSlotsUnfilled, ['praise_song_3']);
});

test('SPEC-44-04: Executable Absence Guard & defect injection for unfilled song slot omission', async () => {
  const { matchSongSets } = await import('../src/lib/song-set-matching.ts');

  const slots = [
    { variableName: 'praise_song_1', title: 'Praise 1', position: 1 },
    { variableName: 'praise_song_2', title: 'Praise 2', position: 2 },
  ];
  const candidates = [
    { line: 'Praise 1: SDAH 100', bookCode: 'SDAH', number: 100, title: 'Song 1', lyrics: 'L1' },
  ];

  const result = matchSongSets(candidates, slots);
  assert.deepEqual(result.songSlotsUnfilled, ['praise_song_2']);

  // Absence guard: assert that unfilled slot praise_song_2 produces zero suggested slides
  const guardCheck = (suggestions, unfilledList) => {
    for (const unfilled of unfilledList) {
      if (suggestions[unfilled] !== undefined) {
        throw new Error(`Absence guard violation: unfilled slot ${unfilled} produced a slide suggestion`);
      }
    }
    return true;
  };

  assert.equal(guardCheck(result.suggestions, result.songSlotsUnfilled), true);

  // Defect injection: inject a bogus suggestion for praise_song_2 and prove guard failure
  const defectiveSuggestions = {
    ...result.suggestions,
    praise_song_2: {
      variableName: 'praise_song_2',
      songNumber: 999,
      songBookCode: 'SDAH',
      title: 'Defective Ghost Song',
      lyrics: '',
      sourceLine: '',
      matchKind: 'positional',
    },
  };

  assert.throws(
    () => guardCheck(defectiveSuggestions, result.songSlotsUnfilled),
    /Absence guard violation: unfilled slot praise_song_2/
  );
});
