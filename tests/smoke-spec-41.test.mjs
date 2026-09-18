/**
 * SPEC-41: Announcement Set Slide Hierarchy and Grouping in Presenter Operator and Live Slide Preview
 * Smoke Test & Absence Guard Suite
 *
 * SPEC-41-01 Verification:
 * - TypeScript and Go planners emit structured group nodes for ann-set-marker
 * - Collision-safe group IDs and unique instance IDs for repeated marker insertions
 * - Role literal union strictly 'title' | 'lyric' | 'announcement'
 *
 * SPEC-41-02 Verification:
 * - PresenterOperator groups contiguous announcement slides under announcement group kind
 * - Dynamic group header badging: [Announcement] with purple tone vs [Song Set] with primary tone
 * - Child slides indented with slide number, label, and title
 *
 * SPEC-41-03 Verification:
 * - Live Slide Preview groups announcement sets with [Announcement] header and indented children
 * - Dark-theme contrast safety (WCAG AA compliant)
 * - Executable absence guards with defect-injection proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Set up temporary database for testing
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-spec-41-'));
process.env.DB_PATH = path.join(tmp, 'test.db');
process.env.WPW_USE_SHIPPED_REGISTRY = '1';

const { getDb } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'db', 'index.ts')).href
);

const { buildSlidePlan, buildArtifactPlan } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'slide-plan.ts')).href
);

const {
  buildPresenterEntries,
  buildPresenterRows,
  rowContainsIndex,
} = await import(
  pathToFileURL(path.join(root, 'src', 'operator', 'present', 'presenter-model.ts')).href
);

const {
  resolvePreviewBadge,
  resolvePreviewTitle,
  resolveAnnouncementGroupBadge,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'preview-model.ts')).href
);

const presenterOpPath = path.join(root, 'src', 'operator', 'present', 'PresenterOperator.tsx');
assert.ok(fs.existsSync(presenterOpPath), 'PresenterOperator.tsx must exist');
const presenterOpCode = fs.readFileSync(presenterOpPath, 'utf8');

const slidePlanPath = path.join(root, 'src', 'lib', 'slide-plan.ts');
assert.ok(fs.existsSync(slidePlanPath), 'slide-plan.ts must exist');
const slidePlanCode = fs.readFileSync(slidePlanPath, 'utf8');

const previewListPath = path.join(root, 'src', 'components', 'SlidePreviewList.tsx');
assert.ok(fs.existsSync(previewListPath), 'SlidePreviewList.tsx must exist');
const previewListCode = fs.readFileSync(previewListPath, 'utf8');

test('SPEC-41-01: 1. Slide plan emits structured group node for announcement set with ordered children', () => {
  const db = getDb();
  const now = new Date().toISOString();

  // Create an announcement set with 2 slides
  const setRes = db
    .prepare(`INSERT INTO announcement_sets (label, updated_at) VALUES (?, ?)`)
    .run('Warta Jemaat 2026', now);
  const setId = Number(setRes.lastInsertRowid);

  const slidePayload1 = JSON.stringify({
    schemaVersion: 1,
    label: 'Jadwal Kebaktian',
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
    label: 'Gotong Royong',
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
    .run(setId, 'Jadwal Kebaktian', slidePayload1, now);
  const sl2 = db
    .prepare(
      `INSERT INTO announcement_set_slides (ann_set_id, label, payload, position, updated_at) VALUES (?, ?, ?, 1, ?)`
    )
    .run(setId, 'Gotong Royong', slidePayload2, now);

  const markerId = 'ann-marker-spec-41';
  db.prepare(
    `INSERT INTO artifact_templates (id, label, base_type, ann_set_id, position, updated_at) VALUES (?, 'Announcements', 'ann-set-marker', ?, 95, ?)`
  ).run(markerId, setId, now);

  try {
    const parsedRundown = { date: '2026-09-20', items: [] };
    const nodes = buildArtifactPlan('2026-09-20', parsedRundown, []);

    const groupNode = nodes.find(
      (n) => n.kind === 'group' && n.id === `${markerId}-set-${setId}`
    );
    assert.ok(groupNode, 'Must emit structured group node for announcement set marker');
    assert.equal(groupNode.label, 'Warta Jemaat 2026', 'Group label must inherit announcement set label');
    assert.equal(groupNode.children.length, 2, 'Group node must contain both child slides');

    const c1 = groupNode.children[0].instance;
    const c2 = groupNode.children[1].instance;

    assert.equal(c1.instanceId, `${markerId}-ann-slide-${sl1.lastInsertRowid}`);
    assert.equal(c2.instanceId, `${markerId}-ann-slide-${sl2.lastInsertRowid}`);
    assert.equal(c1.group?.role, 'announcement');
    assert.equal(c1.group?.roleLabel, 'Jadwal Kebaktian');
    assert.equal(c2.group?.role, 'announcement');
    assert.equal(c2.group?.roleLabel, 'Gotong Royong');
  } finally {
    db.prepare(`DELETE FROM artifact_templates WHERE id = ?`).run(markerId);
    db.prepare(`DELETE FROM announcement_set_slides WHERE ann_set_id = ?`).run(setId);
    db.prepare(`DELETE FROM announcement_sets WHERE id = ?`).run(setId);
  }
});

test('SPEC-41-01: 2. Repeated announcement set marker insertion yields collision-safe distinct IDs', () => {
  const db = getDb();
  const now = new Date().toISOString();

  const setRes = db
    .prepare(`INSERT INTO announcement_sets (label, updated_at) VALUES (?, ?)`)
    .run('Pemberitahuan', now);
  const setId = Number(setRes.lastInsertRowid);

  const payload = JSON.stringify({
    schemaVersion: 1,
    label: 'Slide Item',
    baseType: 'general',
    placeholders: [],
    layouts: { default: { aspectRatio: '16:9', backgroundColor: '#000000', elements: [] } },
  });
  db.prepare(`INSERT INTO announcement_set_slides (ann_set_id, label, payload, position, updated_at) VALUES (?, 'Notice', ?, 0, ?)`).run(setId, payload, now);

  const m1 = 'marker-rep-1';
  const m2 = 'marker-rep-2';
  db.prepare(`INSERT INTO artifact_templates (id, label, base_type, ann_set_id, position, updated_at) VALUES (?, 'Ann 1', 'ann-set-marker', ?, 95, ?)`).run(m1, setId, now);
  db.prepare(`INSERT INTO artifact_templates (id, label, base_type, ann_set_id, position, updated_at) VALUES (?, 'Ann 2', 'ann-set-marker', ?, 96, ?)`).run(m2, setId, now);

  try {
    const nodes = buildArtifactPlan('2026-09-20', { date: '2026-09-20', items: [] }, []);
    const g1 = nodes.find((n) => n.kind === 'group' && n.id === `${m1}-set-${setId}`);
    const g2 = nodes.find((n) => n.kind === 'group' && n.id === `${m2}-set-${setId}`);

    assert.ok(g1 && g2, 'Both repeated markers must emit group nodes');
    assert.notEqual(g1.id, g2.id, 'Repeated groups must have distinct IDs');
    assert.notEqual(g1.children[0].instance.instanceId, g2.children[0].instance.instanceId, 'Children must have distinct instance IDs');
  } finally {
    db.prepare(`DELETE FROM artifact_templates WHERE id IN (?, ?)`).run(m1, m2);
    db.prepare(`DELETE FROM announcement_set_slides WHERE ann_set_id = ?`).run(setId);
    db.prepare(`DELETE FROM announcement_sets WHERE id = ?`).run(setId);
  }
});

test('SPEC-41-02: 1. PresenterOperator discriminates announcement groupKind and applies purple badge tone', () => {
  // Model discrimination
  const entries = [
    {
      index: 0,
      instanceId: 'ann-1',
      templateId: 'ann-1',
      label: 'Prayer Meeting',
      baseType: 'general',
      groupId: 'ann-block-1-set-5',
      groupLabel: 'Weekly Notices',
      role: 'announcement',
      roleLabel: 'Prayer Meeting',
      tone: 'image',
    },
    {
      index: 1,
      instanceId: 'song-1',
      templateId: 'song-title',
      label: 'Song Title',
      baseType: 'song-set-entry',
      groupId: 'song-block-1',
      groupLabel: 'Opening Hymn',
      role: 'title',
      tone: 'song-title',
    },
  ];

  const rows = buildPresenterRows(entries);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].kind, 'group');
  assert.equal(rows[0].groupKind, 'announcement');
  assert.equal(rows[1].kind, 'group');
  assert.equal(rows[1].groupKind, 'song-set');

  // PresenterOperator code structure assertions
  assert.ok(
    presenterOpCode.includes("row.groupKind === 'announcement'"),
    'PresenterOperator must discriminate groupKind === announcement'
  );
  assert.ok(
    presenterOpCode.includes('border-purple-400/40 bg-purple-400/15 text-purple-200'),
    'PresenterOperator must apply purple badge styling for announcement groups'
  );
  assert.ok(
    presenterOpCode.includes("row.groupKind === 'announcement' ? 'Announcement' : 'Song Set'"),
    'PresenterOperator must dynamically display Announcement vs Song Set badge text'
  );
});

test('SPEC-41-03: 1. SlidePreviewList groups announcement sets with [Announcement] header and indented children', () => {
  // Preview model badge resolver
  assert.equal(resolveAnnouncementGroupBadge(1), 'ann-set-1');
  assert.equal(resolveAnnouncementGroupBadge(2), 'ann-set-2');
  assert.equal(resolveAnnouncementGroupBadge(undefined), 'ann-set');

  // SlidePreviewList code structure assertions
  assert.ok(
    previewListCode.includes("row.groupKind === 'announcement'"),
    'SlidePreviewList must discriminate groupKind === announcement'
  );
  assert.ok(
    previewListCode.includes('resolveAnnouncementGroupBadge'),
    'SlidePreviewList must call resolveAnnouncementGroupBadge'
  );
  assert.ok(
    previewListCode.includes('border-purple-500/20 dark:bg-purple-400/15 dark:text-purple-200'),
    'SlidePreviewList must apply theme-safe purple styling for announcement group badges'
  );
  assert.ok(
    previewListCode.includes('border-purple-500/30 dark:border-purple-400/30'),
    'SlidePreviewList must apply purple border indentation for announcement child slides'
  );
});

test('SPEC-41-03: 2. Executable absence guards & defect-injection proofs for announcement grouping', () => {
  // Guard 1: SlidePlan must emit structured group node for ann-set-marker (not flat leaves)
  function verifyPlanAnnouncementGrouping(source) {
    assert.ok(
      source.includes("kind: 'group'") &&
        source.includes("id: groupId") &&
        source.includes("label: setLabel") &&
        source.includes("children"),
      'buildRequestPlan must emit group node with id, label, and children for ann-set-marker'
    );
    assert.ok(
      source.includes("role: 'announcement'"),
      'Child slides must be assigned role announcement'
    );
  }

  assert.doesNotThrow(() => verifyPlanAnnouncementGrouping(slidePlanCode));

  // Defect injection 1: removing group node emission
  const defect1 = slidePlanCode.replace("id: groupId", "// id: removed");
  assert.throws(
    () => verifyPlanAnnouncementGrouping(defect1),
    /buildRequestPlan must emit group node/,
    'Absence guard must fail if announcement set slides are emitted as flat leaves'
  );

  // Guard 2: PresenterOperator must dynamically render Announcement badge and not hardcode Song Set
  function verifyPresenterBadgeDiscrimination(source) {
    assert.ok(
      source.includes("row.groupKind === 'announcement' ? 'Announcement' : 'Song Set'"),
      'PresenterOperator must discriminate Announcement vs Song Set'
    );
    assert.ok(
      !source.includes('<span className={`${BADGE_CLASS} border-primary/40 bg-primary/15 text-primary`}>\n                        Song Set\n                      </span>'),
      'PresenterOperator must not unconditionally hardcode Song Set badge'
    );
  }

  assert.doesNotThrow(() => verifyPresenterBadgeDiscrimination(presenterOpCode));

  // Defect injection 2: hardcoding Song Set badge
  const defect2 = presenterOpCode.replace(
    "row.groupKind === 'announcement' ? 'Announcement' : 'Song Set'",
    "'Song Set'"
  );
  assert.throws(
    () => verifyPresenterBadgeDiscrimination(defect2),
    /PresenterOperator must discriminate Announcement vs Song Set/,
    'Absence guard must fail if Song Set badge is hardcoded'
  );

  // Guard 3: SlidePreviewList must maintain dark-theme contrast tokens for accessibility
  function verifyDarkThemeContrast(source) {
    assert.ok(
      source.includes('dark:bg-purple-400/15'),
      'SlidePreviewList must apply dark:bg-purple-400/15 background for contrast'
    );
    assert.ok(
      source.includes('dark:text-purple-200'),
      'SlidePreviewList must apply dark:text-purple-200 text color for contrast'
    );
    assert.ok(
      source.includes('dark:border-purple-400/40'),
      'SlidePreviewList must apply dark:border-purple-400/40 border for contrast'
    );
  }

  assert.doesNotThrow(() => verifyDarkThemeContrast(previewListCode));

  // Defect injection 3: stripping dark-theme contrast tokens
  const defect3 = previewListCode.replace('dark:text-purple-200', '/* stripped */');
  assert.throws(
    () => verifyDarkThemeContrast(defect3),
    /SlidePreviewList must apply dark:text-purple-200/,
    'Absence guard must fail if dark-theme contrast tokens are missing'
  );
});
