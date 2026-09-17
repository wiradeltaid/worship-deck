/**
 * Live Preview projection: operator vocabulary, SongSet grouping and the
 * linear indexes that must stay locked to `buildSlidePlan` output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'artifact-preview-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
delete process.env.IMAGE_URL_ALLOWLIST;

const srcUrl = (...parts) =>
  pathToFileURL(path.join(root, 'src', ...parts)).href;

const { buildPreviewEntries, previewBadgeTone, previewLabel, resolvePreviewTitle, resolvePreviewBadge, resolveSongSetGroupBadge } = await import(
  srcUrl('lib', 'artifacts', 'preview-model.ts')
);
const { parseRundown } = await import(srcUrl('lib', 'parser.ts'));
const { buildArtifactPlan, buildSlidePlan } = await import(
  srcUrl('lib', 'slide-plan.ts')
);
const { loadSeedTemplates } = await import(srcUrl('lib', 'registry', 'seed.ts'));

const sample = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'sample-rundown.txt'),
  'utf8'
);

const FLYER = 'https://cdn.example.com/a.jpg';
const RICH_MEDIA = {
  flyers: [FLYER],
  sermonGraphicUrl: 'https://example.com/sermon.png',
  familyPhotoUrl: 'https://example.com/family.png',
  youthPhotoUrl: 'https://example.com/youth.png',
};

function richParsed() {
  const parsed = parseRundown(sample);
  parsed.familyPrayerRequest = 'Pray for the Lees';
  parsed.youthPrayerRequest = 'Youth camp';
  parsed.familyYouth = null;
  parsed.verseReading = { reference: 'Psalm 23:1', text: 'The Lord is my shepherd.' };
  return parsed;
}

/** PascalCase / underscore template labels must never reach an operator. */
const PASCAL_OR_SNAKE = /(?:[a-z0-9][A-Z])|_/;

test('every entry carries an operator-recognizable label', () => {
  const entries = buildPreviewEntries(
    buildArtifactPlan('2026-07-11', richParsed(), RICH_MEDIA)
  );
  assert.ok(entries.length > 40, 'sample rundown should produce a full plan');

  const seedLabels = new Set(
    loadSeedTemplates()
      .map((t) => t.label)
      .filter((label) => PASCAL_OR_SNAKE.test(label))
  );
  assert.equal(
    seedLabels.size,
    0,
    'seed registry must not use PascalCase or underscore labels'
  );

  for (const entry of entries) {
    assert.equal(typeof entry.label, 'string');
    assert.ok(entry.label.trim().length > 0, `empty label on ${entry.instanceId}`);
    assert.ok(
      !PASCAL_OR_SNAKE.test(entry.label),
      `raw template label leaked: ${entry.label}`
    );
    assert.ok(
      !seedLabels.has(entry.label),
      `raw template label leaked: ${entry.label}`
    );
  }

  const labels = new Set(entries.map((e) => e.label));
  for (const expected of [
    'Welcome',
    'Song Title',
    'Song Verse',
    'Song Reff',
    'Theme Verse',
    'Verse Reading',
    'Offering & Tithe',
    'Family & Youth',
    'Sermon Flyer',
    'Announcements',
    'Thank You',
  ]) {
    assert.ok(labels.has(expected), `missing operator label "${expected}"`);
  }
});

test('row labels are shown as-is; empty labels fall back to readable words', () => {
  assert.equal(
    previewLabel({
      templateId: 'brand-new-thing',
      label: 'My Custom Label',
      layoutKey: 'default',
    }),
    'My Custom Label'
  );
  assert.equal(
    previewLabel({
      templateId: 'another-thing',
      label: '',
      layoutKey: 'default',
    }),
    'Another Thing'
  );
});

