/**
 * The Presenter's slide list and jump grid as pure data.
 *
 * The arrangement (labels, order, SongSet grouping, which row owns the active
 * slide, where an arrow key moves the grid selection) is projected by
 * `present/presenter-model.ts`, so it is asserted here without a browser. The
 * taxonomy itself must keep coming from `preview-model` — a second copy is
 * exactly the drift this file is meant to catch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'presenter-model-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
delete process.env.IMAGE_URL_ALLOWLIST;

const srcUrl = (...parts) =>
  pathToFileURL(path.join(root, 'src', ...parts)).href;

const {
  PRESENTER_TONE_CLASS,
  activePresenterEntry,
  buildPresenterEntries,
  buildPresenterRows,
  clampSlideIndex,
  isGridNavigationKey,
  moveGridSelection,
  rowContainsIndex,
} = await import(
  srcUrl('operator', 'present', 'presenter-model.ts')
);
const { buildPreviewEntries, previewBadgeTone } = await import(
  srcUrl('lib', 'artifacts', 'preview-model.ts')
);
const { parseRundown } = await import(srcUrl('lib', 'parser.ts'));
const { buildArtifactPlan, buildSlidePlan } = await import(
  srcUrl('lib', 'slide-plan.ts')
);

const sample = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'sample-rundown.txt'),
  'utf8'
);

const DATE = '2026-07-11';
const MEDIA = {
  flyers: ['https://cdn.example.com/a.jpg'],
  sermonGraphicUrl: 'https://example.com/sermon.png',
  familyPhotoUrl: 'https://example.com/family.png',
  youthPhotoUrl: 'https://example.com/youth.png',
};

function richParsed() {
  const parsed = parseRundown(sample);
  parsed.familyPrayerRequest = 'Pray for the Lees';
  parsed.youthPrayerRequest = 'Youth camp';
  parsed.familyYouth = null;
  parsed.verseReading = {
    reference: 'Psalm 23:1',
    text: 'The Lord is my shepherd.',
  };
  return parsed;
}

function presenterFixture() {
  const parsed = richParsed();
  const slides = buildSlidePlan(DATE, parsed, MEDIA);
  const entries = buildPresenterEntries(slides);
  return { parsed, slides, entries, rows: buildPresenterRows(entries) };
}

test('list entries mirror the deck one-for-one, in order', () => {
  const { slides, entries } = presenterFixture();

  assert.ok(slides.length > 40, 'sample rundown should produce a full deck');
  assert.equal(entries.length, slides.length);
  entries.forEach((entry, i) => {
    assert.equal(entry.index, i, 'entry.index is the slide index');
    assert.equal(entry.instanceId, slides[i].id);
    assert.equal(entry.templateId, slides[i].artifact.templateId);
  });

  // The filmstrip and the jump grid both key one flat list by `instanceId`, so
  // a collision would silently drop a thumbnail rather than fail loudly.
  const ids = new Set(entries.map((entry) => entry.instanceId));
  assert.equal(ids.size, entries.length, 'instanceId is unique per slide');
});

test('labels and tone are the preview taxonomy, not a second one', () => {
  const { parsed, entries } = presenterFixture();
  const preview = buildPreviewEntries(buildArtifactPlan(DATE, parsed, MEDIA));

  assert.equal(entries.length, preview.length);
  entries.forEach((entry, i) => {
    assert.equal(entry.label, preview[i].label);
    assert.equal(entry.groupId, preview[i].groupId);
    assert.equal(entry.groupLabel, preview[i].groupLabel);
    assert.equal(entry.role, preview[i].role);
    assert.equal(entry.tone, previewBadgeTone(preview[i]));
  });

  const labels = new Set(entries.map((e) => e.label));
  for (const expected of ['Welcome', 'Song Title', 'Song Verse', 'Song Reff', 'Theme Verse']) {
    assert.ok(labels.has(expected), `missing operator label "${expected}"`);
  }

  // Every tone a real deck produces must have a class, or a badge renders bare.
  for (const entry of entries) {
    assert.equal(
      typeof PRESENTER_TONE_CLASS[entry.tone],
      'string',
      `no presenter badge class for tone ${entry.tone}`
    );
  }
});

test('contiguous SongSet members fold into one group row without reordering', () => {
  const { entries, rows } = presenterFixture();

  // Rows re-expand to exactly the entry sequence: nothing dropped or moved.
  const flattened = rows.flatMap((row) =>
    row.kind === 'slide' ? [row.entry] : row.entries
  );
  assert.deepEqual(
    flattened.map((e) => e.index),
    entries.map((e) => e.index)
  );

  const groups = rows.filter((row) => row.kind === 'group');
  assert.ok(groups.length > 0, 'sample deck should contain song sets');
  for (const group of groups) {
    assert.ok(group.label.trim().length > 0, 'group row must be named');
    assert.ok(group.entries.length > 0);
    const groupIds = new Set(group.entries.map((e) => e.groupId));
    assert.equal(groupIds.size, 1, 'one group row per SongSet');
    assert.equal([...groupIds][0], group.key);
    group.entries.forEach((entry, i) => {
      if (i === 0) return;
      assert.equal(
        entry.index,
        group.entries[i - 1].index + 1,
        'group children stay contiguous'
      );
    });
  }

  // A standalone slide is never swallowed into a neighbouring group.
  const welcome = rows.find(
    (row) => row.kind === 'slide' && row.entry.instanceId === 'welcome'
  );
  assert.ok(welcome, 'welcome should be a standalone row');

  // Two different song sets never merge, even when they sit back to back.
  const groupKeys = groups.map((g) => g.key);
  assert.equal(new Set(groupKeys).size, groupKeys.length);
});

test('exactly one row owns the active slide, at every index', () => {
  const { entries, rows } = presenterFixture();

  for (let i = 0; i < entries.length; i += 1) {
    const owners = rows.filter((row) => rowContainsIndex(row, i));
    assert.equal(owners.length, 1, `slide ${i} should be owned by one row`);
  }
  assert.equal(
    rows.filter((row) => rowContainsIndex(row, entries.length)).length,
    0,
    'an out-of-range index owns no row'
  );
});

test('the active entry follows the index and is bounded by the deck', () => {
  const { entries } = presenterFixture();
  const last = entries.length - 1;

  assert.equal(activePresenterEntry(entries, 0).index, 0);
  assert.equal(activePresenterEntry(entries, 7).index, 7);
  assert.equal(activePresenterEntry(entries, last).index, last);
  // Out of range clamps rather than blanking the header.
  assert.equal(activePresenterEntry(entries, -5).index, 0);
  assert.equal(activePresenterEntry(entries, last + 99).index, last);
  assert.equal(activePresenterEntry([], 3), null);

  assert.equal(clampSlideIndex(-1, 10), 0);
  assert.equal(clampSlideIndex(10, 10), 9);
  assert.equal(clampSlideIndex(4, 10), 4);
  assert.equal(clampSlideIndex(2.7, 10), 2);
  assert.equal(clampSlideIndex(3, 0), 0, 'empty deck cannot produce -1');
  assert.equal(clampSlideIndex(Number.NaN, 10), 0);
});

test('grid arrows move the selection by one, or by a row of columns', () => {
  const length = 23;
  const columns = 5;

  assert.equal(moveGridSelection(0, 'ArrowRight', columns, length), 1);
  assert.equal(moveGridSelection(1, 'ArrowLeft', columns, length), 0);
  assert.equal(moveGridSelection(0, 'ArrowDown', columns, length), 5);
  assert.equal(moveGridSelection(7, 'ArrowUp', columns, length), 2);
  assert.equal(moveGridSelection(7, 'PageDown', columns, length), 12);
  assert.equal(moveGridSelection(7, 'PageUp', columns, length), 2);
  assert.equal(moveGridSelection(7, 'Home', columns, length), 0);
  assert.equal(moveGridSelection(7, 'End', columns, length), length - 1);

  // Edges clamp instead of wrapping.
  assert.equal(moveGridSelection(0, 'ArrowLeft', columns, length), 0);
  assert.equal(moveGridSelection(0, 'ArrowUp', columns, length), 0);
  assert.equal(moveGridSelection(length - 1, 'ArrowRight', columns, length), length - 1);
  assert.equal(moveGridSelection(length - 1, 'ArrowDown', columns, length), length - 1);
  assert.equal(moveGridSelection(21, 'ArrowDown', columns, length), length - 1);

  // A single-column layout and an empty deck must not produce a bad index.
  assert.equal(moveGridSelection(3, 'ArrowDown', 1, length), 4);
  assert.equal(moveGridSelection(3, 'ArrowDown', 0, length), 4);
  assert.equal(moveGridSelection(3, 'ArrowDown', columns, 0), 0);

  // Anything else leaves the selection alone (clamped).
  assert.equal(moveGridSelection(7, 'Enter', columns, length), 7);
  assert.equal(moveGridSelection(7, 'a', columns, length), 7);
  assert.equal(moveGridSelection(99, 'Escape', columns, length), length - 1);
});

test('only the navigation keys are claimed by the grid', () => {
  for (const key of [
    'ArrowRight',
    'ArrowLeft',
    'ArrowDown',
    'ArrowUp',
    'PageDown',
    'PageUp',
    'Home',
    'End',
  ]) {
    assert.equal(isGridNavigationKey(key), true, `${key} should be claimed`);
  }
  // Escape must reach the dialog, Enter must reach the focused tile, and space
  // must not silently advance anything while the grid is open.
  for (const key of ['Escape', 'Enter', ' ', 'Tab', 'a']) {
    assert.equal(isGridNavigationKey(key), false, `${key} must not be claimed`);
  }
});

test('SPEC-41-02: buildPresenterRows discriminates groupKind for announcement sets and preserves active slide navigation', () => {
  const entries = [
    {
      index: 0,
      instanceId: 'ann-1',
      templateId: 'ann-1',
      label: 'Jadwal Ibadah',
      baseType: 'general',
      groupId: 'ann-marker-set-1',
      groupLabel: 'Warta Jemaat',
      role: 'announcement',
      roleLabel: 'Jadwal Ibadah',
      tone: 'image',
    },
    {
      index: 1,
      instanceId: 'ann-2',
      templateId: 'ann-2',
      label: 'Kerja Bakti',
      baseType: 'general',
      groupId: 'ann-marker-set-1',
      groupLabel: 'Warta Jemaat',
      role: 'announcement',
      roleLabel: 'Kerja Bakti',
      tone: 'image',
    },
    {
      index: 2,
      instanceId: 'song-title-1',
      templateId: 'song-title',
      label: 'Song Title',
      baseType: 'song-set-entry',
      groupId: 'song-opening',
      groupLabel: 'Di Hadapan Hadirat-Mu',
      role: 'title',
      tone: 'song-title',
    },
  ];

  const rows = buildPresenterRows(entries);
  assert.equal(rows.length, 2, 'Should fold into 2 groups');

  const annGroup = rows[0];
  const songGroup = rows[1];

  assert.equal(annGroup.kind, 'group');
  assert.equal(annGroup.groupKind, 'announcement');
  assert.equal(annGroup.label, 'Warta Jemaat');
  assert.equal(annGroup.entries.length, 2);

  assert.equal(songGroup.kind, 'group');
  assert.equal(songGroup.groupKind, 'song-set');
  assert.equal(songGroup.label, 'Di Hadapan Hadirat-Mu');
  assert.equal(songGroup.entries.length, 1);

  // Active slide navigation: index 1 is owned by the announcement group
  assert.ok(rowContainsIndex(annGroup, 1));
  assert.ok(!rowContainsIndex(songGroup, 1));

  // Index 2 is owned by song group
  assert.ok(rowContainsIndex(songGroup, 2));
  assert.ok(!rowContainsIndex(annGroup, 2));
});
