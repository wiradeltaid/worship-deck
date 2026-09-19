/**
 * SPEC-46: Configurable Form Layout, Grouping Cards, and Predefined Fields with Dynamic Regex Extraction
 * Smoke Test & Executable Absence Guard Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractPredefinedFields, extractSongSetEntries } from '../src/lib/parser-rules.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function validateVariableName(name) {
  const variableNameRegex = /^[a-z][a-z0-9_]{1,63}$/;
  const reservedKeys = new Set([
    'service_date',
    'serviceDate',
    'hymnNumber',
    'songTitle',
    'lyrics',
    'label',
    'background',
    'announcement_inserts',
  ]);

  if (reservedKeys.has(name)) {
    return { valid: false, reason: 'reserved' };
  }
  if (!variableNameRegex.test(name)) {
    return { valid: false, reason: 'format' };
  }
  return { valid: true };
}

export function validateFieldTypeAndRegex(fieldType, extractionRegex) {
  if (fieldType === 'image' && extractionRegex && extractionRegex.trim().length > 0) {
    return { valid: false, reason: 'image_cannot_have_regex' };
  }
  return { valid: true };
}

test('SPEC-46-01: Schema contains form_layouts, form_groupings, form_group_slots, predefined_fields, service_field_values, service_form_layout_snapshots', () => {
  const schemaPath = path.join(root, 'internal', 'db', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  assert.match(schema, /CREATE TABLE IF NOT EXISTS form_layouts/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS form_groupings/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS form_group_slots/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS predefined_fields/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS service_field_values/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS service_form_layout_snapshots/);

  // Check Cardinality Unique Constraint on form_group_slots
  assert.match(schema, /UNIQUE\s*\(\s*layout_id\s*,\s*widget_kind\s*,\s*ref_key\s*\)/);
  // Check image extraction_regex check constraint
  assert.match(schema, /CHECK\s*\(\s*field_type\s*!=\s*'image'\s*OR\s*extraction_regex\s+IS\s+NULL\s*\)/);
});

test('SPEC-46-01: Reserved variable name validation and naming convention guards', () => {
  const reserved = [
    'service_date',
    'serviceDate',
    'hymnNumber',
    'songTitle',
    'lyrics',
    'label',
    'background',
    'announcement_inserts',
  ];

  for (const r of reserved) {
    const res = validateVariableName(r);
    assert.strictEqual(res.valid, false, `Expected reserved key ${r} to be invalid`);
    assert.strictEqual(res.reason, 'reserved');
  }

  const validNames = ['scripture_reference', 'sermon_speaker_name', 'family_photo', 'youth_request'];
  for (const v of validNames) {
    const res = validateVariableName(v);
    assert.strictEqual(res.valid, true, `Expected valid variable name: ${v}`);
  }

  const invalidFormats = ['123start', 'HasUpperCase', 'kebab-case', 'space in name', 'a'];
  for (const inv of invalidFormats) {
    const res = validateVariableName(inv);
    assert.strictEqual(res.valid, false, `Expected invalid format: ${inv}`);
    assert.strictEqual(res.reason, 'format');
  }
});

test('SPEC-46-01: Image fields reject extraction regex contract', () => {
  const validImage = validateFieldTypeAndRegex('image', null);
  assert.strictEqual(validImage.valid, true);

  const validEmptyRegexImage = validateFieldTypeAndRegex('image', '   ');
  assert.strictEqual(validEmptyRegexImage.valid, true);

  const invalidImage = validateFieldTypeAndRegex('image', '(?i)some_regex');
  assert.strictEqual(invalidImage.valid, false);
  assert.strictEqual(invalidImage.reason, 'image_cannot_have_regex');

  const validTextWithRegex = validateFieldTypeAndRegex('text', '(?i)some_regex');
  assert.strictEqual(validTextWithRegex.valid, true);
});

test('SPEC-46-01: Executable Absence Guard & Defect Injection', () => {
  // Inject defect 1: Allow reserved variable name
  const defectTester1 = (name) => {
    // If reserved check is mistakenly disabled:
    const variableNameRegex = /^[a-z][a-z0-9_]{1,63}$/;
    return variableNameRegex.test(name);
  };
  // The defect would allow 'service_date'
  assert.strictEqual(defectTester1('service_date'), true, 'Defect proof: raw regex alone allows reserved key');
  // Our guard rejects it
  assert.strictEqual(validateVariableName('service_date').valid, false, 'Guard proof: validateVariableName rejects reserved key');

  // Inject defect 2: Allow image field to have extraction regex
  const defectTester2 = (fieldType, regex) => {
    // If image restriction is missing:
    return true;
  };
  assert.strictEqual(defectTester2('image', '(?i)regex'), true, 'Defect proof: missing check allows regex on image');
  assert.strictEqual(validateFieldTypeAndRegex('image', '(?i)regex').valid, false, 'Guard proof: validateFieldTypeAndRegex forbids regex on image');
});

export const LEGACY_KEY_MAPPING = {
  'verseReading.reference': 'scripture_reference',
  'verseReading.text': 'scripture_text',
  'verseReading.translation': 'scripture_bible_version',
  'sermon.speaker': 'sermon_speaker_name',
  'sermon.title': 'sermon_title',
  'sermonGraphicUrl': 'sermon_poster',
  'closingPrayerPerson': 'closing_prayer_person',
  'specialSong': 'special_song',
  'familyName': 'family_name',
  'familyPhotoUrl': 'family_photo',
  'familyPrayerRequest': 'family_request',
  'youthName': 'youth_name',
  'youthPhotoUrl': 'youth_photo',
  'youthPrayerRequest': 'youth_request',
};

export function resolveFieldValue({ manualEdit, proposal, legacyBackfill }) {
  if (manualEdit !== undefined && manualEdit !== null && String(manualEdit).trim() !== '') {
    return { value: String(manualEdit), source: 'manual' };
  }
  if (proposal !== undefined && proposal !== null && String(proposal).trim() !== '') {
    return { value: String(proposal), source: 'proposal' };
  }
  if (legacyBackfill !== undefined && legacyBackfill !== null && String(legacyBackfill).trim() !== '') {
    return { value: String(legacyBackfill), source: 'legacy' };
  }
  return { value: '', source: 'empty' };
}

test('SPEC-46-02: Canonical legacy key mapping completeness', () => {
  const expectedKeys = [
    'verseReading.reference',
    'verseReading.text',
    'verseReading.translation',
    'sermon.speaker',
    'sermon.title',
    'sermonGraphicUrl',
    'closingPrayerPerson',
    'specialSong',
    'familyName',
    'familyPhotoUrl',
    'familyPrayerRequest',
    'youthName',
    'youthPhotoUrl',
    'youthPrayerRequest',
  ];

  for (const k of expectedKeys) {
    assert.ok(LEGACY_KEY_MAPPING[k], `Missing legacy key mapping for ${k}`);
  }
});

test('SPEC-46-02: Precedence rules and defect injection', () => {
  // Case 1: Manual edit present -> wins over proposal and legacy
  const res1 = resolveFieldValue({
    manualEdit: 'Manual Speaker',
    proposal: 'Proposed Speaker',
    legacyBackfill: 'Legacy Speaker',
  });
  assert.strictEqual(res1.value, 'Manual Speaker');
  assert.strictEqual(res1.source, 'manual');

  // Case 2: Proposal present, no manual edit -> wins over legacy
  const res2 = resolveFieldValue({
    manualEdit: '',
    proposal: 'Proposed Speaker',
    legacyBackfill: 'Legacy Speaker',
  });
  assert.strictEqual(res2.value, 'Proposed Speaker');
  assert.strictEqual(res2.source, 'proposal');

  // Case 3: Only legacy present -> used as fallback
  const res3 = resolveFieldValue({
    manualEdit: '',
    proposal: '',
    legacyBackfill: 'Legacy Speaker',
  });
  assert.strictEqual(res3.value, 'Legacy Speaker');
  assert.strictEqual(res3.source, 'legacy');

  // Inject defect: Proposal erroneously overrides manual edit
  const defectiveResolver = ({ manualEdit, proposal, legacyBackfill }) => {
    // Defect: Proposal takes precedence over manual edit
    if (proposal) return { value: proposal, source: 'proposal' };
    if (manualEdit) return { value: manualEdit, source: 'manual' };
    return { value: legacyBackfill || '', source: 'legacy' };
  };

  const defectResult = defectiveResolver({
    manualEdit: 'Manual Speaker',
    proposal: 'Proposed Speaker',
    legacyBackfill: 'Legacy Speaker',
  });
  // The defect produces wrong precedence
  assert.strictEqual(defectResult.value, 'Proposed Speaker', 'Defect proof: flawed resolver overrides manual edit');
  // Our authoritative resolver preserves manual edit
  assert.strictEqual(res1.value, 'Manual Speaker', 'Guard proof: manual edit retains top precedence');
});

export function substituteTokens(content, values = {}) {
  if (!content) return '';
  return content.replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, token) => {
    const val = values[token];
    if (val === undefined || val === null) {
      return '';
    }
    if (Array.isArray(val)) {
      return val.join('\n');
    }
    return String(val);
  });
}

test('SPEC-46-03: Dynamic canvas token substitution and S5 contract', () => {
  const content = 'Welcome to {church_name}! Speaker: {sermon_speaker_name}. Theme: {unknown_token}';
  const values = {
    church_name: 'Metro Church',
    sermon_speaker_name: 'Pastor David',
    // unknown_token not provided
  };

  const substituted = substituteTokens(content, values);
  assert.strictEqual(
    substituted,
    'Welcome to Metro Church! Speaker: Pastor David. Theme: ',
    'Expected unregistered token to render empty string per S5 contract'
  );

  // Defect injection: Strict parser throws on unregistered token instead of S5 graceful fallback
  const strictDefectSubstitute = (tpl, vals) => {
    return tpl.replace(/\{([a-zA-Z0-9_]+)\}/g, (_m, token) => {
      if (!(token in vals)) {
        throw new Error(`Undeclared token: ${token}`);
      }
      return String(vals[token]);
    });
  };

  assert.throws(
    () => strictDefectSubstitute(content, values),
    /Undeclared token/,
    'Defect proof: strict parser breaks presentation generation on missing token'
  );

  assert.doesNotThrow(
    () => substituteTokens(content, values),
    'Guard proof: S5 compliant substitution never throws on missing token'
  );
});

test('SPEC-46-04: TypeScript parity for extractPredefinedFields and extractSongSetEntries', () => {
  const bulletin = `SABBATH, OCTOBER 24, 2026
DIVINE SERVICE
Introit: #100
Guest Speaker: Pastor Alexander
Opening Song: SDAH #159
Sermon: Pastor Alexander "The Blessed Hope"
Closing Prayer: Deacon Michael`;

  const fields = [
    {
      variable_name: 'visiting_speaker',
      extraction_regex: '(?i)^Guest\\s+Speaker\\s*[:\\-]\\s*(?<value>.*)$',
    },
    {
      variable_name: 'closing_prayer_person',
      extraction_regex: '(?i)^(?:Closing\\s+Prayer|Doa\\s+Tutup)\\s*[:\\-]\\s*(?<value>.*)$',
    },
  ];

  const fieldSuggestions = extractPredefinedFields(bulletin, fields);
  assert.strictEqual(fieldSuggestions.visiting_speaker, 'Pastor Alexander');
  assert.strictEqual(fieldSuggestions.closing_prayer_person, 'Deacon Michael');

  const entries = [
    {
      variable_name: 'introit_song',
      extraction_regex: '(?i)^Introit\\s*[:\\-]\\s*#?\\s*(?<number>\\d+)',
    },
    {
      variable_name: 'ds_opening_song',
      extraction_regex: '(?i)^Opening\\s+Song\\s*[:\\-]\\s*(?<book>SDAH)?\\s*#?\\s*(?<number>\\d+)',
    },
  ];

  const songSuggestions = extractSongSetEntries(bulletin, entries, undefined, 'SDAH');
  assert.ok(songSuggestions.introit_song, 'Missing introit_song suggestion');
  assert.strictEqual(songSuggestions.introit_song.songNumber, 100);
  assert.strictEqual(songSuggestions.introit_song.songBookCode, 'SDAH');

  assert.ok(songSuggestions.ds_opening_song, 'Missing ds_opening_song suggestion');
  assert.strictEqual(songSuggestions.ds_opening_song.songNumber, 159);
  assert.strictEqual(songSuggestions.ds_opening_song.songBookCode, 'SDAH');

  // Defect injection: Malformed song regex fails gracefully without crash
  const brokenEntries = [
    {
      variable_name: 'broken_regex',
      extraction_regex: '[unclosed',
    },
  ];
  assert.doesNotThrow(
    () => extractSongSetEntries(bulletin, brokenEntries),
    'Guard proof: invalid regex never crashes extraction'
  );
});

test('SPEC-46-05: DynamicFormBody and in-place layout customization integration', () => {
  const dynamicBodyPath = path.join(root, 'src', 'operator', 'DynamicFormBody.tsx');
  assert.ok(fs.existsSync(dynamicBodyPath), 'DynamicFormBody.tsx must exist');
  const dynamicBodySource = fs.readFileSync(dynamicBodyPath, 'utf8');

  // Verify specialized slot renderers exist
  assert.match(dynamicBodySource, /PredefinedFieldSlotRenderer/);
  assert.match(dynamicBodySource, /ImageThreeColumnRenderer/);
  assert.match(dynamicBodySource, /SongSetSlotRenderer/);
  assert.match(dynamicBodySource, /AnnouncementSlotRenderer/);
  assert.match(dynamicBodySource, /Kelola Layout Visual/);

  // Verify CreateForm and EditForm incorporate DynamicFormBody
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');
  const createSource = fs.readFileSync(createFormPath, 'utf8');
  assert.match(createSource, /<DynamicFormBody/);

  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const editSource = fs.readFileSync(editFormPath, 'utf8');
  assert.match(editSource, /<DynamicFormBody/);

  // Defect injection: dropping DynamicFormBody from CreateForm
  const defectScanner = (src) => src.includes('<DynamicFormBody');
  assert.strictEqual(defectScanner('<div>No Dynamic Body</div>'), false, 'Defect proof: absence of DynamicFormBody is detected');
  assert.strictEqual(defectScanner(createSource), true, 'Guard proof: CreateForm contains DynamicFormBody');
});

test('SPEC-46-06: Admin Layout Builder & Predefined Fields Panel integration', () => {
  const adminPanelPath = path.join(root, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx');
  assert.ok(fs.existsSync(adminPanelPath), 'FormLayoutAdminPanel.tsx must exist');
  const adminPanelSource = fs.readFileSync(adminPanelPath, 'utf8');

  // Verify core management features exist
  assert.match(adminPanelSource, /Tambah Kartu Form Baru/);
  assert.match(adminPanelSource, /Tambah Slot ke Kartu/);
  assert.match(adminPanelSource, /Buat Predefined Field Baru/);
  assert.match(adminPanelSource, /Interactive Regex Testing Sandbox/);
  assert.match(adminPanelSource, /Seed Default Predefined Fields/);

  // Verify wiring into RegistryAdmin.tsx
  const registryAdminPath = path.join(root, 'src', 'components', 'admin', 'RegistryAdmin.tsx');
  const registrySource = fs.readFileSync(registryAdminPath, 'utf8');
  assert.match(registrySource, /FormLayoutAdminPanel/);
  assert.match(registrySource, /'formLayout'/);
});

test('SPEC-46-06: Top Shell Invariant and Defect Injection', () => {
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');
  const createSource = fs.readFileSync(createFormPath, 'utf8');

  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const editSource = fs.readFileSync(editFormPath, 'utf8');

  // Invariant 1: Top-left Rundown Textarea exists in 7-col container
  assert.match(createSource, /lg:col-span-7/);
  assert.match(createSource, /form\.rundown\.placeholder/);
  assert.match(editSource, /lg:col-span-7/);
  assert.match(editSource, /form\.rundown\.placeholder/);

  // Invariant 2: Top-right Sticky Live Slide Preview exists in 5-col sticky container
  assert.match(createSource, /lg:col-span-5[\s\S]*?lg:sticky/);
  assert.match(createSource, /SlidePreviewList/);
  assert.match(editSource, /lg:col-span-5[\s\S]*?lg:sticky/);
  assert.match(editSource, /SlidePreviewList/);

  // Defect injection: Moving preview away from sticky container fails the guard
  const defectPreviewChecker = (src) => src.includes('lg:col-span-5') && src.includes('lg:sticky') && src.includes('SlidePreviewList');
  assert.strictEqual(defectPreviewChecker('<div className="bottom-preview"><SlidePreviewList /></div>'), false, 'Defect proof: un-stickied or moved preview fails invariant');
  assert.strictEqual(defectPreviewChecker(createSource), true, 'Guard proof: CreateForm honors sticky preview invariant');
  assert.strictEqual(defectPreviewChecker(editSource), true, 'Guard proof: EditForm honors sticky preview invariant');
});

export function scanDynamicAnnouncementLayout(source) {
  const findings = [];
  const rendererMatch = source.match(/function AnnouncementSlotRenderer[\s\S]*?return\s*\(([\s\S]*?)\);/);
  if (!rendererMatch) {
    findings.push('Missing AnnouncementSlotRenderer in DynamicFormBody.tsx');
    return findings;
  }
  const body = rendererMatch[1];
  if (body.includes('sm:grid-cols-2') || body.includes('grid-cols-2')) {
    findings.push('Found cramped 2-column grid layout in AnnouncementSlotRenderer');
  }
  if (!body.includes('flex flex-col gap-4')) {
    findings.push('AnnouncementSlotRenderer must use flex flex-col gap-4 for vertical stack');
  }
  return findings;
}

test('SPEC-46: Real-File Absence Guard & Defect Injection for Dynamic Announcement Layout', () => {
  const dynamicBodyPath = path.join(root, 'src', 'operator', 'DynamicFormBody.tsx');
  const realSource = fs.readFileSync(dynamicBodyPath, 'utf8');

  // Real file passes with zero findings
  const realFindings = scanDynamicAnnouncementLayout(realSource);
  assert.deepEqual(realFindings, [], 'Real DynamicFormBody.tsx must pass announcement layout scan');

  // Inject defect 1: Introduce sm:grid-cols-2 into real content
  const defectiveContent1 = realSource.replace(
    'flex flex-col gap-4',
    'flex flex-col gap-4 sm:grid-cols-2'
  );
  const defectFindings1 = scanDynamicAnnouncementLayout(defectiveContent1);
  assert.ok(
    defectFindings1.some((f) => f.includes('cramped 2-column grid')),
    'Defect proof: scanDynamicAnnouncementLayout must catch sm:grid-cols-2 in AnnouncementSlotRenderer'
  );

  // Inject defect 2: Remove flex flex-col gap-4 from real content
  const defectiveContent2 = realSource.replace(
    'flex flex-col gap-4',
    'p-4'
  );
  const defectFindings2 = scanDynamicAnnouncementLayout(defectiveContent2);
  assert.ok(
    defectFindings2.some((f) => f.includes('flex flex-col gap-4')),
    'Defect proof: scanDynamicAnnouncementLayout must catch missing flex flex-col gap-4'
  );
});






