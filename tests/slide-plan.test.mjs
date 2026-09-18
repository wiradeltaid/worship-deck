/**
 * Shared slide plan: Part C standing slides + order used by PPTX / slideshow.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'slide-plan-test-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
delete process.env.IMAGE_URL_ALLOWLIST;

const { parseRundown } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'parser.ts')).href
);
const { buildSlidePlan, buildArtifactPlan } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'slide-plan.ts')).href
);
const { getDb } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);
const { createAuthoredGeneralTemplate } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'store.ts')).href
);

const sample = fs.readFileSync(
  path.join(__dirname, 'fixtures', 'sample-rundown.txt'),
  'utf8'
);

test('sample rundown preserves timings on roles/sections', () => {
  const parsed = parseRundown(sample);
  const bibleTalk = parsed.items.find(
    (i) => i.type === 'section' && /BIBLE TALK/i.test(i.title)
  );
  assert.ok(bibleTalk?.timing);
  assert.match(bibleTalk.timing, /09/);

  const prayerPartners = parsed.items.find(
    (i) => i.type === 'role' && /Prayer Partners/i.test(i.role)
  );
  assert.ok(prayerPartners?.timing);
  assert.match(prayerPartners.timing, /5\s*m/i);

  const sermon = parsed.items.find(
    (i) => i.type === 'role' && /^Sermon$/i.test(i.role)
  );
  assert.ok(sermon?.timing);
  assert.match(sermon.timing, /45/i);
});

test('buildSlidePlan omits announcements title when flyers empty; Part C standing remains', () => {
  const parsed = parseRundown(sample);
  const plan = buildSlidePlan('2026-07-11', parsed, []);
  const ids = plan.map((s) => s.id);

  assert.ok(!ids.includes('announcements'));
  assert.ok(ids.includes('welcome-repeat'));
  assert.ok(ids.includes('offering-tithe'));
  assert.ok(ids.includes('midweek-prayer'));
  assert.ok(ids.includes('fellowship-etiquette'));
  assert.ok(ids.includes('contact'));
  assert.ok(ids.includes('thank-you'));

  const offering = plan.find((s) => s.id === 'offering-tithe');
  assert.ok(offering?.lines?.some((l) => /Bank Mandiri/i.test(l)));

  assert.ok(ids.indexOf('offering-tithe') < ids.indexOf('thank-you'));
  assert.ok(!ids.includes('special-song'));
});

test('buildSlidePlan includes announcements title when flyers present', () => {
  const parsed = parseRundown(sample);
  const flyer = 'https://cdn.example.com/a.jpg';
  const plan = buildSlidePlan('2026-07-11', parsed, [flyer]);
  const ids = plan.map((s) => s.id);

  assert.ok(ids.includes('announcements'));
  assert.ok(ids.includes('welcome-repeat'));
  assert.ok(ids.includes('flyer-0'));
  assert.ok(ids.indexOf('announcements') < ids.indexOf('flyer-0'));
});

test('buildSlidePlan ignores extensionless flyer URLs for announcements title', () => {
  const parsed = parseRundown(sample);
  const plan = buildSlidePlan('2026-07-11', parsed, [
    'https://cdn.example.com/clip',
  ]);
  const ids = plan.map((s) => s.id);
  assert.ok(!ids.includes('announcements'));
  assert.ok(!ids.includes('flyer-0'));
});

/**
 * AC-2: the flattened deck order follows the persisted row positions, not a
 * label sort or a TypeScript sequence. Both rows are ordinary General leaves
 * which the fixture always renders, so their relative order is observable in
 * the built plan without involving the transitional SongSet exception.
 */
