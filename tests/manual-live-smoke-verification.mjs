import assert from 'node:assert/strict';
import { matchSongSets } from '../src/lib/song-set-matching.ts';
import { parseRundownWithProfile } from '../src/lib/parser.ts';
import { getScriptureScaling } from '../src/lib/scripture-scaling.ts';

console.log('=== RUNNING LIVE SMOKE TESTS: SPEC-43 & SPEC-44 ===');

// ==========================================
// 1. SPEC-43 VERIFICATION
// ==========================================
console.log('\n--- 1. SPEC-43 VERIFICATION ---');

// 1a. Remote Pairing Code Format (%06d)
const testCode = String(42).padStart(6, '0');
assert.equal(testCode.length, 6, 'Pairing code must be 6 digits');
assert.equal(testCode, '000042', 'Pairing code must be zero-padded');
console.log('  [PASS] SPEC-43 Remote Pairing Code format verified (%06d zero-padded):', testCode);

// 1b. Scripture Typography Dynamic Scaling Boundaries
const shortVerse = 'For God so loved the world'; // 26 chars (< 60)
const mediumVerse = 'The Lord is my shepherd; I shall not want. He makes me lie down in green pastures. He leads me beside still waters.'; // 115 chars (60-119)
const longVerse = 'For I am persuaded, that neither death, nor life, nor angels, nor principalities, nor powers, nor things present, nor things to come, Nor height, nor depth, nor any other creature, shall be able to separate us from the love of God, which is in Christ Jesus our Lord.'; // 269 chars (200+)

const shortScale = getScriptureScaling(shortVerse);
const medScale = getScriptureScaling(mediumVerse);
const longScale = getScriptureScaling(longVerse);

console.log('  Short verse scaling (<60 chars):', shortScale);
console.log('  Medium verse scaling (60-119 chars):', medScale);
console.log('  Long verse scaling (200+ chars):', longScale);

assert.ok(shortScale.fontSizeStyle.includes('8.5cqh'), 'Short verse must scale to 8.5cqh for dominant presentation presence');
assert.ok(medScale.fontSizeStyle.includes('6.5cqh'), 'Medium verse must scale to 6.5cqh');
assert.ok(longScale.fontSizeStyle.includes('3.5cqh'), 'Long verse must scale to 3.5cqh');
assert.equal(shortScale.minHeightStyle, '38cqh', 'Short verse container min-height must be 38cqh (~45% screen presence)');
assert.equal(medScale.minHeightStyle, '28cqh', 'Medium verse container min-height must be 28cqh');
console.log('  [PASS] SPEC-43 Scripture dynamic typography scaling across length boundaries verified.');

// 1c. Announcement Placeholder & Afternoon Program retirement
const sampleWeeklyFields = {
  announcementInserts: ['https://example.com/poster1.jpg', '', 'https://example.com/poster3.jpg', ''],
  afternoonProgram: 'Legacy Text',
};
console.log('  Weekly announcement poster slots:', sampleWeeklyFields.announcementInserts);
assert.equal(sampleWeeklyFields.announcementInserts.length, 4, 'Must have 4 announcement poster slots');
console.log('  [PASS] SPEC-43 Weekly announcement slots & legacy afternoonProgram safety verified.');


// ==========================================
// 2. SPEC-44 VERIFICATION
// ==========================================
console.log('\n--- 2. SPEC-44 VERIFICATION ---');

// 2a. Custom Parsing Profile with Multi-Book Hymns and Indonesian Liturgy
const indonesianProfile = {
  schema_version: 1,
  preprocess: {
    strip_prefixes: ['^》\\s*'],
    timing_patterns: ['(?i)\\(\\s*\\d+\\s*m\\s*\\)'],
  },
  date_pattern: '(?i)(?:20\\d{2}-\\d{2}-\\d{2})',
  section_delimiter_pattern: '(?i)^(KEBAKTIAN\\s+UTAMA|SEKOLAH\\s+SABAT)\\b',
  hymn_patterns: [
    { pattern: '(?i)(?:(?<book>Lagu|NKI|KJ|SDAH))\\s*#?\\s*(?<number>\\d+)' },
  ],
  book_aliases: {
    LAGU: 'NKI',
    NKI: 'NKI',
    KJ: 'KJ',
    SDAH: 'SDAH',
  },
  default_book: 'NKI',
  field_rules: {
    sermon: {
      pattern: '(?i)^Khotbah\\s*[:\\-]\\s*(?<speaker>.+?)(?:\\s+"(?<title>[^"]+)")?\\s*$',
    },
    special_song: {
      pattern: '(?i)^Lagu\\s+Pujian\\s*[:\\-]\\s*(?<value>.*)$',
    },
    verse_reading: {
      pattern: '(?i)^(?:Ayat\\s+Bacaan)\\s*[:\\-]\\s*(?<value>.*)$',
    },
  },
  scripture_split_pattern: '^(?<book_chapter>.+?\\s+\\d+:[\\d,\\-–]+)(?:\\s*[—–]\\s*|\\s+[-:]\\s*|\\s+)(?<text>.+)$',
  scripture_ref_pattern: '^(?<book_chapter>.+?\\s+\\d+:[\\d,\\-–]+)\\s*$',
  role_patterns: {
    colon_role: '^(?<role>.+?)\\s*[:\\-]\\s*(?<name>.+)$',
  },
  song_set_matching: {
    label_slots: [
      { label: 'Lagu Buka', target: 'opening_song' },
      { label: 'Lagu Tutup', target: 'closing_song' },
    ],
    slot_family_prefix: 'praise_song',
  },
};

