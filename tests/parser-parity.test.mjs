import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('SPEC-44-03: TypeScript parser engine evaluates synthetic golden fixtures accurately', async () => {
  const { parseRundownWithProfile } = await import('../src/lib/parser.ts');
  const fixturesDir = path.join(rootDir, 'tests', 'fixtures', 'parser-profiles');
  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));

  assert.ok(files.length >= 3, `expected at least 3 golden fixtures, found ${files.length}`);

  for (const file of files) {
    const filePath = path.join(fixturesDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const { rundown, profile, expected } = content;

    const parsed = parseRundownWithProfile(rundown, profile);

    if (expected.date !== undefined) {
      assert.equal(parsed.date, expected.date, `${file}: date mismatch`);
    }
    if (expected.sermon_speaker !== undefined) {
      assert.equal(parsed.sermon?.speaker, expected.sermon_speaker, `${file}: sermon speaker mismatch`);
    }
    if (expected.sermon_title !== undefined) {
      assert.equal(parsed.sermon?.title, expected.sermon_title, `${file}: sermon title mismatch`);
    }
    if (expected.theme_verse_ref !== undefined) {
      assert.equal(parsed.themeVerse?.reference, expected.theme_verse_ref, `${file}: theme verse reference mismatch`);
    }
    if (expected.verse_reading_ref !== undefined) {
      assert.equal(parsed.verseReading?.reference, expected.verse_reading_ref, `${file}: verse reading reference mismatch`);
    }
    if (expected.special_song !== undefined) {
      assert.equal(parsed.specialSong, expected.special_song, `${file}: special song mismatch`);
    }
    if (expected.closing_prayer_person !== undefined) {
      assert.equal(parsed.closingPrayerPerson, expected.closing_prayer_person, `${file}: closing prayer person mismatch`);
    }
    if (expected.hymn_numbers !== undefined) {
      const extractedNumbers = (parsed.items ?? [])
        .filter((it) => it.type === 'hymn')
        .map((it) => it.number);
      assert.deepEqual(extractedNumbers, expected.hymn_numbers, `${file}: hymn numbers mismatch`);
    }
    if (expected.unmapped_lines !== undefined) {
      assert.deepEqual(parsed.unmappedLines, expected.unmapped_lines, `${file}: unmapped lines mismatch`);
    }
  }
});
