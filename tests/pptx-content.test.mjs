/**
 * End-to-end deck content: every weekly value the rundown supplies must survive
 * hydration and land as visible text in the generated PPTX.
 *
 * This is the regression net for placeholder bindings. Unit tests that only
 * inspect the legacy `title` / `subtitle` projection stay green even when a
 * template declares a placeholder that no element binds — which is exactly how
 * the verse-reading citation, the special-song performer and the welcome date
 * silently vanished from real decks.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pptx-content-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
delete process.env.IMAGE_URL_ALLOWLIST;

const srcUrl = (...parts) =>
  pathToFileURL(path.join(root, 'src', ...parts)).href;

const { default: JSZip } = await import(
  pathToFileURL(path.join(root, 'node_modules', 'jszip', 'lib', 'index.js')).href
);
const { parseRundown } = await import(srcUrl('lib', 'parser.ts'));
const { generatePptx } = await import(srcUrl('lib', 'pptx.ts'));
const { buildSlidePlan } = await import(srcUrl('lib', 'slide-plan.ts'));

const SERVICE_DATE = '2026-07-11';

const WEEKLY = {
  verseReference: 'Romans 12:2, NKJV',
  verseText: 'Do not be conformed to this world, but be transformed.',
  performer: 'The Sanjaya Family Quartet',
  sermonTitle: 'Rooted And Rising',
  sermonSpeaker: 'Ps. Timotius Wicaksana',
  closingPrayerPerson: 'Mr. Tirta Baskara',
  hymnTitle: 'The Old Rugged Cross',
  hymnLyric: 'On a hill far away stood an old rugged cross',
  familyPrayer: 'Pray for the Prasetya family as they move house',
  youthPrayer: 'Pray for the youth camp in Lembang',
};

/** Sample rundown + every weekly value the fixed placeholder paths consume. */
function weeklyRundown() {
  const parsed = parseRundown(
    fs.readFileSync(path.join(__dirname, 'fixtures', 'sample-rundown.txt'), 'utf8')
  );

  // The temp DB has no hymnal, so give the Bible Talk opening hymn real content.
  parsed.items = parsed.items.map((item) =>
    item.type === 'hymn' && item.number === 159
      ? {
          ...item,
          title: WEEKLY.hymnTitle,
          lyrics: WEEKLY.hymnLyric,
          incomplete: false,
        }
      : item
  );

  parsed.verseReading = {
    reference: WEEKLY.verseReference,
    text: WEEKLY.verseText,
  };
  parsed.specialSong = WEEKLY.performer;
  parsed.sermon = {
    speaker: WEEKLY.sermonSpeaker,
    title: WEEKLY.sermonTitle,
  };
  parsed.closingPrayerPerson = WEEKLY.closingPrayerPerson;
  parsed.familyPrayerRequest = WEEKLY.familyPrayer;
  parsed.youthPrayerRequest = WEEKLY.youthPrayer;
  parsed.familyYouth = null;
  return parsed;
}

const parsed = weeklyRundown();
const plan = buildSlidePlan(SERVICE_DATE, parsed, []);
const buffer = await generatePptx(SERVICE_DATE, parsed, []);
const zip = await JSZip.loadAsync(buffer);

function decodeXmlText(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, '&');
}

/** Visible text runs of one slide part, joined for logical visible text. */
async function slideText(slideId) {
  const index = plan.findIndex((s) => s.id === slideId);
  assert.ok(index >= 0, `plan has no slide "${slideId}"`);
  const file = zip.file(`ppt/slides/slide${index + 1}.xml`);
  assert.ok(file, `deck has no part for slide "${slideId}"`);
  const xml = await file.async('string');
  return [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)]
    .map((m) => decodeXmlText(m[1]))
    .join(' ');
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

test('deck slide parts line up 1:1 with the planned slides', () => {
  const slides = Object.keys(zip.files).filter((n) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(n)
  );
  assert.equal(slides.length, plan.length);
});

test('verse reading prints the rundown citation, never a baked-in one', async () => {
  const text = await slideText('verse-reading');
  assert.ok(
    text.includes(WEEKLY.verseReference),
    `verse-reading slide is missing "${WEEKLY.verseReference}"`
  );
  assert.ok(text.includes(WEEKLY.verseText));
  assert.ok(
    !text.includes('1 Corinthians 1:10'),
    'verse-reading still carries the hard-coded sample citation'
  );
});

test('special song prints the performer under the title', async () => {
  const text = await slideText('special-song');
  assert.ok(text.includes('Special Song'));
  assert.ok(
    text.includes(WEEKLY.performer),
    `special-song slide is missing "${WEEKLY.performer}"`
  );
});

test('sermon prints both title and speaker', async () => {
  const text = await slideText('sermon');
  assert.ok(text.includes(WEEKLY.sermonTitle));
  assert.ok(text.includes(WEEKLY.sermonSpeaker));
});

test('closing prayer prints the person leading it', async () => {
  const text = await slideText('ds-closing-prayer');
  assert.ok(text.includes('Closing'));
  assert.ok(
    text.includes(WEEKLY.closingPrayerPerson),
    `ds-closing-prayer slide is missing "${WEEKLY.closingPrayerPerson}"`
  );
});

test('welcome prints the service date', async () => {
  const text = await slideText('welcome');
  assert.ok(text.includes('BANDUNG INTERNATIONAL COMMUNITY'));
  assert.ok(
    text.includes(SERVICE_DATE),
    `welcome slide is missing the service date "${SERVICE_DATE}"`
  );
});

test('song set prints the hymn title and its lyrics', async () => {
  const title = await slideText('bt-opening-title');
  assert.ok(title.includes(WEEKLY.hymnTitle));
  assert.ok(title.includes('SDAH 159'));

  const lyric = await slideText('bt-opening-lyric-1');
  assert.ok(
    lyric.includes(WEEKLY.hymnLyric),
    `bt-opening-lyric-1 is missing "${WEEKLY.hymnLyric}"`
  );
});

test('family & youth prayer requests each render exactly once', async () => {
  const text = await slideText('family-youth');
  assert.equal(
    countOccurrences(text, WEEKLY.familyPrayer),
    1,
    'family prayer request must render exactly once'
  );
  assert.equal(
    countOccurrences(text, WEEKLY.youthPrayer),
    1,
    'youth prayer request must render exactly once'
  );
  assert.equal(countOccurrences(text, 'Prayer Request:'), 2);
});

test('offering legacy lines read in visual order without repeating the title', async () => {
  const offering = plan.find((s) => s.id === 'offering-tithe');
  assert.deepEqual(offering.lines, [
    'Bank Mandiri',
    '1234567890123',
    'Gereja Masehi Advent Hari Ketujuh BIC',
  ]);
  assert.ok(!offering.lines.includes(offering.title));

  // The drawn slide keeps every line; only the legacy projection drops the title.
  const text = await slideText('offering-tithe');
  assert.ok(text.includes('Offering & Tithe'));
  for (const line of offering.lines) assert.ok(text.includes(line));
});