test('SongSet children share one group and carry title/lyric roles', () => {
  const entries = buildPreviewEntries(
    buildArtifactPlan('2026-07-11', parseRundown(sample), [])
  );

  const opening = entries.filter((e) => e.groupId === 'bt-opening');
  assert.ok(opening.length >= 2, 'opening song should expand to several slides');

  const groupLabels = new Set(opening.map((e) => e.groupLabel));
  assert.equal(groupLabels.size, 1);
  const [groupLabel] = [...groupLabels];
  assert.ok(groupLabel && groupLabel.trim().length > 0);

  assert.equal(opening[0].role, 'title');
  assert.equal(opening[0].label, 'Song Title');
  // DEC-004: per-position SongSet rows are song-set-entry templates composed
  // from the shared layout trio.
  for (const child of opening.slice(1)) {
    assert.equal(child.role, 'lyric');
    assert.ok(child.label === 'Song Verse' || child.label === 'Song Reff', `unexpected lyric label ${child.label}`);
    assert.equal(child.baseType, 'song-set-entry');
  }

  // Story 20.1 (AC-3 delta a/c, AC-5): the standing Intercessory pair is no
  // longer a title-suppressed SongSet group at all — it is a fixed General
  // leaf, so it carries no group fields and Live Preview cannot nest it.
  assert.ok(!entries.some((e) => e.groupId === 'intercessory-671'));
  const standing671 = entries.find((e) => e.instanceId === 'intercessory-671-lyric-1');
  assert.ok(standing671);
  assert.equal(standing671.groupId, undefined);
  assert.equal(standing671.role, undefined);

  // Group children stay contiguous, so nesting cannot reorder the deck.
  const seen = new Map();
  entries.forEach((entry, idx) => {
    if (!entry.groupId) return;
    const previous = seen.get(entry.groupId);
    if (previous !== undefined) assert.equal(idx, previous + 1);
    seen.set(entry.groupId, idx);
  });

  // Leaves outside a group carry no grouping fields at all.
  const welcome = entries.find((e) => e.instanceId === 'welcome');
  assert.ok(welcome);
  assert.equal(welcome.groupId, undefined);
  assert.equal(welcome.groupLabel, undefined);
  assert.equal(welcome.role, undefined);
});

test('entry.index matches the slide position in buildSlidePlan', () => {
  const parsed = richParsed();
  const plan = buildSlidePlan('2026-07-11', parsed, RICH_MEDIA);
  const entries = buildPreviewEntries(
    buildArtifactPlan('2026-07-11', parsed, RICH_MEDIA)
  );

  assert.equal(entries.length, plan.length);
  entries.forEach((entry, idx) => {
    assert.equal(entry.index, idx);
    assert.equal(entry.instanceId, plan[idx].id);
    assert.equal(entry.templateId, plan[idx].artifact.templateId);
    assert.equal(entry.baseType, plan[idx].artifact.baseType);
  });
});

test('a service with no flyers or family content produces no empty groups', () => {
  const parsed = parseRundown(sample);
  parsed.familyPrayerRequest = null;
  parsed.youthPrayerRequest = null;
  parsed.familyYouth = null;

  const entries = buildPreviewEntries(
    buildArtifactPlan('2026-07-11', parsed, [])
  );
  const ids = entries.map((e) => e.instanceId);

  assert.ok(!ids.includes('family-youth'));
  assert.ok(!ids.includes('announcements'));
  assert.ok(!ids.includes('sermon-graphic'));
  assert.ok(!ids.some((id) => id.startsWith('flyer-')));

  const labels = entries.map((e) => e.label);
  assert.ok(!labels.includes('Family & Youth'));
  assert.ok(!labels.includes('Announcements'));
  assert.ok(!labels.includes('Announcement Flyer'));
  assert.ok(!labels.includes('Sermon Flyer'));

  // Every referenced group is non-empty and named.
  const byGroup = new Map();
  for (const entry of entries) {
    if (!entry.groupId) continue;
    assert.ok(entry.groupLabel && entry.groupLabel.trim().length > 0);
    assert.ok(entry.role === 'title' || entry.role === 'lyric');
    byGroup.set(entry.groupId, (byGroup.get(entry.groupId) || 0) + 1);
  }
  assert.ok(byGroup.size > 0);
  for (const [groupId, count] of byGroup) {
    assert.ok(count >= 1, `empty group ${groupId}`);
  }
});

