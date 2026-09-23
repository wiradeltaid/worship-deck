/**
 * Placeholder Catalog (DEC-004 Supplement S1): the 17 admitted keys and the
 * weekly resolver that fills them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const catalogUrl = pathToFileURL(
  path.join(root, 'src', 'lib', 'registry', 'placeholder-catalog.ts')
).href;

const {
  PLACEHOLDER_CATALOG,
  isCatalogPlaceholderKey,
  catalogValuesFromWeekly,
  extractInlineTokens,
  findUnknownPredefinedFieldTokens,
  resetDynamicCatalogTokens,
} = await import(catalogUrl);

test('extractInlineTokens extracts tokens correctly from text', () => {
  assert.deepEqual(extractInlineTokens('Hello {service_date}!'), ['service_date']);
  assert.deepEqual(
    extractInlineTokens('Family: {family_name}, req: {family_request}, youth: {youth_name}'),
    ['family_name', 'family_request', 'youth_name']
  );
  assert.deepEqual(extractInlineTokens('{duplicate} and {duplicate}'), ['duplicate']);
  assert.deepEqual(extractInlineTokens('No tokens here'), []);
  assert.deepEqual(extractInlineTokens(''), []);
  assert.deepEqual(extractInlineTokens(null), []);
});

test('findUnknownPredefinedFieldTokens detects unknown tokens and valid tokens', () => {
  const validTemplate = {
    layouts: {
      default: {
        elements: [
          { type: 'text', content: 'Date: {service_date} - {sermon_title} ({scripture_bible_version}) {youth_name}' },
          { type: 'image-placeholder', placeholderKey: 'sermon_poster' },
        ],
      },
    },
  };
  assert.deepEqual(findUnknownPredefinedFieldTokens(validTemplate), []);

  const invalidTemplate = {
    layouts: {
      default: {
        elements: [
          { type: 'text', content: 'Unknown: {invented_token} and {bad_key}' },
          { type: 'image-placeholder', placeholderKey: 'bad_image_key' },
        ],
      },
    },
  };
  const warnings = findUnknownPredefinedFieldTokens(invalidTemplate);
  assert.equal(warnings.length, 3);
  assert.ok(warnings.some((w) => w.includes('{invented_token}')));
  assert.ok(warnings.some((w) => w.includes('{bad_key}')));
  assert.ok(warnings.some((w) => w.includes('bad_image_key')));
});

test('SPEC-56: resetDynamicCatalogTokens registers admin-created fields and clears deleted fields', () => {
  // Reset initially to clean state
  resetDynamicCatalogTokens();

  const customTemplate = {
    layouts: {
      default: {
        elements: [
          { type: 'text', content: 'Speaker: {mission_speaker}' },
          { type: 'image-placeholder', placeholderKey: 'event_poster' },
        ],
      },
    },
  };

  // 1. Before registering, both tokens produce warnings
  const warningsBefore = findUnknownPredefinedFieldTokens(customTemplate);
  assert.equal(warningsBefore.length, 2);
  assert.ok(warningsBefore.some((w) => w.includes('{mission_speaker}')));
  assert.ok(warningsBefore.some((w) => w.includes('event_poster')));

  // 2. Register dynamic fields via resetDynamicCatalogTokens
  resetDynamicCatalogTokens([
    { variable_name: 'mission_speaker', field_type: 'text' },
    { variable_name: 'event_poster', field_type: 'image' },
  ]);

  // Now neither produces a warning
  const warningsAfter = findUnknownPredefinedFieldTokens(customTemplate);
  assert.deepEqual(warningsAfter, []);
  assert.ok(isCatalogPlaceholderKey('mission_speaker'));
  assert.ok(isCatalogPlaceholderKey('event_poster'));

  // Built-in keys still work
  assert.ok(isCatalogPlaceholderKey('service_date'));
  assert.ok(isCatalogPlaceholderKey('sermon_poster'));

  // 3. Deleting a field (calling reset with only remaining fields) un-registers deleted field
  resetDynamicCatalogTokens([
    { variable_name: 'mission_speaker', field_type: 'text' },
    // event_poster deleted
  ]);
  assert.ok(isCatalogPlaceholderKey('mission_speaker'));
  assert.equal(isCatalogPlaceholderKey('event_poster'), false);

  const warningsAfterDelete = findUnknownPredefinedFieldTokens(customTemplate);
  assert.equal(warningsAfterDelete.length, 1);
  assert.ok(warningsAfterDelete[0].includes('event_poster'));

  // 4. Calling reset with no args restores the exact 17 built-ins
  resetDynamicCatalogTokens();
  assert.equal(isCatalogPlaceholderKey('mission_speaker'), false);
  assert.equal(isCatalogPlaceholderKey('event_poster'), false);
  assert.ok(isCatalogPlaceholderKey('service_date'));
  assert.ok(isCatalogPlaceholderKey('sermon_poster'));
});

test('validateArtifactTemplate accepts youth_name and scripture_bible_version placeholders in slide payload', async () => {
  const { validateArtifactTemplate } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'validate.ts')).href
  );
  const validPayload = {
    schemaVersion: 1,
    id: 's1-keys-validation-test',
    label: 'S1 Keys Test',
    baseType: 'general',
    placeholders: [
      { key: 'youth_name', type: 'text', required: false },
      { key: 'scripture_bible_version', type: 'text', required: false },
    ],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [
          {
            id: 'e1',
            type: 'text',
            x: 10,
            y: 10,
            w: 100,
            h: 50,
            zIndex: 1,
            content: '{youth_name} ({scripture_bible_version})',
          },
        ],
      },
    },
  };
  assert.doesNotThrow(() => validateArtifactTemplate(validPayload));
});

test('catalog admits the 17 shipped General keys and excludes SongSet expansion keys', () => {
  const keys = PLACEHOLDER_CATALOG.map((entry) => entry.key);
  for (const key of [
    'service_date',
    'scripture_reference',
    'scripture_text',
    'scripture_bible_version',
    'theme_reference',
    'theme_text',
    'special_song',
    'sermon_title',
    'sermon_speaker_name',
    'sermon_poster',
    'closing_prayer_person',
    'family_request',
    'youth_request',
    'family_name',
    'youth_name',
    'family_photo',
    'youth_photo',
  ]) {
    assert.equal(isCatalogPlaceholderKey(key), true, key);
  }
  assert.equal(isCatalogPlaceholderKey('afternoon_program'), false);
  assert.equal(isCatalogPlaceholderKey('hymnNumber'), false);
  assert.equal(isCatalogPlaceholderKey('songTitle'), false);
  assert.equal(isCatalogPlaceholderKey('lyrics'), false);
  assert.equal(isCatalogPlaceholderKey('date'), false);
  assert.equal(isCatalogPlaceholderKey('reference'), false);
  assert.equal(isCatalogPlaceholderKey('text'), false);
  assert.equal(isCatalogPlaceholderKey('imageUrl'), false);
  assert.equal(isCatalogPlaceholderKey('person'), false);
  assert.deepEqual(
    PLACEHOLDER_CATALOG.filter((entry) => entry.type === 'image').map(
      (entry) => entry.key
    ),
    ['sermon_poster', 'family_photo', 'youth_photo']
  );
  assert.equal(keys.length, 17);
});

test('mirrored TypeScript and Go catalogs define identical keys and types', () => {
  const goSource = fs.readFileSync(
    path.join(root, 'internal', 'plan', 'validate_artifact.go'),
    'utf8'
  );
  const match = /catalogKeys\s*=\s*map\[string\]string\{([^}]+)\}/.exec(goSource);
  assert.ok(match, 'catalogKeys map found in validate_artifact.go');
  const goMap = {};
  for (const line of match[1].split('\n')) {
    const entryMatch = /"([^"]+)"\s*:\s*"([^"]+)"/.exec(line);
    if (entryMatch) {
      goMap[entryMatch[1]] = entryMatch[2];
    }
  }
  const tsMap = Object.fromEntries(
    PLACEHOLDER_CATALOG.map((entry) => [entry.key, entry.type])
  );
  assert.deepEqual(tsMap, goMap);
});

test('weekly resolver fills every catalog key it can', () => {
  const values = catalogValuesFromWeekly({
    serviceDate: '2026-07-11',
    scriptureReference: 'John 4:23',
    scriptureText: 'true worshipers',
    scriptureBibleVersion: 'NKJV',
    themeReference: 'Psalm 23:1',
    themeText: 'The Lord is my shepherd',
    specialSong: 'Ada Chen',
    sermonTitle: 'Living Water',
    sermonSpeaker: 'Jordan Blake',
    sermonGraphic: 'https://example.com/sermon.png',
    closingPrayer: 'Sam Rivera',
    familyRequest: 'Pray for the Harts',
    youthRequest: 'Youth camp',
    familyName: 'The Hart Family',
    youthName: 'Alex Hart',
    familyPhoto: 'https://example.com/family.png',
    youthPhoto: 'https://example.com/youth.png',
  });
  assert.equal(values.service_date, '2026-07-11');
  assert.equal(values.scripture_reference, 'John 4:23');
  assert.equal(values.scripture_text, 'true worshipers');
  assert.equal(values.scripture_bible_version, 'NKJV');
  assert.equal(values.theme_reference, 'Psalm 23:1');
  assert.equal(values.theme_text, 'The Lord is my shepherd');
  assert.equal(values.special_song, 'Ada Chen');
  assert.equal(values.sermon_title, 'Living Water');
  assert.equal(values.sermon_speaker_name, 'Jordan Blake');
  assert.equal(values.sermon_poster, 'https://example.com/sermon.png');
  assert.equal(values.closing_prayer_person, 'Sam Rivera');
  assert.equal(values.family_request, 'Pray for the Harts');
  assert.equal(values.youth_request, 'Youth camp');
  assert.equal(values.family_name, 'The Hart Family');
  assert.equal(values.youth_name, 'Alex Hart');
  assert.equal(values.family_photo, 'https://example.com/family.png');
  assert.equal(values.youth_photo, 'https://example.com/youth.png');
});

test('weekly resolver leaves scripture_* and theme_* independent — no fallback merge', () => {
  const values = catalogValuesFromWeekly({
    themeReference: 'Psalm 23:1',
    themeText: 'The Lord is my shepherd',
  });
  assert.equal(values.theme_reference, 'Psalm 23:1');
  assert.equal(values.theme_text, 'The Lord is my shepherd');
  assert.equal(values.scripture_reference, undefined);
  assert.equal(values.scripture_text, undefined);
  assert.equal(values.scripture_bible_version, undefined);
});
