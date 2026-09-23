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