test('buildSlidePlan moves flattened slides when two registry positions are swapped in SQL', () => {
  const db = getDb();
  const parsed = parseRundown(sample);
  const firstId = 'offering-tithe';
  const secondId = 'midweek-prayer';
  const positions = db
    .prepare(`SELECT id, position FROM artifact_templates WHERE id IN (?, ?)`)
    .all(firstId, secondId);
  const firstPosition = positions.find((row) => row.id === firstId)?.position;
  const secondPosition = positions.find((row) => row.id === secondId)?.position;

  assert.equal(typeof firstPosition, 'number');
  assert.equal(typeof secondPosition, 'number');

  const before = buildSlidePlan('2026-07-11', parsed, []).map((slide) => slide.id);
  assert.ok(before.indexOf(firstId) < before.indexOf(secondId));

  try {
    db.prepare(
      `UPDATE artifact_templates
       SET position = CASE id WHEN ? THEN ? WHEN ? THEN ? END
       WHERE id IN (?, ?)`
    ).run(firstId, secondPosition, secondId, firstPosition, firstId, secondId);

    const after = buildSlidePlan('2026-07-11', parsed, []).map((slide) => slide.id);
    assert.ok(
      after.indexOf(secondId) < after.indexOf(firstId),
      'the flattened plan must follow the swapped artifact_templates.position values'
    );
  } finally {
    db.prepare(
      `UPDATE artifact_templates
       SET position = CASE id WHEN ? THEN ? WHEN ? THEN ? END
       WHERE id IN (?, ?)`
    ).run(firstId, firstPosition, secondId, secondPosition, firstId, secondId);
  }
});

/**
 * Story 20.1, AC-3 delta (a): the three fixed liturgical songs (#671, #684,
 * "We Have This Hope") render as General slides instead of title-suppressed
 * SongSet groups. Their `kind` is now `body` (like Offering & Tithe /
 * Midweek Prayer) with `.lines` derived from the hydrated layout, not the
 * SongSet `song-lyric` kind with a single `.body` string — `skipTitle` is
 * gone (AC-4), and there is no group node left to carry a title/lyric role at
 * all (AC-3 delta c). The text itself is unchanged, byte-for-byte what the
 * deleted `splitLyricsLabeled` / `splitWeHaveThisHopeSlides` calls produced
 * (AC-5) — this only re-anchors the assertions on the new shape.
 */
test('buildSlidePlan renders the three fixed liturgical songs as General slides, order intact', () => {
  const parsed = parseRundown(sample);
  const plan = buildSlidePlan('2026-07-11', parsed, []);
  const ids = plan.map((s) => s.id);

  const beforeDivider = ids.indexOf('intercessory-prayer');
  const lyric671 = ids.indexOf('intercessory-671-lyric-1');
  const duringDivider = ids.indexOf('intercessory-prayer-during');
  const lyric684 = ids.indexOf('intercessory-684-lyric-1');

  assert.ok(beforeDivider >= 0);
  assert.ok(lyric671 >= 0);
  assert.ok(duringDivider >= 0);
  assert.ok(lyric684 >= 0);
  assert.ok(!ids.includes('intercessory-671-title'));
  assert.ok(!ids.includes('intercessory-684-title'));
  assert.ok(beforeDivider < lyric671);
  assert.ok(lyric671 < duringDivider);
  assert.ok(duringDivider < lyric684);

  const openingCue = ids.indexOf('ds-opening-song-cue');
  assert.ok(openingCue >= 0);
  assert.ok(openingCue < beforeDivider);

  // Payload listed #671/#684 in sample rundown — standing pair only, not ds-middle.
  assert.ok(!ids.some((id) => id.startsWith('ds-middle-')));

  const sdah671 = plan.filter(
    (s) => s.kind === 'song-title' && /SDAH\s*671/i.test(s.subtitle || '')
  );
  const sdah684 = plan.filter(
    (s) => s.kind === 'song-title' && /SDAH\s*684/i.test(s.subtitle || '')
  );
  assert.equal(sdah671.length, 0);
  assert.equal(sdah684.length, 0);

  const slide671 = plan.find((s) => s.id === 'intercessory-671-lyric-1');
  assert.equal(slide671.kind, 'body');
  assert.deepEqual(slide671.lines, [
    "Now, Dear Lord, as we pray, Take our hearts and minds far away; From the " +
      "press of the world all around; To Your throne where grace does abound. " +
      "May our lives be transform'd by Your love, May our souls be refreshed " +
      'from above. At this moment, let people everywhere; Join us now as we ' +
      'come to You in prayer.',
  ]);

  const slide684 = plan.find((s) => s.id === 'intercessory-684-lyric-1');
  assert.equal(slide684.kind, 'body');
  assert.deepEqual(slide684.lines, [
    'Hear our prayer, O Lord, Hear our prayer, O Lord; Incline Thine ear to us, ' +
      'And grant us Thy peace. Amen.',
  ]);

  // Hope: no title slide; two fixed General lyric-page rows (AC-5), still 2 pages.
  assert.ok(!ids.includes('hope-title'));
  const hopeLyrics = plan.filter((s) => s.id.startsWith('hope-lyric-'));
  assert.equal(hopeLyrics.length, 2);
  assert.equal(hopeLyrics[0].kind, 'body');
  assert.equal(hopeLyrics[1].kind, 'body');
  assert.deepEqual(hopeLyrics[0].lines, [
    'We have this hope that burns within our hearts,',
    'Hope in the coming of the Lord.',
    'We have this faith that Christ alone imparts,',
    'Faith in the promise of His Word.',
  ]);
  assert.deepEqual(hopeLyrics[1].lines, [
    'We believe the time is here,',
    'When the nations far and near',
    'Shall awake, and shout, and sing',
    'Hallelujah! Christ is King!',
    'We have this hope that burns within our hearts,',
    'Hope in the coming of the Lord.',
  ]);

  // BT/DS opening still keep song-title slides
  assert.ok(ids.includes('bt-opening-title'));
  assert.ok(ids.includes('ds-opening-title'));
});