test('entries expose no unresolved placeholders and no registry internals', () => {
  const entries = buildPreviewEntries(
    buildArtifactPlan('2026-07-11', richParsed(), RICH_MEDIA)
  );
  const allowed = new Set([
    'index',
    'instanceId',
    'templateId',
    'label',
    'baseType',
    'groupId',
    'groupLabel',
    'role',
    'roleLabel',
  ]);

  for (const entry of entries) {
    for (const key of Object.keys(entry)) {
      assert.ok(allowed.has(key), `unexpected preview field "${key}"`);
    }
    for (const value of Object.values(entry)) {
      if (typeof value !== 'string') continue;
      assert.ok(!value.includes('{{'), `unresolved placeholder in "${value}"`);
      assert.ok(!value.includes('}}'), `unresolved placeholder in "${value}"`);
      assert.ok(!value.includes('${'), `unresolved placeholder in "${value}"`);
    }
  }
});

test('badge tone is derived once for both preview surfaces', () => {
  const entries = buildPreviewEntries(
    buildArtifactPlan('2026-07-11', richParsed(), RICH_MEDIA)
  );
  const toneOf = (instanceId) => {
    const entry = entries.find((e) => e.instanceId === instanceId);
    assert.ok(entry, `missing entry ${instanceId}`);
    return previewBadgeTone(entry);
  };

  assert.equal(toneOf('bt-opening-title'), 'song-title');
  assert.equal(toneOf('bt-opening-lyric-1'), 'song-lyric');
  assert.equal(toneOf('theme-verse'), 'scripture');
  assert.equal(toneOf('verse-reading'), 'scripture');
  assert.equal(toneOf('flyer-0'), 'image');
  assert.equal(toneOf('sermon-graphic'), 'image');
  assert.equal(toneOf('welcome'), 'default');

  const tones = new Set(entries.map((e) => previewBadgeTone(e)));
  for (const tone of tones) {
    assert.ok(
      ['song-title', 'song-lyric', 'scripture', 'image', 'default'].includes(
        tone
      ),
      `unknown tone ${tone}`
    );
  }
});

test('SPEC-12-03: image elements preserve aspect ratio and default to contain objectFit in render model', async () => {
  const { resolveObjectFit, DEFAULT_OBJECT_FIT } = await import(
    srcUrl('lib', 'artifacts', 'render-model.ts')
  );
  assert.equal(DEFAULT_OBJECT_FIT, 'contain');
  assert.equal(resolveObjectFit({}), 'contain');
  assert.equal(resolveObjectFit({ objectFit: 'contain' }), 'contain');
  assert.equal(resolveObjectFit({ objectFit: 'cover' }), 'cover');

  const { calculateImageFit } = await import(
    srcUrl('lib', 'registry', 'canvas-utils.ts')
  );
  // Wide image (600x100 = 6:1) in container (300x100 = 3:1)
  const fitWide = calculateImageFit(
    { left: 0, top: 0, width: 300, height: 100 },
    { width: 600, height: 100 },
    'contain'
  );
  assert.equal(fitWide.scaleX, fitWide.scaleY);
  assert.equal((fitWide.width * fitWide.scaleX) / (fitWide.height * fitWide.scaleY), 6);
  assert.equal(fitWide.top, 25); // Centered vertically in 100px box ((100 - 50) / 2)
  assert.equal(fitWide.left, 0);
});