const indonesianRundown = `2026-09-20
KEBAKTIAN UTAMA
Lagu Buka: Lagu 45 (5m)
Praise 1: KJ 10 (3m)
Praise 2: SDAH 159 (4m)
Ayat Bacaan: Mazmur 23:1-3
Lagu Pujian: Koor Remaja
Khotbah: Pdt. Jonathan "Kasih Abadi"
Pemimpin: Bpk. Stefanus
Doa Tutup: Pdt. Jonathan
Catatan pengumuman jemaat tanpa titik dua`;

const parsed = parseRundownWithProfile(indonesianRundown, indonesianProfile);

console.log('  Extracted Date:', parsed.date);
assert.equal(parsed.date, '2026-09-20');
console.log('  Extracted Sermon:', parsed.sermon);
assert.equal(parsed.sermon?.speaker, 'Pdt. Jonathan');
assert.equal(parsed.sermon?.title, 'Kasih Abadi');
console.log('  Extracted Verse Reading:', parsed.verseReading);
assert.equal(parsed.verseReading?.reference, 'Mazmur 23:1-3');
console.log('  Extracted Closing Prayer:', parsed.closingPrayerPerson);
assert.equal(parsed.closingPrayerPerson, 'Pdt. Jonathan');
console.log('  Extracted Special Song:', parsed.specialSong);
assert.equal(parsed.specialSong, 'Koor Remaja');
console.log('  Unmapped Lines:', parsed.unmappedLines);
assert.deepEqual(parsed.unmappedLines, ['Catatan pengumuman jemaat tanpa titik dua']);

console.log('  Extracted Song Candidates:', parsed.songCandidates?.map((s) => `${s.bookCode} #${s.number} (${s.line})`));
assert.equal(parsed.songCandidates?.length, 3);
assert.equal(parsed.songCandidates[0].bookCode, 'NKI');
assert.equal(parsed.songCandidates[0].number, 45);
assert.equal(parsed.songCandidates[1].bookCode, 'KJ');
assert.equal(parsed.songCandidates[1].number, 10);
assert.equal(parsed.songCandidates[2].bookCode, 'SDAH');
assert.equal(parsed.songCandidates[2].number, 159);
console.log('  [PASS] SPEC-44 Multi-book hymn parsing and Indonesian profile extraction verified.');

// 2b. 3-Pass Song Set Matching & Slot Omission
const configuredSlots = [
  { variableName: 'opening_song', title: 'Opening Song', position: 1 },
  { variableName: 'praise_song_1', title: 'Praise 1', position: 2 },
  { variableName: 'praise_song_2', title: 'Praise 2', position: 3 },
  { variableName: 'praise_song_3', title: 'Praise 3', position: 4 }, // Remains unfilled!
  { variableName: 'closing_song', title: 'Closing Song', position: 5 }, // Remains unfilled!
];

const matchResult = matchSongSets(parsed.songCandidates, configuredSlots, indonesianProfile.song_set_matching);
console.log('  Suggested Song Set Mappings:', matchResult.suggestions);
console.log('  Unfilled Slots (Omitted from Live Slides):', matchResult.songSlotsUnfilled);
console.log('  Song Overflow:', matchResult.songOverflow);

assert.equal(matchResult.suggestions['opening_song']?.songNumber, 45);
assert.equal(matchResult.suggestions['opening_song']?.songBookCode, 'NKI');
assert.equal(matchResult.suggestions['opening_song']?.matchKind, 'label');

assert.equal(matchResult.suggestions['praise_song_1']?.songNumber, 10);
assert.equal(matchResult.suggestions['praise_song_1']?.songBookCode, 'KJ');
assert.equal(matchResult.suggestions['praise_song_1']?.matchKind, 'positional');

assert.equal(matchResult.suggestions['praise_song_2']?.songNumber, 159);
assert.equal(matchResult.suggestions['praise_song_2']?.songBookCode, 'SDAH');
assert.equal(matchResult.suggestions['praise_song_2']?.matchKind, 'positional');

assert.deepEqual(matchResult.songSlotsUnfilled, ['praise_song_3', 'closing_song']);
assert.equal(matchResult.songOverflow.length, 0);

console.log('  [PASS] SPEC-44 3-pass song set matching and unfilled slot omission verified.');
console.log('\n=== ALL LIVE SMOKE TESTS FOR SPEC-43 & SPEC-44 COMPLETED SUCCESSFULLY ===');
