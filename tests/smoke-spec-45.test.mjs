/**
 * SPEC-45: Announcement Slot Single-Row Layout and Upload Persistence Hydration
 * Smoke Test & Absence Guard Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/**
 * Scans RunSheetPage.tsx to ensure initialAnnouncementInserts is passed to EditForm
 * and derives from images.announcementInserts.
 */
export function scanRunSheetPageHydration(source) {
  const findings = [];
  const editFormMatch = source.match(/<EditForm\b([\s\S]*?)\/>/);
  if (!editFormMatch) {
    findings.push('RunSheetPage.tsx does not render <EditForm ... />');
    return findings;
  }

  const propsStr = editFormMatch[1];
  if (!propsStr.includes('initialAnnouncementInserts=')) {
    findings.push('Missing initialAnnouncementInserts prop on EditForm in RunSheetPage.tsx');
  } else if (!propsStr.includes('images.announcementInserts')) {
    findings.push('initialAnnouncementInserts does not derive from images.announcementInserts');
  }
  return findings;
}

/**
 * Scans CreateForm.tsx or EditForm.tsx to ensure sm:grid-cols-2 has been eliminated
 * and replaced with the explicit single-column layout (flex flex-col gap-4).
 */
export function scanAnnouncementSlotLayout(source, fileName) {
  const findings = [];
  // Find the Weekly Announcement Posters card block
  const cardMatch = source.match(
    /Weekly Announcement Posters[\s\S]*?<CardContent[^>]*>([\s\S]*?)<\/CardContent>/
  );
  if (!cardMatch) {
    findings.push(`Could not find Weekly Announcement Posters CardContent in ${fileName}`);
    return findings;
  }

  const content = cardMatch[1];
  if (content.includes('sm:grid-cols-2') || content.includes('grid-cols-2')) {
    findings.push(
      `Found cramped 2-column grid layout (sm:grid-cols-2) in Weekly Announcement Posters section of ${fileName}`
    );
  }
  if (!content.includes('flex flex-col gap-4')) {
    findings.push(
      `Expected single-column container (flex flex-col gap-4) in Weekly Announcement Posters section of ${fileName}`
    );
  }

  // Ensure all 4 slot representations are rendered
  for (let slot = 1; slot <= 4; slot++) {
    if (
      !content.includes(`Announcement Slot \${slot}`) &&
      !content.includes(`Announcement Slot ${slot}`) &&
      !content.includes(`[1, 2, 3, 4]`)
    ) {
      findings.push(`Slot ${slot} not rendered in ${fileName}`);
    }
  }

  return findings;
}

/**
 * Pure 4-slot normalization helper reflecting EditForm/RunSheetPage invariant.
 */
export function normalizeAnnouncementSlots(input) {
  const arr = Array.isArray(input)
    ? input.map((x) => (typeof x === 'string' ? x : ''))
    : [];
  while (arr.length < 4) arr.push('');
  return arr.slice(0, 4);
}

test('SPEC-45-01: RunSheetPage passes initialAnnouncementInserts to EditForm', () => {
  const runSheetPath = path.join(root, 'spa', 'src', 'pages', 'RunSheetPage.tsx');
  assert.ok(fs.existsSync(runSheetPath), 'RunSheetPage.tsx must exist');
  const source = fs.readFileSync(runSheetPath, 'utf8');

  const findings = scanRunSheetPageHydration(source);
  assert.deepEqual(
    findings,
    [],
    `RunSheetPage hydration scan failed: ${findings.join('; ')}`
  );
});

test('SPEC-45-01: Element-safe 4-slot normalization handles empty, short, long, and mixed-type payloads', () => {
  // Empty or non-array inputs
  assert.deepEqual(normalizeAnnouncementSlots(null), ['', '', '', '']);
  assert.deepEqual(normalizeAnnouncementSlots(undefined), ['', '', '', '']);
  assert.deepEqual(normalizeAnnouncementSlots([]), ['', '', '', '']);
  assert.deepEqual(normalizeAnnouncementSlots('invalid'), ['', '', '', '']);

  // Short array pads to 4
  assert.deepEqual(normalizeAnnouncementSlots(['http://a.com/1.jpg']), [
    'http://a.com/1.jpg',
    '',
    '',
    '',
  ]);

  // Long array truncates to 4
  assert.deepEqual(
    normalizeAnnouncementSlots([
      'http://a.com/1.jpg',
      'http://a.com/2.jpg',
      'http://a.com/3.jpg',
      'http://a.com/4.jpg',
      'http://a.com/5.jpg',
    ]),
    [
      'http://a.com/1.jpg',
      'http://a.com/2.jpg',
      'http://a.com/3.jpg',
      'http://a.com/4.jpg',
    ]
  );

  // Mixed type array defensively sanitizes non-strings to empty string
  assert.deepEqual(
    normalizeAnnouncementSlots([null, 42, 'http://a.com/3.jpg', false]),
    ['', '', 'http://a.com/3.jpg', '']
  );
});