test('preview row badge resolution produces type, song-set-N, ann-set-N, and lyric roles with i18n support', async () => {
  const { resolveString } = await import(srcUrl('lib', 'i18n', 'index.ts'));

  const enT = (key) => resolveString(key, 'en');
  const idT = (key) => resolveString(key, 'id');

  // 1. General row badge shows slide type 'general'
  const generalEntry = { baseType: 'general', templateId: 'welcome', label: 'Welcome' };
  assert.equal(resolvePreviewBadge(undefined, generalEntry, undefined, enT), 'general');
  assert.equal(resolvePreviewBadge(undefined, generalEntry, undefined, idT), 'general');

  // Standalone slide tests (closed badge vocabulary: 'general', 'song-set-N', 'ann-set-N')
  assert.equal(resolvePreviewBadge({ kind: 'slide', title: 'Sermon Title' }, undefined, undefined, enT), 'general');
  assert.equal(resolvePreviewBadge({ kind: 'song-lyric', title: 'Hymn Title' }, undefined, undefined, enT), 'general');
  assert.equal(resolvePreviewBadge({ kind: 'scripture', title: 'Verse 1' }, undefined, undefined, enT), 'general');
  assert.equal(resolvePreviewBadge({ kind: 'custom-unrecognized-kind', title: 'Custom' }, undefined, undefined, enT), 'general');
  assert.equal(resolvePreviewBadge({ kind: 'slide' }, { baseType: 'general', label: 'Sermon' }, undefined, enT), 'general');
  assert.equal(resolvePreviewBadge({ kind: 'song-lyric' }, { baseType: 'general', label: 'Hymn' }, undefined, enT), 'general');

  // 2. Standalone song-set row badge with ordinal (e.g. song-set-1, song-set-2)
  const songSetEntry1 = { baseType: 'song-set-entry', templateId: 'bt-opening-song', label: 'Opening Song' };
  assert.equal(resolvePreviewBadge(undefined, songSetEntry1, { groupOrdinal: 1 }, enT), 'song-set-1');
  const songSetEntry2 = { baseType: 'song-set-entry', templateId: 'bt-closing-song', label: 'Closing Song' };
  assert.equal(resolvePreviewBadge(undefined, songSetEntry2, { groupOrdinal: 2 }, enT), 'song-set-2');
  assert.equal(resolveSongSetGroupBadge(1), 'song-set-1');
  assert.equal(resolveSongSetGroupBadge(2), 'song-set-2');
  assert.equal(resolveSongSetGroupBadge(undefined), 'song-set');

  // 3. Standalone ann-set row badge with ordinal (e.g. ann-set-1, ann-set-2)
  const annSetEntry1 = { baseType: 'ann-set-marker', templateId: 'ann-set-1', label: 'Announcements 1' };
  assert.equal(resolvePreviewBadge(undefined, annSetEntry1, { groupOrdinal: 1 }, enT), 'ann-set-1');
  const annSetEntry2 = { baseType: 'ann-set-marker', templateId: 'ann-set-2', label: 'Announcements 2' };
  assert.equal(resolvePreviewBadge(undefined, annSetEntry2, { groupOrdinal: 2 }, enT), 'ann-set-2');

  // 4. Song-set child: title role badge is localized (e.g. "title" / "judul")
  const childTitleEntry = {
    baseType: 'song-set-entry',
    templateId: 'bt-opening-song',
    label: 'Song Title',
    groupId: 'bt-opening',
    role: 'title',
  };
  assert.equal(resolvePreviewBadge(undefined, childTitleEntry, undefined, enT), 'title');
  assert.equal(resolvePreviewBadge(undefined, childTitleEntry, undefined, idT), 'judul');

  // 5. Song-set child: lyric role with verse number (e.g. "1/3" -> "verse 1" / "bait 1")
  const childVerse1Entry = {
    baseType: 'song-set-entry',
    templateId: 'bt-opening-song',
    label: 'Song Lyric',
    groupId: 'bt-opening',
    role: 'lyric',
  };
  const slideVerse1 = { kind: 'song-lyric', title: '1/3', body: 'Verse 1 text part 1' };
  assert.equal(resolvePreviewBadge(slideVerse1, childVerse1Entry, undefined, enT), 'verse 1');
  assert.equal(resolvePreviewBadge(slideVerse1, childVerse1Entry, undefined, idT), 'bait 1');

  // roleLabel takes precedence over slide.title or works without slide
  const childWithRoleLabel1 = { ...childVerse1Entry, roleLabel: '1/3' };
  assert.equal(resolvePreviewBadge(undefined, childWithRoleLabel1, undefined, enT), 'verse 1');
  assert.equal(resolvePreviewBadge(undefined, childWithRoleLabel1, undefined, idT), 'bait 1');
  const childWithRoleLabelReff = { ...childVerse1Entry, roleLabel: 'Reff' };
  assert.equal(resolvePreviewBadge(undefined, childWithRoleLabelReff, undefined, enT), 'reff');
  assert.equal(resolvePreviewBadge(undefined, childWithRoleLabelReff, undefined, idT), 'reff');
  const childWithRoleLabelChorus = { ...childVerse1Entry, roleLabel: 'Chorus' };
  assert.equal(resolvePreviewBadge(undefined, childWithRoleLabelChorus, undefined, enT), 'chorus');
  assert.equal(resolvePreviewBadge(undefined, childWithRoleLabelChorus, undefined, idT), 'chorus');
  const childWithRoleLabelAbsent = { ...childVerse1Entry, roleLabel: undefined };
  assert.equal(resolvePreviewBadge(undefined, childWithRoleLabelAbsent, undefined, enT), 'lyric');
  assert.equal(resolvePreviewBadge(undefined, childWithRoleLabelAbsent, undefined, idT), 'lirik');

  // 6. Song-set child continuation verse (same label "1/3" across multiple slides -> repeats "verse 1" / "bait 1")
  const slideVerse1Cont = { kind: 'song-lyric', title: '1/3', body: 'Verse 1 text part 2' };
  assert.equal(resolvePreviewBadge(slideVerse1Cont, childVerse1Entry, undefined, enT), 'verse 1');
  assert.equal(resolvePreviewBadge(slideVerse1Cont, childVerse1Entry, undefined, idT), 'bait 1');

  // 7. Song-set child: reff / chorus role (e.g. "reff" / "chorus")
  const slideReff = { kind: 'song-lyric', title: 'Reff', body: 'Refrain text' };
  assert.equal(resolvePreviewBadge(slideReff, childVerse1Entry, undefined, enT), 'reff');
  assert.equal(resolvePreviewBadge(slideReff, childVerse1Entry, undefined, idT), 'reff');

  const slideChorus = { kind: 'song-lyric', title: 'Chorus', body: 'Chorus text' };
  assert.equal(resolvePreviewBadge(slideChorus, childVerse1Entry, undefined, enT), 'chorus');
  assert.equal(resolvePreviewBadge(slideChorus, childVerse1Entry, undefined, idT), 'chorus');

  // 8. Song-set child: verse 2 ("2/3" -> "verse 2" / "bait 2")
  const slideVerse2 = { kind: 'song-lyric', title: '2/3', body: 'Verse 2 text' };
  assert.equal(resolvePreviewBadge(slideVerse2, childVerse1Entry, undefined, enT), 'verse 2');
  assert.equal(resolvePreviewBadge(slideVerse2, childVerse1Entry, undefined, idT), 'bait 2');

  // 9. Song-set child: unlabelled lyric row (body section / empty title) -> "lyric" / "lirik" (not "verse 1" / "bait 1")
  const slideUnlabelled = { kind: 'song-lyric', title: '', body: 'Unlabelled body text' };
  assert.equal(resolvePreviewBadge(slideUnlabelled, childVerse1Entry, undefined, enT), 'lyric');
  assert.equal(resolvePreviewBadge(slideUnlabelled, childVerse1Entry, undefined, idT), 'lirik');
  assert.notEqual(resolvePreviewBadge(slideUnlabelled, childVerse1Entry, undefined, enT), 'verse 1');
  assert.notEqual(resolvePreviewBadge(slideUnlabelled, childVerse1Entry, undefined, idT), 'bait 1');

  const slideUndefinedTitle = { kind: 'song-lyric', body: 'Unlabelled body text without title' };
  assert.equal(resolvePreviewBadge(slideUndefinedTitle, childVerse1Entry, undefined, enT), 'lyric');
  assert.equal(resolvePreviewBadge(slideUndefinedTitle, childVerse1Entry, undefined, idT), 'lirik');
  assert.notEqual(resolvePreviewBadge(slideUndefinedTitle, childVerse1Entry, undefined, enT), 'verse 1');
  assert.notEqual(resolvePreviewBadge(slideUndefinedTitle, childVerse1Entry, undefined, idT), 'bait 1');
});

