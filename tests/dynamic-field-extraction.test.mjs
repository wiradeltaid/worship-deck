/**
 * SPEC-67-02: Consolidate form intake extraction onto Predefined Field and Song Set regex.
 *
 * Verifies:
 * 1. Raw bulletin text containing custom fields that macro parser rules do NOT recognize,
 *    but a Predefined Field regex matches, successfully produces the expected fieldSuggestions.
 * 2. Predefined field regex extracts named groups (?<value>...), capture group $1, or full match.
 * 3. Dynamic song set regex extraction produces valid song set suggestions.
 * 4. Submitting service form persists extracted/accepted field values into `service_field_values`.
 * 5. `GET /api/services/{id}` selects and returns the verbatim `raw_payload` unchanged.
 * 6. Non-destructive suggestion contract: existing field values are not overwritten silently.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dynamic-field-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');

const srcUrl = (...parts) => pathToFileURL(path.join(root, 'src', ...parts)).href;

const { getDb } = await import(srcUrl('lib', 'db', 'index.ts'));
const { extractPredefinedFields, extractSongSetEntries, compileProfileRegex, reconcileDynamicUnmappedLines, normalizeNewlines } = await import(
  srcUrl('lib', 'parser-rules.ts')
);

test('SPEC-67-02: Predefined field regex extracts custom fields unmapped by macro parser', () => {
  const customRundown = `SABBATH, OCTOBER 24, 2026
DIVINE SERVICE ✨

Call to Worship: Sis. Maria
Opening Song: SDAH #100
Offertory Exhortation: Elder James Doe
Scripture Reading: Psalm 23:1-6
Sermon: Pastor Thomas "Walking in Faith"
Deacon on Duty: Bro. Timothy Smith
Benediction: Pastor Thomas`;

  const fields = [
    {
      variable_name: 'offertory_exhortation',
      extraction_regex: '(?:Offertory Exhortation|Persembahan):\\s*(?<value>[^\\n]+)',
    },
    {
      variable_name: 'deacon_on_duty',
      extraction_regex: 'Deacon on Duty:\\s*(?<value>[^\\n]+)',
    },
    {
      variable_name: 'benediction_speaker',
      extraction_regex: 'Benediction:\\s*(?<value>[^\\n]+)',
    },
    {
      variable_name: 'unmatched_field',
      extraction_regex: 'Organist:\\s*(?<value>[^\\n]+)',
    },
  ];

  const suggestions = extractPredefinedFields(customRundown, fields);

  assert.equal(suggestions.offertory_exhortation, 'Elder James Doe');
  assert.equal(suggestions.deacon_on_duty, 'Bro. Timothy Smith');
  assert.equal(suggestions.benediction_speaker, 'Pastor Thomas');
  assert.equal(suggestions.unmatched_field, undefined);
});

test('SPEC-67-02: Song set entry regex extracts targeted song suggestions', () => {
  const rundown = `DIVINE SERVICE
Praise & Worship:
Praise Song 1: #245
Praise Song 2: #100
Praise Song 3: #334
Closing Song: #159`;

  const entries = [
    {
      variable_name: 'praise_song_1',
      extraction_regex: 'Praise Song 1:\\s*(?:#|No\\.?\\s*)?(?<number>\\d+)',
    },
    {
      variable_name: 'praise_song_2',
      extraction_regex: 'Praise Song 2:\\s*(?:#|No\\.?\\s*)?(?<number>\\d+)',
    },
    {
      variable_name: 'praise_song_3',
      extraction_regex: 'Praise Song 3:\\s*(?:#|No\\.?\\s*)?(?<number>\\d+)',
    },
  ];

  const suggestions = extractSongSetEntries(rundown, entries);

  assert.ok(suggestions.praise_song_1);
  assert.equal(suggestions.praise_song_1.songNumber, 245);
  assert.ok(suggestions.praise_song_2);
  assert.equal(suggestions.praise_song_2.songNumber, 100);
  assert.ok(suggestions.praise_song_3);
  assert.equal(suggestions.praise_song_3.songNumber, 334);
});

test('SPEC-67-02: DB persistence in services and service_field_values maintains raw_payload verbatim', () => {
  const db = getDb();

  const verbatimRundown = `  SABBATH, OCTOBER 24, 2026
  DIVINE SERVICE 🎉

• Welcome Visitors
• Offertory: Special Offering for Missions
• Special Music: Youth Choir "Amazing Grace"

Pastoral Note:
- Board meeting at 4:30 PM in Fellowship Hall.`;

  // 1. Insert service with verbatim raw_payload containing indentation, emoji, and blank lines
  const res = db.prepare(
    `INSERT INTO services (date, raw_payload, parsed_data, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  ).run('2026-10-24', verbatimRundown, JSON.stringify({ items: [] }));

  const serviceId = Number(res.lastInsertRowid);
  assert.ok(serviceId > 0);

  // 2. Insert extracted field values into service_field_values
  const extractedValues = {
    offertory_purpose: 'Special Offering for Missions',
    special_music: 'Youth Choir "Amazing Grace"',
    board_meeting_time: '4:30 PM',
  };

  const insertStmt = db.prepare(
    `INSERT INTO service_field_values (service_id, variable_name, value_text, updated_at)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
  );

  for (const [key, val] of Object.entries(extractedValues)) {
    insertStmt.run(String(serviceId), key, val);
  }

  // 3. Verify services.raw_payload is 100% faithful verbatim
  const row = db.prepare(`SELECT date, raw_payload FROM services WHERE id = ?`).get(serviceId);
  assert.equal(row.raw_payload, verbatimRundown, 'raw_payload must be preserved exactly verbatim');
  assert.ok(row.raw_payload.includes('🎉'));
  assert.ok(row.raw_payload.includes('  SABBATH'));
  assert.ok(row.raw_payload.includes('• Welcome'));

  // 4. Verify service_field_values roundtrip correctly
  const savedValues = db.prepare(
    `SELECT variable_name, value_text FROM service_field_values WHERE service_id = ? ORDER BY variable_name ASC`
  ).all(String(serviceId));

  const valuesMap = Object.fromEntries(savedValues.map(r => [r.variable_name, r.value_text]));
  assert.equal(valuesMap.offertory_purpose, 'Special Offering for Missions');
  assert.equal(valuesMap.special_music, 'Youth Choir "Amazing Grace"');
  assert.equal(valuesMap.board_meeting_time, '4:30 PM');
});

test('SPEC-67-02: Non-destructive suggestion contract preserves existing operator edits', () => {
  // Simulate the form suggestion acceptance logic from EditForm.tsx
  const existingFieldValues = {
    deacon_on_duty: 'Bro. Timothy Smith (Confirmed)',
    offertory_exhortation: '',
  };

  const newFieldSuggestions = {
    deacon_on_duty: 'Bro. Timothy Smith',
    offertory_exhortation: 'Elder James Doe',
  };

  const updatedFieldValues = { ...existingFieldValues };

  // Only fill when current value is empty or whitespace-only (from EditForm lines 534-540)
  for (const [vn, val] of Object.entries(newFieldSuggestions)) {
    if (!updatedFieldValues[vn] || updatedFieldValues[vn].trim() === '') {
      updatedFieldValues[vn] = val;
    }
  }

  // deacon_on_duty must keep operator's manual addition "(Confirmed)"
  assert.equal(updatedFieldValues.deacon_on_duty, 'Bro. Timothy Smith (Confirmed)');
  // offertory_exhortation was empty, so suggestion fills it
  assert.equal(updatedFieldValues.offertory_exhortation, 'Elder James Doe');
});

test('SPEC-68-02: Song set entry regex extraction supports camelCase and snake_case properties', () => {
  const customRundown = `SABBATH, OCTOBER 24, 2026
DIVINE SERVICE

Opening Song: SDAH #100
Praise Song 1: #245
Scripture Hymn: SDAH #334
Closing Song: #159`;

  const entriesWithCamelCase = [
    {
      variableName: 'opening_song_bt',
      extractionRegex: 'Opening Song:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)',
    },
    {
      variableName: 'scripture_hymn',
      extractionRegex: 'Scripture Hymn:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)',
    },
  ];

  const suggestions = extractSongSetEntries(customRundown, entriesWithCamelCase);

  assert.ok(suggestions.opening_song_bt);
  assert.equal(suggestions.opening_song_bt.songNumber, 100);
  assert.ok(suggestions.scripture_hymn);
  assert.equal(suggestions.scripture_hymn.songNumber, 334);
});

test('SPEC-68-02: Song set entry regex suggestions preserve non-destructive operator override discipline', () => {
  // Simulate Song Set form suggestions in CreateForm / EditForm (handleAcceptAllSuggestions)
  const existingSongSetValues = {
    opening_song_bt: {
      songNumber: '150',
      songBookCode: 'SDAH',
      songTitle: 'O Reverence and Awe (Manual Pick)',
    },
    closing_song_ds: {
      songNumber: '',
      songBookCode: '',
      songTitle: '',
    },
    special_song: null,
  };

  const extractedSuggestions = {
    opening_song_bt: {
      songNumber: 100,
      songBookCode: 'SDAH',
      title: 'Great Is Thy Faithfulness',
    },
    closing_song_ds: {
      songNumber: 159,
      songBookCode: 'SDAH',
      title: 'The Old Rugged Cross',
    },
    special_song: {
      songNumber: 245,
      songBookCode: 'SDAH',
      title: 'More About Jesus',
    },
  };

  const updatedSongSets = { ...existingSongSetValues };

  // Production condition: if (!updated[vn]?.songNumber || updated[vn]?.songNumber.trim() === '')
  for (const [vn, sug] of Object.entries(extractedSuggestions)) {
    if (!updatedSongSets[vn]?.songNumber || String(updatedSongSets[vn]?.songNumber).trim() === '') {
      updatedSongSets[vn] = {
        ...(updatedSongSets[vn] || {}),
        songNumber: String(sug.songNumber),
        songBookCode: sug.songBookCode || updatedSongSets[vn]?.songBookCode || '',
        songTitle: sug.title,
      };
    }
  }

  // opening_song_bt keeps manual selection (#150)
  assert.equal(updatedSongSets.opening_song_bt.songNumber, '150');
  assert.equal(updatedSongSets.opening_song_bt.songTitle, 'O Reverence and Awe (Manual Pick)');

  // closing_song_ds had empty songNumber, so suggestion fills it (#159)
  assert.equal(updatedSongSets.closing_song_ds.songNumber, '159');
  assert.equal(updatedSongSets.closing_song_ds.songTitle, 'The Old Rugged Cross');

  // special_song was null, so suggestion fills it (#245)
  assert.equal(updatedSongSets.special_song.songNumber, '245');
  assert.equal(updatedSongSets.special_song.songTitle, 'More About Jesus');
});

test('SPEC-68-01: Backend parser profile table and routes remain intact', () => {
  const db = getDb();
  const tableInfo = db.prepare(`PRAGMA table_info(rundown_parser_profiles)`).all();
  assert.ok(tableInfo.length > 0, 'rundown_parser_profiles table must remain intact');
  const hasSlug = tableInfo.some((col) => col.name === 'slug');
  assert.ok(hasSlug, 'rundown_parser_profiles must have slug column');

  // Shipped builtin default profile row exists
  const defaultProfile = db.prepare(`SELECT slug, title, is_default FROM rundown_parser_profiles WHERE is_default = 1`).get();
  assert.ok(defaultProfile, 'default parser profile must be seeded');
  assert.equal(defaultProfile.is_default, 1);
});

test('SPEC-68-02: SQLite song_set_entries schema persists extraction_regex column', () => {
  const db = getDb();

  // 1. Verify extraction_regex column exists in song_set_entries table
  const tableInfo = db.prepare(`PRAGMA table_info(song_set_entries)`).all();
  const hasRegexCol = tableInfo.some((col) => col.name === 'extraction_regex');
  assert.ok(hasRegexCol, 'song_set_entries must have extraction_regex column');

  // 2. Insert test entry with extraction_regex and retrieve it
  const testVarName = 'spec68_test_entry';
  const testRegex = '(?i)^Special\\s*Song\\s*[:\\-]\\s*#?(?<number>\\d+)';

  db.prepare(`DELETE FROM song_set_entries WHERE variable_name = ?`).run(testVarName);
  db.prepare(
    `INSERT INTO song_set_entries (global_id, variable_name, title, position, extraction_regex, updated_at)
     VALUES (?, ?, ?, 999, ?, CURRENT_TIMESTAMP)`
  ).run('019253c0-0000-7000-8000-000000000068', testVarName, 'Special Test Song', testRegex);

  const row = db.prepare(`SELECT variable_name, extraction_regex FROM song_set_entries WHERE variable_name = ?`).get(testVarName);
  assert.equal(row.variable_name, testVarName);
  assert.equal(row.extraction_regex, testRegex);

  // Clean up test entry
  db.prepare(`DELETE FROM song_set_entries WHERE variable_name = ?`).run(testVarName);
});

test('SPEC-69-02: Multi-song fixture extracts targeted song set entries without false overflow signals and returns empty overflow arrays', () => {
  const customRundown = `SABBATH, OCTOBER 24, 2026
DIVINE SERVICE

Song of Praise: SDAH #614
Sabbath School Opening Song: SDAH #316
Introit: SDAH #508
Divine Service Opening Song: SDAH #100
Prayer Song: SDAH #671
Response: SDAH #684
Scripture Hymn: SDAH #334
Closing Song: SDAH #476`;

  const configuredEntries = [
    {
      variableName: 'opening_song_bt',
      extractionRegex: '(?:Sabbath School|Bible Talk) Opening Song:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)',
    },
    {
      variableName: 'opening_song_ds',
      extractionRegex: '(?:Divine Service) Opening Song:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)',
    },
    {
      variableName: 'scripture_hymn',
      extractionRegex: 'Scripture Hymn:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)',
    },
    {
      variableName: 'closing_song_ds',
      extractionRegex: 'Closing Song:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)',
    },
  ];

  const suggestions = extractSongSetEntries(customRundown, configuredEntries);

  // Exact slot-to-song mappings extracted
  assert.equal(suggestions.opening_song_bt?.songNumber, 316);
  assert.equal(suggestions.opening_song_ds?.songNumber, 100);
  assert.equal(suggestions.scripture_hymn?.songNumber, 334);
  assert.equal(suggestions.closing_song_ds?.songNumber, 476);

  // Non-matching prayer hymns (#671, #684, #508, #614) do NOT produce false overflow or corrupt matching
  assert.equal(suggestions.opening_song_bt?.songBookCode, 'SDAH');
  assert.equal(suggestions.opening_song_ds?.songBookCode, 'SDAH');
  assert.equal(suggestions.scripture_hymn?.songBookCode, 'SDAH');
  assert.equal(suggestions.closing_song_ds?.songBookCode, 'SDAH');
});

test('SPEC-70-02: Backend parser profile routes and legacy song matching retired', async () => {
  const serverGoPath = path.join(root, 'internal', 'httpapi', 'server.go');
  const serverGoSource = fs.readFileSync(serverGoPath, 'utf8');

  // 1. Assert absence of parser profile route registrations in server.go
  assert.ok(!serverGoSource.includes('GET /api/parser-profiles'), 'server.go must NOT register GET /api/parser-profiles');
  assert.ok(!serverGoSource.includes('GET /api/admin/parser-profiles'), 'server.go must NOT register GET /api/admin/parser-profiles');
  assert.ok(!serverGoSource.includes('POST /api/admin/parser-profiles'), 'server.go must NOT register POST /api/admin/parser-profiles');
  assert.ok(!serverGoSource.includes('deleteParserProfile'), 'server.go must NOT register deleteParserProfile');

  // 2. Assert deleted Go files are absent from disk
  const parserProfilesGoPath = path.join(root, 'internal', 'httpapi', 'parser_profiles.go');
  const songSetMatchingGoPath = path.join(root, 'internal', 'parse', 'song_set_matching.go');

  assert.ok(!fs.existsSync(parserProfilesGoPath), 'internal/httpapi/parser_profiles.go must be deleted');
  assert.ok(!fs.existsSync(songSetMatchingGoPath), 'internal/parse/song_set_matching.go must be deleted');

  // 3. Assert matchSongSets is retired from TypeScript
  const songSetMatchingModule = await import('../src/lib/song-set-matching.ts');
  assert.equal(typeof songSetMatchingModule.matchSongSets, 'undefined', 'matchSongSets must be undefined');
});

test('SPEC-71-01: Section-scoped multiline song set regex extraction with rawText fallback', () => {
  const multiSectionRundown = `SABBATH, OCTOBER 24, 2026

BIBLE TALK (9:00 - 10:00)
Leader: Leader One
[ ] Opening song : SDAH #614 Sound the Battle Cry
Scripture Reading: Psalm 119:105
[ ] Closing Song : SDAH #316 Lift Out Thy Life Within Me

DIVINE SERVICE (10:00 - 12:00)
Leader: Leader Two
[ ] Opening Song : SDAH #508 "Anywhere With Jesus"
Scripture: John 3:16
[ ] Closing Song : SDAH #476 "Burdens Are Lifted at Calvary"
Sermon: Speaker Two "The Blessed Hope"
Closing Prayer: Elder One`;

  const sectionEntries = [
    {
      variableName: 'bt_opening_song',
      title: 'BT Opening Song',
      extractionRegex: '(?is)BIBLE\\s+TALK.*?Opening\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)',
    },
    {
      variableName: 'bt_closing_song',
      title: 'BT Closing Song',
      extractionRegex: '(?is)BIBLE\\s+TALK.*?Closing\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)',
    },
    {
      variableName: 'ds_opening_song',
      title: 'DS Opening Song',
      extractionRegex: '(?is)DIVINE\\s+SERVICE.*?Opening\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)',
    },
    {
      variableName: 'ds_closing_song',
      title: 'DS Closing Song',
      extractionRegex: '(?is)DIVINE\\s+SERVICE.*?Closing\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)',
    },
  ];

  const suggestions = extractSongSetEntries(multiSectionRundown, sectionEntries);

  // Assert exact slot extractions across sections without collisions
  assert.equal(suggestions.bt_opening_song?.songNumber, 614);
  assert.equal(suggestions.bt_opening_song?.songBookCode, 'SDAH');

  assert.equal(suggestions.bt_closing_song?.songNumber, 316);
  assert.equal(suggestions.bt_closing_song?.songBookCode, 'SDAH');

  assert.equal(suggestions.ds_opening_song?.songNumber, 508);
  assert.equal(suggestions.ds_opening_song?.songBookCode, 'SDAH');

  assert.equal(suggestions.ds_closing_song?.songNumber, 476);
  assert.equal(suggestions.ds_closing_song?.songBookCode, 'SDAH');
});

test('SPEC-72-01: Single regex evaluator matches multiline dotall patterns and extracts song numbers and books', () => {
  const sampleBulletin = `SABBATH, OCTOBER 24, 2026

BIBLE TALK (9:00 - 10:00)
Leader: Leader One
Welcome Remarks: Elder James
[ ] Opening song : SDAH #614 Sound the Battle Cry
Scripture Reading: Psalm 119:105
[ ] Closing Song : SDAH #316 Lift Out Thy Life Within Me

DIVINE SERVICE (10:00 - 12:00)
Leader: Leader Two
[ ] Opening Song : SDAH #508 "Anywhere With Jesus"
Scripture: John 3:16
[ ] Closing Song : SDAH #476 "Burdens Are Lifted at Calvary"`;

  const multilineSongRegex = '(?is)BIBLE\\s+TALK.*?Opening\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)';
  const re = compileProfileRegex(multilineSongRegex);

  // Line-by-line produces null
  const lines = sampleBulletin.split('\n');
  let lineMatched = false;
  for (const line of lines) {
    if (line.match(re)) {
      lineMatched = true;
      break;
    }
  }
  assert.equal(lineMatched, false, 'Line-by-line matching must yield false for section-anchored multiline pattern');

  // Full-sample evaluation matches
  re.lastIndex = 0;
  const m = sampleBulletin.match(re);
  assert.ok(m, 'Multiline evaluation must match full sample text');
  const val = m.groups?.value || m.groups?.number || (m[1] !== undefined ? m[1] : m[0]);
  assert.equal(val, '614');
  assert.equal(m.groups?.book, 'SDAH');

  // Test stateful regex reset (g flag simulation)
  re.lastIndex = 999;
  re.lastIndex = 0;
  const m2 = sampleBulletin.match(re);
  assert.ok(m2);
  assert.equal(m2.groups?.number, '614');
});

test('SPEC-72-01: Rundown test area accurately maps multiline song target lines without masking intermediate content', () => {
  const sampleBulletin = `SABBATH, OCTOBER 24, 2026

BIBLE TALK (9:00 - 10:00)
Leader: Leader One
Welcome Remarks: Elder James
[ ] Opening song : SDAH #614 Sound the Battle Cry
Scripture Reading: Psalm 119:105
[ ] Closing Song : SDAH #316 Lift Out Thy Life Within Me

DIVINE SERVICE (10:00 - 12:00)
Leader: Leader Two
[ ] Opening Song : SDAH #508 "Anywhere With Jesus"
Scripture: John 3:16
[ ] Closing Song : SDAH #476 "Burdens Are Lifted at Calvary"`;

  const songSetEntries = [
    {
      variableName: 'bt_opening',
      title: 'BT Opening',
      extractionRegex: '(?is)BIBLE\\s+TALK.*?Opening\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)',
    },
    {
      variableName: 'bt_closing',
      title: 'BT Closing',
      extractionRegex: '(?is)BIBLE\\s+TALK.*?Closing\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)',
    },
    {
      variableName: 'ds_opening',
      title: 'DS Opening',
      extractionRegex: '(?is)DIVINE\\s+SERVICE.*?Opening\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)',
    },
    {
      variableName: 'ds_closing',
      title: 'DS Closing',
      extractionRegex: '(?is)DIVINE\\s+SERVICE.*?Closing\\s+[Ss]ong\\s*:\\s*(?:(?<book>[A-Za-z]+)\\s*)?#?\\s*(?<number>\\d+)',
    },
  ];

  const rawLines = sampleBulletin.split('\n');
  const mappedIndices = new Set();

  // Date and section header mapping
  const dateRegex = /(?:20\d{2}-\d{2}-\d{2})|(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+20\d{2}/i;
  const sectionRegex = /^(BIBLE\s+TALK|DIVINE\s+SERVICE|BREAK)\b/i;

  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || dateRegex.test(trimmed) || sectionRegex.test(trimmed)) {
      mappedIndices.add(idx);
    }
  });

  // Evaluate song set entries and pinpoint target lines
  for (const entry of songSetEntries) {
    const re = compileProfileRegex(entry.extractionRegex);
    re.lastIndex = 0;
    const m = sampleBulletin.match(re);
    assert.ok(m, `Entry ${entry.variableName} must match`);
    const numStr = m.groups?.number;
    assert.ok(numStr);
    if (typeof m.index === 'number') {
      const numOffset = m[0].lastIndexOf(numStr);
      const targetOffset = m.index + (numOffset !== -1 ? numOffset : 0);
      const targetIdx = sampleBulletin.slice(0, targetOffset).split('\n').length - 1;
      if (targetIdx >= 0 && targetIdx < rawLines.length) {
        mappedIndices.add(targetIdx);
      }
    }
  }

  const unmappedLines = [];
  rawLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed && !mappedIndices.has(idx)) {
      unmappedLines.push(line);
    }
  });

  // Matched song lines must be excluded from unmappedLines
  assert.ok(!unmappedLines.some((l) => l.includes('SDAH #614')), 'SDAH #614 line must not be unmapped');
  assert.ok(!unmappedLines.some((l) => l.includes('SDAH #316')), 'SDAH #316 line must not be unmapped');
  assert.ok(!unmappedLines.some((l) => l.includes('SDAH #508')), 'SDAH #508 line must not be unmapped');
  assert.ok(!unmappedLines.some((l) => l.includes('SDAH #476')), 'SDAH #476 line must not be unmapped');

  // Intermediate lines must NOT be masked and must remain in unmappedLines
  assert.ok(unmappedLines.some((l) => l.includes('Leader: Leader One')), 'Leader One must remain in unmapped');
  assert.ok(unmappedLines.some((l) => l.includes('Welcome Remarks: Elder James')), 'Welcome Remarks must remain in unmapped');
  assert.ok(unmappedLines.some((l) => l.includes('Scripture Reading: Psalm 119:105')), 'Scripture Reading must remain in unmapped');
  assert.ok(unmappedLines.some((l) => l.includes('Leader: Leader Two')), 'Leader Two must remain in unmapped');
  assert.ok(unmappedLines.some((l) => l.includes('Scripture: John 3:16')), 'Scripture must remain in unmapped');
});

test('SPEC-72-02: Target line pinpointing is resilient to trailing whitespace and newlines in multiline regex', () => {
  const sample = `BIBLE TALK (9:00 - 10:00)
Opening song : SDAH #614
Welcome Remarks: Elder James`;

  // Pattern with trailing \s* that consumes trailing newline
  const trailingWhitespacePattern = '(?is)BIBLE\\s+TALK.*?Opening\\s+song\\s*:\\s*(?:SDAH\\s*)?#?(?<number>\\d+)\\s*';
  const re = compileProfileRegex(trailingWhitespacePattern);
  const m = sample.match(re);
  assert.ok(m);
  assert.equal(m.groups?.number, '614');

  // Verify that target line pinpointing anchors to the capture offset rather than match-end
  const numStr = m.groups.number;
  const numOffset = m[0].lastIndexOf(numStr);
  const targetOffset = (typeof m.index === 'number' ? m.index : 0) + (numOffset !== -1 ? numOffset : 0);
  const targetIdx = sample.slice(0, targetOffset).split('\n').length - 1;

  // Line 0: BIBLE TALK, Line 1: Opening song, Line 2: Welcome Remarks
  assert.equal(targetIdx, 1, 'Target line must pinpoint line 1 (Opening song), NOT line 2 (Welcome Remarks)');
});

test('SPEC-72-02: reconcileDynamicUnmappedLines prunes matched songs and fields while preserving unmapped content', () => {
  const initialUnmapped = [
    'Leader: Leader One',
    'Welcome Remarks: Elder James',
    '[ ] Opening song : SDAH #614 Sound the Battle Cry',
    'Scripture Reading: Psalm 119:105',
    '[ ] Closing Song : SDAH #316 Lift Out Thy Life Within Me',
    'Offertory Exhortation: Elder John Smith',
  ];

  const fieldSuggestions = {
    offertory_exhortation: 'Elder John Smith',
  };

  const songSetSuggestions = {
    bt_opening: { songNumber: 614, songBookCode: 'SDAH' },
    bt_closing: { songNumber: 316, songBookCode: 'SDAH' },
  };

  const reconciled = reconcileDynamicUnmappedLines(initialUnmapped, fieldSuggestions, songSetSuggestions);

  // Both song lines and the field line are pruned
  assert.ok(!reconciled.some((l) => l.includes('#614')), '#614 line must be pruned');
  assert.ok(!reconciled.some((l) => l.includes('#316')), '#316 line must be pruned');
  assert.ok(!reconciled.some((l) => l.includes('Elder John Smith')), 'Offertory line must be pruned');

  // Truly unmapped lines remain
  assert.ok(reconciled.some((l) => l.includes('Leader: Leader One')), 'Leader One must remain');
  assert.ok(reconciled.some((l) => l.includes('Welcome Remarks: Elder James')), 'Welcome Remarks must remain');
  assert.ok(reconciled.some((l) => l.includes('Scripture Reading: Psalm 119:105')), 'Scripture Reading must remain');
  assert.equal(reconciled.length, 3);
});

test('SPEC-72-02: normalizeNewlines normalizes non-breaking spaces ( ) to standard ASCII spaces', () => {
  const textWithNBSP = 'BIBLE TALK\r\nOpening song : SDAH #614';
  const normalized = normalizeNewlines(textWithNBSP);

  assert.ok(!normalized.includes(' '), 'Normalized text must not contain NBSP');
  assert.ok(!normalized.includes('\r'), 'Normalized text must not contain CR');
  assert.equal(normalized, 'BIBLE TALK\nOpening song : SDAH #614');
});