/** AC-4: `skipTitle` is deleted, not migrated, and nothing replaces it. */
test('skipTitle occurs nowhere in src/', () => {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  walk(path.join(root, 'src'));

  const offenders = files.filter((f) => fs.readFileSync(f, 'utf8').includes('skipTitle'));
  assert.deepEqual(offenders, [], `skipTitle survives in: ${offenders.join(', ')}`);
});

test('buildSlidePlan omits KJV lookup — theme uses standing default text', () => {
  const parsed = parseRundown(sample);
  parsed.themeVerse = null;
  const plan = buildSlidePlan('2026-07-11', parsed, []);
  const theme = plan.find((s) => s.id === 'theme-verse');
  assert.equal(theme?.subtitle, 'John 4:23');
  assert.ok(theme?.body?.includes('true worshipers'));
});

test('buildSlidePlan combines Family & Youth on single Slide 56', () => {
  const parsed = parseRundown(sample);
  parsed.familyPrayerRequest = 'Pray for the Lees';
  parsed.youthPrayerRequest = 'Youth camp';
  parsed.familyYouth = null;
  const plan = buildSlidePlan('2026-07-11', parsed, {
    familyPhotoUrl: 'https://example.com/family.png',
    youthPhotoUrl: 'https://example.com/youth.png',
  });
  const familySlides = plan.filter((s) => s.id === 'family-youth');
  assert.equal(familySlides.length, 1);
  assert.equal(familySlides[0].kind, 'family');
  assert.match(familySlides[0].body || '', /Family: Pray for the Lees/);
  assert.match(familySlides[0].body || '', /Youth: Youth camp/);
  assert.equal(familySlides[0].imageUrl, 'https://example.com/family.png');
  assert.equal(
    familySlides[0].secondaryImageUrl,
    'https://example.com/youth.png'
  );
  assert.equal(plan.filter((s) => s.id === 'family-photo').length, 0);
  assert.equal(plan.filter((s) => s.id === 'youth-photo').length, 0);
});

test('authored General without a row handler still appears in the plan', () => {
  const db = getDb();
  const created = createAuthoredGeneralTemplate(db, {
    label: 'Custom board',
    id: 'custom-plan-leaf',
  });
  try {
    const parsed = parseRundown(sample);
    const plan = buildSlidePlan('2026-07-11', parsed, []);
    assert.ok(
      plan.some((slide) => slide.id === 'custom-plan-leaf'),
      'an authored General must be a deck leaf even without a ROW_HANDLER'
    );
  } finally {
    db.prepare(`DELETE FROM artifact_templates WHERE id = ?`).run(created.id);
  }
});