test('preview row title resolution prefers title -> entry.label -> entry.baseType/kind -> fallback', async () => {
  const { resolveString } = await import(srcUrl('lib', 'i18n', 'index.ts'));

  // 1. Explicit slide title wins
  assert.equal(
    resolvePreviewTitle(
      { title: 'Opening Hymn' },
      { label: 'Welcome', baseType: 'general' }
    ),
    'Opening Hymn'
  );

  // 2. Empty slide title falls back to entry.label
  assert.equal(
    resolvePreviewTitle(
      { title: '' },
      { label: 'Theme Verse', baseType: 'general' }
    ),
    'Theme Verse'
  );

  // 3. Missing slide title and missing entry.label falls back to entry.baseType chip label
  assert.equal(
    resolvePreviewTitle(
      { title: '' },
      { label: '', baseType: 'general' }
    ),
    'general'
  );

  // 4. Legacy slide without entry falls back to slide.kind
  assert.equal(
    resolvePreviewTitle(
      { title: '', kind: 'scripture' },
      undefined
    ),
    'scripture'
  );

  // 5. Empty slide without title, entry, or kind falls back to i18n
  assert.equal(
    resolvePreviewTitle(
      { title: '', kind: '' },
      undefined,
      resolveString('form.preview.untitledSlide', 'en')
    ),
    'Untitled slide'
  );

  assert.equal(
    resolvePreviewTitle(
      { title: '', kind: '' },
      undefined,
      resolveString('form.preview.untitledSlide', 'id')
    ),
    'Slide tanpa judul'
  );

  // 6. Whitespace-only values fall back
  assert.equal(
    resolvePreviewTitle(
      { title: '   ', kind: '   ' },
      { label: '   ', baseType: 'unknown-kind' },
      'Fallback'
    ),
    'Fallback'
  );

  // 7. Fully undefined inputs fall back
  assert.equal(
    resolvePreviewTitle(undefined, undefined, 'Fallback'),
    'Fallback'
  );
});

