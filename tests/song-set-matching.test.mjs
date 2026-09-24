import test from 'node:test';
import assert from 'node:assert/strict';

test('SPEC-70-02: matchSongSets retirement and dynamic regex song extraction parity', async () => {
  const songSetModule = await import('../src/lib/song-set-matching.ts');
  const { extractSongSetEntries } = await import('../src/lib/parser-rules.ts');

  // 1. Assert legacy matchSongSets and songOverflow are retired
  assert.equal(typeof songSetModule.matchSongSets, 'undefined', 'matchSongSets must be retired per SPEC-70');

  // 2. Dynamic regex extraction contract
  const slots = [
    { variableName: 'ds_opening_song', title: 'Opening Song', position: 1, extractionRegex: '(?i)Opening\\s*Song:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)' },
    { variableName: 'praise_song_1', title: 'Praise 1', position: 2, extractionRegex: '(?i)Praise\\s*1:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)' },
    { variableName: 'praise_song_2', title: 'Praise 2', position: 3, extractionRegex: '(?i)Praise\\s*2:\\s*(?:SDAH|Hymn)?\\s*#?(?<number>\\d+)' },
    { variableName: 'praise_song_3', title: 'Praise 3', position: 4, extractionRegex: '(?i)Praise\\s*3:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)' },
    { variableName: 'ds_closing_song', title: 'Closing Song', position: 5, extractionRegex: '(?i)Closing\\s*Song:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)' },
  ];

  const rawBulletin = `Opening Song: SDAH 100
Praise 1: SDAH 159
Praise 2: Hymn 250
Closing Song: SDAH 1`;

  const suggestions = extractSongSetEntries(rawBulletin, slots);

  assert.equal(suggestions['ds_opening_song']?.songNumber, 100);
  assert.equal(suggestions['praise_song_1']?.songNumber, 159);
  assert.equal(suggestions['praise_song_2']?.songNumber, 250);
  assert.equal(suggestions['ds_closing_song']?.songNumber, 1);
  assert.equal(suggestions['praise_song_3'], undefined, 'Unfilled slot praise_song_3 must not produce suggestion');
});

test('SPEC-70-02: Executable Absence Guard & defect injection for unfilled song slot omission', async () => {
  const { extractSongSetEntries } = await import('../src/lib/parser-rules.ts');

  const slots = [
    { variableName: 'praise_song_1', title: 'Praise 1', position: 1, extractionRegex: '(?i)Praise\\s*1:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)' },
    { variableName: 'praise_song_2', title: 'Praise 2', position: 2, extractionRegex: '(?i)Praise\\s*2:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)' },
  ];
  const rawText = 'Praise 1: SDAH 100';

  const suggestions = extractSongSetEntries(rawText, slots);
  assert.equal(suggestions['praise_song_1']?.songNumber, 100);
  assert.equal(suggestions['praise_song_2'], undefined);

  // Absence guard: assert that unfilled slot praise_song_2 produces zero suggested slides
  const guardCheck = (sugs, unfilledSlot) => {
    if (sugs[unfilledSlot] !== undefined) {
      throw new Error(`Absence guard violation: unfilled slot ${unfilledSlot} produced a slide suggestion`);
    }
    return true;
  };

  assert.equal(guardCheck(suggestions, 'praise_song_2'), true);

  // Defect injection: inject a bogus suggestion for praise_song_2 and prove guard failure
  const defectiveSuggestions = {
    ...suggestions,
    praise_song_2: {
      variableName: 'praise_song_2',
      songNumber: 999,
      songBookCode: 'SDAH',
      title: 'Defective Ghost Song',
      lyrics: '',
    },
  };

  assert.throws(
    () => guardCheck(defectiveSuggestions, 'praise_song_2'),
    /Absence guard violation: unfilled slot praise_song_2/
  );
});