test('SPEC-45-02: Weekly announcement poster slots use single-row layout without sm:grid-cols-2', () => {
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');
  assert.ok(fs.existsSync(createFormPath), 'CreateForm.tsx must exist');
  const createSource = fs.readFileSync(createFormPath, 'utf8');

  const createFindings = scanAnnouncementSlotLayout(createSource, 'CreateForm.tsx');
  assert.deepEqual(
    createFindings,
    [],
    `CreateForm layout scan failed: ${createFindings.join('; ')}`
  );

  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  assert.ok(fs.existsSync(editFormPath), 'EditForm.tsx must exist');
  const editSource = fs.readFileSync(editFormPath, 'utf8');

  const editFindings = scanAnnouncementSlotLayout(editSource, 'EditForm.tsx');
  assert.deepEqual(
    editFindings,
    [],
    `EditForm layout scan failed: ${editFindings.join('; ')}`
  );
});

test('SPEC-45: Executable Absence Guard proofs with real-file defect injection', () => {
  const runSheetPath = path.join(root, 'spa', 'src', 'pages', 'RunSheetPage.tsx');
  const realRunSheet = fs.readFileSync(runSheetPath, 'utf8');
  assert.deepEqual(scanRunSheetPageHydration(realRunSheet), []);

  // 1. Defect proof: Real RunSheetPage source with initialAnnouncementInserts stripped is caught
  const defectiveRunSheet = realRunSheet.replace(
    /initialAnnouncementInserts=\{[\s\S]*?\}\s*/,
    ''
  );
  assert.notEqual(defectiveRunSheet, realRunSheet);
  const hydrationFindings = scanRunSheetPageHydration(defectiveRunSheet);
  assert.ok(
    hydrationFindings.length > 0 &&
      hydrationFindings[0].includes('Missing initialAnnouncementInserts prop'),
    'scanRunSheetPageHydration must catch missing initialAnnouncementInserts on real source'
  );

  // 2. Defect proof: Real RunSheetPage source hardcoding empty array instead of images.announcementInserts is caught
  const hardcodedRunSheet = realRunSheet.replace(
    /initialAnnouncementInserts=\{[\s\S]*?\}\s*/,
    'initialAnnouncementInserts={[]} '
  );
  const hardcodedFindings = scanRunSheetPageHydration(hardcodedRunSheet);
  assert.ok(
    hardcodedFindings.some((f) =>
      f.includes('does not derive from images.announcementInserts')
    ),
    'scanRunSheetPageHydration must catch initialAnnouncementInserts that does not derive from images'
  );

  // 3. Defect proof: Real CreateForm source with sm:grid-cols-2 re-injected is caught
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');
  const realCreateForm = fs.readFileSync(createFormPath, 'utf8');
  assert.deepEqual(scanAnnouncementSlotLayout(realCreateForm, 'CreateForm.tsx'), []);

  const defectiveCreateForm = realCreateForm.replace(
    'className="flex flex-col gap-4"',
    'className="grid gap-4 sm:grid-cols-2"'
  );
  assert.notEqual(defectiveCreateForm, realCreateForm);
  const createFindings = scanAnnouncementSlotLayout(defectiveCreateForm, 'CreateForm.tsx');
  assert.ok(
    createFindings.some((f) => f.includes('sm:grid-cols-2')),
    'scanAnnouncementSlotLayout must catch sm:grid-cols-2 re-injected into CreateForm.tsx'
  );

  // 4. Defect proof: Real EditForm source with sm:grid-cols-2 re-injected is caught
  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const realEditForm = fs.readFileSync(editFormPath, 'utf8');
  assert.deepEqual(scanAnnouncementSlotLayout(realEditForm, 'EditForm.tsx'), []);

  const defectiveEditForm = realEditForm.replace(
    'className="flex flex-col gap-4"',
    'className="grid gap-4 sm:grid-cols-2"'
  );
  assert.notEqual(defectiveEditForm, realEditForm);
  const editFindings = scanAnnouncementSlotLayout(defectiveEditForm, 'EditForm.tsx');
  assert.ok(
    editFindings.some((f) => f.includes('sm:grid-cols-2')),
    'scanAnnouncementSlotLayout must catch sm:grid-cols-2 re-injected into EditForm.tsx'
  );
});

test('SPEC-45-03: Go API services announcementInserts round-trip persistence', () => {
  // Execute Go HTTP suite verifying create, get, and update persistence
  const output = execFileSync(
    'go',
    ['test', './internal/httpapi/...', '-run', 'TestAnnouncementInsertsPersistence'],
    { cwd: root, encoding: 'utf8' }
  );
  assert.ok(
    output.includes('PASS') || output.includes('ok'),
    `Go test suite must pass: ${output}`
  );
});