test('AC-03 guard: SlidePreviewList and preview rendering components contain no hardcoded "Untitled Slide" literal', () => {
  const PREVIEW_COMPONENTS = [
    path.join(root, 'src', 'components', 'SlidePreviewList.tsx'),
  ];

  const UNTITLED_SLIDE_LITERAL_REGEX = /['"`]untitled\s+slide['"`]/i;

  for (const filePath of PREVIEW_COMPONENTS) {
    const rel = path.relative(root, filePath).split(path.sep).join('/');
    const source = fs.readFileSync(filePath, 'utf8');
    // Strip comments to inspect code & JSX literals
    const cleanSource = source
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');

    const match = UNTITLED_SLIDE_LITERAL_REGEX.exec(cleanSource);
    assert.ok(
      !match,
      `Hardcoded user-facing literal "${match?.[0]}" found in ${rel} (AC-03 violation)`
    );
  }
});

test('SlidePreviewList carries no hardcoded "Song Set" badge literal', () => {
  const previewPath = path.join(root, 'src', 'components', 'SlidePreviewList.tsx');
  const source = fs.readFileSync(previewPath, 'utf8');
  const cleanSource = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

  const match = /Song Set/.exec(cleanSource);
  assert.ok(
    !match,
    `Hardcoded badge literal "Song Set" found in SlidePreviewList.tsx`
  );
});

test('ArtifactSlide permits background override for verse, reff, and lyric layout keys', () => {
  const artifactSlidePath = path.join(root, 'src', 'components', 'artifacts', 'ArtifactSlide.tsx');
  const source = fs.readFileSync(artifactSlidePath, 'utf8');

  function getLayoutKeyMatches(src) {
    const clean = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const isVerseOrReffDecl = clean.match(/const\s+isVerseOrReff\s*=\s*([^;]+);/);
    assert.ok(isVerseOrReffDecl, 'ArtifactSlide must define isVerseOrReff');
    const expr = isVerseOrReffDecl[1];
    const keys = [];
    for (const m of expr.matchAll(/instance\.layoutKey\s*===?\s*['"]([^'"]+)['"]/g)) {
      keys.push(m[1]);
    }
    return keys;
  }

  const keys = getLayoutKeyMatches(source);
  assert.ok(keys.includes('verse'), 'ArtifactSlide must match layoutKey "verse"');
  assert.ok(keys.includes('reff'), 'ArtifactSlide must match layoutKey "reff"');
  assert.ok(keys.includes('lyric'), 'ArtifactSlide must match layoutKey "lyric"');
});


