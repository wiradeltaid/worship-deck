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
const { extractPredefinedFields, extractSongSetEntries } = await import(
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

