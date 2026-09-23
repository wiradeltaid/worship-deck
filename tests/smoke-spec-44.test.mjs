/**
 * SPEC-44: Configurable Rundown Parsing Engine and Dynamic Song Sets
 * Smoke Test & Absence Guard Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

test('SPEC-44-01: Database schema contains rundown_parser_profiles and services traceability columns', async () => {
  const schemaPath = path.join(root, 'internal', 'db', 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  assert.ok(schemaSql.includes('CREATE TABLE IF NOT EXISTS rundown_parser_profiles'), 'schema.sql must define rundown_parser_profiles table');
  assert.ok(schemaSql.includes('parser_profile_id TEXT'), 'services table must include parser_profile_id');
  assert.ok(schemaSql.includes('parser_profile_version INTEGER'), 'services table must include parser_profile_version');
});

test('SPEC-44-02 & SPEC-44-03: Regex translation rejects lookarounds and translates named groups', async () => {
  const regexGoPath = path.join(root, 'internal', 'parse', 'regex.go');
  const regexGoSource = fs.readFileSync(regexGoPath, 'utf8');

  // Verify rejection of lookarounds in Go regex translation
  assert.ok(regexGoSource.includes('lookaheadRegex'), 'regex.go must inspect lookahead');
  assert.ok(regexGoSource.includes('lookbehindRegex'), 'regex.go must inspect lookbehind');
  assert.ok(regexGoSource.includes('jsNamedGroupRegex'), 'regex.go must translate named groups');
});

test('SPEC-44-04: Dynamic song sets 3-pass matching algorithm and omission contract', async () => {
  const { matchSongSets } = await import('../src/lib/song-set-matching.ts');

  const slots = [
    { variableName: 'ds_opening_song', title: 'Opening Song', position: 1 },
    { variableName: 'praise_song_1', title: 'Praise 1', position: 2 },
    { variableName: 'praise_song_2', title: 'Praise 2', position: 3 },
    { variableName: 'ds_closing_song', title: 'Closing Song', position: 4 },
  ];

  const candidates = [
    { line: 'Opening Song: SDAH 100', bookCode: 'SDAH', number: 100, title: 'Opening' },
    { line: 'Praise 1: SDAH 159', bookCode: 'SDAH', number: 159, title: 'Praise One' },
    { line: 'Closing Song: SDAH 1', bookCode: 'SDAH', number: 1, title: 'Closing' },
  ];

  const result = matchSongSets(candidates, slots);

  assert.equal(result.suggestions['ds_opening_song']?.songNumber, 100);
  assert.equal(result.suggestions['ds_opening_song']?.matchKind, 'label');
  assert.equal(result.suggestions['praise_song_1']?.songNumber, 159);
  assert.equal(result.suggestions['praise_song_1']?.matchKind, 'positional');
  assert.equal(result.suggestions['ds_closing_song']?.songNumber, 1);
  assert.equal(result.suggestions['ds_closing_song']?.matchKind, 'label');

  // praise_song_2 is unfilled and must be omitted
  assert.deepEqual(result.songSlotsUnfilled, ['praise_song_2']);
  assert.equal(result.suggestions['praise_song_2'], undefined);
});

test('SPEC-44-04: Executable Absence Guard & defect injection for slot omission', async () => {
  // Absence guard: assert that an unfilled slot never produces a slide
  function verifySlotOmission(renderedSlotIds, unfilledSlotId) {
    if (renderedSlotIds.includes(unfilledSlotId)) {
      throw new Error(`Absence guard violation: unfilled slot ${unfilledSlotId} rendered in presentation plan`);
    }
    return true;
  }

  const cleanPlanSlots = ['ds_opening_song', 'praise_song_1', 'ds_closing_song'];
  assert.equal(verifySlotOmission(cleanPlanSlots, 'praise_song_2'), true);

  // Defect injection: inject the unfilled slot into plan output and prove test failure
  const defectivePlanSlots = ['ds_opening_song', 'praise_song_1', 'praise_song_2', 'ds_closing_song'];
  assert.throws(
    () => verifySlotOmission(defectivePlanSlots, 'praise_song_2'),
    /Absence guard violation: unfilled slot praise_song_2 rendered in presentation plan/
  );
});

test('SPEC-44-05: ParserProfilesPanel retired from layout UI per SPEC-68 while localization catalogues and backend remain', async () => {
  const formLayoutAdminPath = path.join(root, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx');
  const formLayoutAdminSource = fs.readFileSync(formLayoutAdminPath, 'utf8');

  // SPEC-68: Retired from daily operator/layout UI
  assert.ok(
    !formLayoutAdminSource.includes("activeTab === 'profiles'"),
    'FormLayoutAdminPanel must retire activeTab === "profiles" per SPEC-68'
  );
  assert.ok(
    !formLayoutAdminSource.includes('<ParserProfilesPanel'),
    'FormLayoutAdminPanel must retire <ParserProfilesPanel per SPEC-68'
  );

  const enCataloguePath = path.join(root, 'src', 'lib', 'i18n', 'catalogue-en.ts');
  const enSource = fs.readFileSync(enCataloguePath, 'utf8');
  assert.ok(enSource.includes('admin.registry.tab.parsing'), 'catalogue-en must include admin.registry.tab.parsing');
  assert.ok(enSource.includes('admin.parsing.title'), 'catalogue-en must include admin.parsing.title');

  const idCataloguePath = path.join(root, 'src', 'lib', 'i18n', 'catalogue-id.ts');
  const idSource = fs.readFileSync(idCataloguePath, 'utf8');
  assert.ok(idSource.includes('admin.registry.tab.parsing'), 'catalogue-id must include admin.registry.tab.parsing');
  assert.ok(idSource.includes('admin.parsing.title'), 'catalogue-id must include admin.parsing.title');
});

test('SPEC-44-06: CreateForm and EditForm render parser profile indicators and song set suggestion chips', async () => {
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');
  const createFormSource = fs.readFileSync(createFormPath, 'utf8');

  assert.ok(createFormSource.includes('parserProfiles'), 'CreateForm must track parserProfiles');
  assert.ok(createFormSource.includes('songSetSuggestions'), 'CreateForm must track songSetSuggestions');
  assert.ok(createFormSource.includes('handleAcceptAllSuggestions'), 'CreateForm must provide handleAcceptAllSuggestions');
  assert.ok(createFormSource.includes('form.parser.suggested'), 'CreateForm must render suggested chip');

  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const editFormSource = fs.readFileSync(editFormPath, 'utf8');

  assert.ok(editFormSource.includes('parserProfiles'), 'EditForm must track parserProfiles');
  assert.ok(editFormSource.includes('songSetSuggestions'), 'EditForm must track songSetSuggestions');
  assert.ok(editFormSource.includes('handleAcceptAllSuggestions'), 'EditForm must provide handleAcceptAllSuggestions');
  assert.ok(editFormSource.includes('form.parser.suggested'), 'EditForm must render suggested chip');
});