test('SPEC-41-01: ann-set-marker expands into structured group node with unique identities and ordered children', () => {
  const db = getDb();
  const now = new Date().toISOString();

  // Create an announcement set with 2 slides
  const setRes = db
    .prepare(`INSERT INTO announcement_sets (label, updated_at) VALUES (?, ?)`)
    .run('Warta Jemaat', now);
  const setId = Number(setRes.lastInsertRowid);

  const slidePayload1 = JSON.stringify({
    schemaVersion: 1,
    label: 'Jadwal Ibadah',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [],
      },
    },
  });
  const slidePayload2 = JSON.stringify({
    schemaVersion: 1,
    label: 'Kerja Bakti',
    baseType: 'general',
    placeholders: [],
    layouts: {
      default: {
        aspectRatio: '16:9',
        backgroundColor: '#000000',
        elements: [],
      },
    },
  });
  const sl1 = db
    .prepare(
      `INSERT INTO announcement_set_slides (ann_set_id, label, payload, position, updated_at) VALUES (?, ?, ?, 0, ?)`
    )
    .run(setId, 'Jadwal Ibadah', slidePayload1, now);
  const sl2 = db
    .prepare(
      `INSERT INTO announcement_set_slides (ann_set_id, label, payload, position, updated_at) VALUES (?, ?, ?, 1, ?)`
    )
    .run(setId, 'Kerja Bakti', slidePayload2, now);

  // Insert two separate marker templates referencing the same announcement set
  const marker1Id = 'ann-marker-test-1';
  const marker2Id = 'ann-marker-test-2';
  db.prepare(
    `INSERT INTO artifact_templates (id, label, base_type, ann_set_id, position, updated_at) VALUES (?, 'Ann 1', 'ann-set-marker', ?, 95, ?)`
  ).run(marker1Id, setId, now);
  db.prepare(
    `INSERT INTO artifact_templates (id, label, base_type, ann_set_id, position, updated_at) VALUES (?, 'Ann 2', 'ann-set-marker', ?, 96, ?)`
  ).run(marker2Id, setId, now);

  try {
    const parsed = parseRundown(sample);
    const nodes = buildArtifactPlan('2026-07-11', parsed, []);

    // Verify both markers emitted group nodes
    const group1 = nodes.find((n) => n.kind === 'group' && n.id === `${marker1Id}-set-${setId}`);
    const group2 = nodes.find((n) => n.kind === 'group' && n.id === `${marker2Id}-set-${setId}`);

    assert.ok(group1, 'Marker 1 must emit a structured group node');
    assert.ok(group2, 'Marker 2 must emit a structured group node');

    // Both groups have distinct IDs despite referencing the same announcement set
    assert.notEqual(group1.id, group2.id, 'Repeated markers must produce collision-safe group IDs');
    assert.equal(group1.label, 'Warta Jemaat', 'Group label must inherit announcement set label');

    // Children in group 1
    assert.equal(group1.children.length, 2, 'Group 1 must contain 2 child slides');
    const child1 = group1.children[0].instance;
    const child2 = group1.children[1].instance;

    assert.equal(child1.instanceId, `${marker1Id}-ann-slide-${sl1.lastInsertRowid}`);
    assert.equal(child2.instanceId, `${marker1Id}-ann-slide-${sl2.lastInsertRowid}`);
    assert.equal(child1.group?.role, 'announcement');
    assert.equal(child1.group?.roleLabel, 'Jadwal Ibadah');
    assert.equal(child2.group?.role, 'announcement');
    assert.equal(child2.group?.roleLabel, 'Kerja Bakti');

    // Distinct instance IDs for repeated marker
    const child1Marker2 = group2.children[0].instance;
    assert.notEqual(child1.instanceId, child1Marker2.instanceId, 'Child instances across repeated markers must have distinct IDs');
  } finally {
    db.prepare(`DELETE FROM artifact_templates WHERE id IN (?, ?)`).run(marker1Id, marker2Id);
    db.prepare(`DELETE FROM announcement_set_slides WHERE ann_set_id = ?`).run(setId);
    db.prepare(`DELETE FROM announcement_sets WHERE id = ?`).run(setId);
  }
});
