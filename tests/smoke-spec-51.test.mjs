/**
 * SPEC-51: Unified Schedule Workspace 1920 Full HD Responsive Redesign & Ergonomics Architecture
 * Smoke Test & Executable Absence Guard Suite
 *
 * Verifies:
 * - SPEC-51-01: 1920 Full HD Responsive Viewport & 3-Panel Layout Grid Overhaul
 *   - Root wrapper 1920px Full HD responsive baseline (max-w-[2560px], 2xl:px-8)
 *   - 3-panel container viewport height calculations (h-[calc(100vh-175px)], min-h-[560px], 2xl:min-h-[700px])
 *   - Proportional panel allocations: Timeline (xl:w-[320px] / 2xl:w-[400px]), Editor (xl:min-w-[400px] / 2xl:min-w-[600px]), Preview (xl:w-[420px] / 2xl:w-[580px])
 *   - Song editor dual-column ergonomics (2xl:grid-cols-2) and timeline card metadata badges
 * - SPEC-51-02: Master Libraries In-Drawer Direct CRUD & Layout Refactoring
 *   - In-drawer "+ Tambah Song Set Baru" button, form, edit, and delete with Preset Dependency Guard
 *   - In-drawer "+ Tambah Warta Baru" button, form, edit, and delete
 *   - Predefined tokens system immutability protection and custom token delete/edit actions
 *   - Drawer width expanded to max-w-3xl / 2xl:max-w-4xl
 * - SPEC-51-03: Consolidated AV Command Header, Quick Tools & High-Density Toolbar
 *   - Zone A (Identity), Zone B (Monitoring & Revision), Zone C (Presentation & Priority Actions)
 *   - Secondary utilities ribbon for drawers and master management
 *   - Right panel quick projection tools (Blackout, Clear Text, Aspect Ratio Guides, Stage Confidence)
 *   - Keyboard shortcut safety guard (isEditableElement input focus and modifier key suppression)
 * - SPEC-51-04: Physical real-file executable absence guards with defect injection proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  isSystemPredefinedToken,
  canDeleteMasterSongSet,
} = await import(
  pathToFileURL(path.join(root, 'src', 'operator', 'workspace', 'types.ts')).href
);

const {
  isEditableElement,
} = await import(
  pathToFileURL(path.join(root, 'src', 'operator', 'workspace', 'utils.ts')).href
);

export function scan1920LayoutFeatures(pageSource, editorSource, timelineSource, previewSource) {
  const findings = [];
  if (!pageSource.includes('max-w-[2560px]')) {
    findings.push('Missing max-w-[2560px] in workspace root wrapper');
  }
  if (!pageSource.includes('2xl:px-8')) {
    findings.push('Missing 2xl:px-8 responsive padding in workspace root wrapper');
  }
  if (!pageSource.includes('h-[calc(100vh-175px)]')) {
    findings.push('Missing h-[calc(100vh-175px)] in 3-panel container');
  }
  if (!pageSource.includes('2xl:min-h-[700px]')) {
    findings.push('Missing 2xl:min-h-[700px] in 3-panel container');
  }
  if (!pageSource.includes('2xl:w-[400px]')) {
    findings.push('Missing 2xl:w-[400px] in left timeline panel');
  }
  if (!pageSource.includes('2xl:min-w-[600px]')) {
    findings.push('Missing 2xl:min-w-[600px] in center editor panel');
  }
  if (!pageSource.includes('2xl:w-[580px]')) {
    findings.push('Missing 2xl:w-[580px] in right preview panel');
  }
  if (!editorSource.includes('2xl:grid-cols-2')) {
    findings.push('Missing 2xl:grid-cols-2 dual-column song editor layout');
  }
  if (!timelineSource.includes('data-testid={`timeline-hymn-tag-${item.id}`}')) {
    findings.push('Missing timeline-hymn-tag testid in timeline cards');
  }
  if (!previewSource.includes('aspect-ratio-guide-toggle')) {
    findings.push('Missing aspect-ratio-guide-toggle in preview panel');
  }
  return findings;
}

export function scanMasterLibrariesCrudFeatures(drawerSource) {
  const findings = [];
  if (!drawerSource.includes('max-w-3xl') || !drawerSource.includes('2xl:max-w-4xl')) {
    findings.push('Missing max-w-3xl / 2xl:max-w-4xl drawer width expansion');
  }
  if (!drawerSource.includes('data-testid="add-master-song-set-button"')) {
    findings.push('Missing add-master-song-set-button in master song sets tab');
  }
  if (!drawerSource.includes('data-testid={`edit-master-song-set-${ss.id}`}')) {
    findings.push('Missing edit-master-song-set testid in song set card');
  }
  if (!drawerSource.includes('data-testid={`delete-master-song-set-${ss.id}`}')) {
    findings.push('Missing delete-master-song-set testid in song set card');
  }
  if (!drawerSource.includes('canDeleteMasterSongSet')) {
    findings.push('Missing canDeleteMasterSongSet guard check in song set deletion');
  }
  if (!drawerSource.includes('data-testid="add-master-announcement-button"')) {
    findings.push('Missing add-master-announcement-button in master announcements tab');
  }
  if (!drawerSource.includes('data-testid={`edit-master-announcement-${as.id}`}')) {
    findings.push('Missing edit-master-announcement testid in announcement card');
  }
  if (!drawerSource.includes('data-testid={`delete-master-announcement-${as.id}`}')) {
    findings.push('Missing delete-master-announcement testid in announcement card');
  }
  if (!drawerSource.includes('data-testid={`system-token-badge-${tok.key}`}')) {
    findings.push('Missing system-token-badge testid in predefined tokens table');
  }
  if (!drawerSource.includes('data-testid={`delete-token-${tok.key}`}')) {
    findings.push('Missing delete-token testid in predefined tokens table');
  }
  if (!drawerSource.includes('data-testid={`edit-token-${tok.key}`}')) {
    findings.push('Missing edit-token testid in predefined tokens table');
  }
  return findings;
}

export function scanAvCommandHeaderFeatures(pageSource, previewSource) {
  const findings = [];
  if (!pageSource.includes('data-testid="command-zone-a"')) {
    findings.push('Missing command-zone-a in top header bar');
  }
  if (!pageSource.includes('data-testid="command-zone-b"')) {
    findings.push('Missing command-zone-b in top header bar');
  }
  if (!pageSource.includes('data-testid="command-zone-c"')) {
    findings.push('Missing command-zone-c in top header bar');
  }
  if (!pageSource.includes('data-testid="save-revision-indicator"')) {
    findings.push('Missing save-revision-indicator in command-zone-b');
  }
  if (!pageSource.includes('data-testid="schedule-history-drawer-button"')) {
    findings.push('Missing schedule-history-drawer-button in secondary ribbon');
  }
  if (!pageSource.includes('data-testid="manage-presets-button"')) {
    findings.push('Missing manage-presets-button in secondary ribbon');
  }
  if (!previewSource.includes('isEditableElement')) {
    findings.push('Missing isEditableElement check in keyboard shortcut listener');
  }
  if (!previewSource.includes('data-testid="black-screen-toggle"')) {
    findings.push('Missing black-screen-toggle in preview controls');
  }
  if (!previewSource.includes('data-testid="clear-text-toggle"')) {
    findings.push('Missing clear-text-toggle in preview controls');
  }
  return findings;
}

// -----------------------------------------------------------------------------
// Test 1: SPEC-51-01 - 1920 Full HD Viewport & 3-Panel Layout Grid Overhaul
// -----------------------------------------------------------------------------
test('SPEC-51-01: 1920 Full HD Responsive Viewport & 3-Panel Layout Grid Integration', () => {
  const pageSource = fs.readFileSync(path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx'), 'utf8');
  const editorSource = fs.readFileSync(path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx'), 'utf8');
  const timelineSource = fs.readFileSync(path.join(root, 'src', 'operator', 'workspace', 'MockupTimeline.tsx'), 'utf8');
  const previewSource = fs.readFileSync(path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx'), 'utf8');

  const findings = scan1920LayoutFeatures(pageSource, editorSource, timelineSource, previewSource);
  assert.deepEqual(findings, [], `1920 Full HD layout violations: ${findings.join(', ')}`);
});

// -----------------------------------------------------------------------------
// Test 2: SPEC-51-02 - Master Libraries In-Drawer Direct CRUD & Layout Refactoring
// -----------------------------------------------------------------------------
test('SPEC-51-02: Master Libraries In-Drawer Direct CRUD & Preset Dependency Guard', () => {
  const drawerSource = fs.readFileSync(
    path.join(root, 'src', 'operator', 'workspace', 'MockupMasterLibrariesDrawer.tsx'),
    'utf8'
  );

  const findings = scanMasterLibrariesCrudFeatures(drawerSource);
  assert.deepEqual(findings, [], `Master Libraries in-drawer CRUD violations: ${findings.join(', ')}`);

  // Behavioral rule check: canDeleteMasterSongSet derives from actual preset references
  const mockPresets = [
    {
      id: 'p-custom',
      slug: 'custom',
      title: 'Custom Sabbath',
      description: '',
      defaultTime: '09:00',
      status: 'published',
      activeServicesCount: 1,
      version: 1,
      createdAt: '',
      updatedAt: '',
      songSetIds: ['mss-referenced-in-preset'],
    },
  ];

  const deleteReferenced = canDeleteMasterSongSet('mss-referenced-in-preset', mockPresets);
  assert.equal(deleteReferenced.allowed, false, 'Song set referenced by custom preset must not be deleted');
  assert.match(deleteReferenced.reason || '', /Custom Sabbath/, 'Reason must name referencing preset');

  const deleteUnreferenced = canDeleteMasterSongSet('mss-not-used', mockPresets);
  assert.equal(deleteUnreferenced.allowed, true, 'Unreferenced song set must be deletable');

  // Behavioral rule check: isSystemPredefinedToken immutability
  assert.equal(isSystemPredefinedToken('sermon_speaker'), true, 'sermon_speaker is a system token');
  assert.equal(isSystemPredefinedToken('sermon_title'), true, 'sermon_title is a system token');
  assert.equal(isSystemPredefinedToken('scripture_reference'), true, 'scripture_reference is a system token');
  assert.equal(isSystemPredefinedToken('custom_prayer_request'), false, 'custom_prayer_request is not a system token');
});

// -----------------------------------------------------------------------------
// Test 3: SPEC-51-03 - Consolidated AV Command Header, Quick Tools & Keyboard Safety
// -----------------------------------------------------------------------------
test('SPEC-51-03: Consolidated AV Command Header & Keyboard Focus Safety Guard', () => {
  const pageSource = fs.readFileSync(path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx'), 'utf8');
  const previewSource = fs.readFileSync(path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx'), 'utf8');

  const findings = scanAvCommandHeaderFeatures(pageSource, previewSource);
  assert.deepEqual(findings, [], `AV command header violations: ${findings.join(', ')}`);

  // Behavioral rule check: isEditableElement keyboard shortcut safety
  assert.equal(
    isEditableElement({ tagName: 'INPUT' }),
    true,
    'INPUT element must be recognized as editable and suppress single-key shortcuts'
  );
  assert.equal(
    isEditableElement({ tagName: 'TEXTAREA' }),
    true,
    'TEXTAREA element must be recognized as editable and suppress single-key shortcuts'
  );
  assert.equal(
    isEditableElement({ tagName: 'SELECT' }),
    true,
    'SELECT element must be recognized as editable and suppress single-key shortcuts'
  );
  assert.equal(
    isEditableElement({ isContentEditable: true }),
    true,
    'contenteditable element must be recognized as editable and suppress single-key shortcuts'
  );
  assert.equal(
    isEditableElement({ tagName: 'DIV', closest: (sel) => sel.includes('input') ? {} : null }),
    true,
    'Nested element inside input must be recognized as editable'
  );
  assert.equal(
    isEditableElement({ tagName: 'DIV', closest: () => null }),
    false,
    'Regular DIV element must allow single-key shortcuts (Blackout/Clear)'
  );
  assert.equal(
    isEditableElement(null),
    false,
    'Null element must allow single-key shortcuts'
  );
});

// -----------------------------------------------------------------------------
// Test 4: SPEC-51-04 - Physical Real-File Executable Absence Guards & Defect Injection
// -----------------------------------------------------------------------------
test('SPEC-51-04: Real-File Executable Absence Guard & Defect Injection Proofs', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const drawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMasterLibrariesDrawer.tsx');
  const previewPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx');
  const timelinePath = path.join(root, 'src', 'operator', 'workspace', 'MockupTimeline.tsx');

  const originalPage = fs.readFileSync(pagePath);
  const originalEditor = fs.readFileSync(editorPath);
  const originalDrawer = fs.readFileSync(drawerPath);
  const originalPreview = fs.readFileSync(previewPath);
  const originalTimeline = fs.readFileSync(timelinePath);

  // Physical Defect 1: Strip max-w-[2560px] from real WorkspaceMockupPage.tsx file on disk
  try {
    const defectContent = originalPage.toString('utf8').replace('max-w-[2560px]', '');
    fs.writeFileSync(pagePath, defectContent, 'utf8');

    const defectFindings = scan1920LayoutFeatures(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(editorPath, 'utf8'),
      fs.readFileSync(timelinePath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8')
    );
    assert.ok(
      defectFindings.includes('Missing max-w-[2560px] in workspace root wrapper'),
      'Physical absence guard must detect removal of max-w-[2560px] on disk'
    );
  } finally {
    fs.writeFileSync(pagePath, originalPage);
  }

  // Physical Defect 2: Strip dual-column song editor layout from real MockupEditor.tsx on disk
  try {
    const defectContent = originalEditor.toString('utf8').replace('2xl:grid-cols-2', 'grid-cols-1');
    fs.writeFileSync(editorPath, defectContent, 'utf8');

    const defectFindings = scan1920LayoutFeatures(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(editorPath, 'utf8'),
      fs.readFileSync(timelinePath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8')
    );
    assert.ok(
      defectFindings.includes('Missing 2xl:grid-cols-2 dual-column song editor layout'),
      'Physical absence guard must detect loss of dual-column song editor layout on disk'
    );
  } finally {
    fs.writeFileSync(editorPath, originalEditor);
  }

  // Physical Defect 3: Strip add-master-song-set-button from real MockupMasterLibrariesDrawer.tsx on disk
  try {
    const defectContent = originalDrawer.toString('utf8').replace('data-testid="add-master-song-set-button"', '');
    fs.writeFileSync(drawerPath, defectContent, 'utf8');

    const defectFindings = scanMasterLibrariesCrudFeatures(fs.readFileSync(drawerPath, 'utf8'));
    assert.ok(
      defectFindings.includes('Missing add-master-song-set-button in master song sets tab'),
      'Physical absence guard must detect removal of add-master-song-set-button on disk'
    );
  } finally {
    fs.writeFileSync(drawerPath, originalDrawer);
  }

  // Physical Defect 4: Strip canDeleteMasterSongSet guard check from real MockupMasterLibrariesDrawer.tsx on disk
  try {
    const defectContent = originalDrawer.toString('utf8').replaceAll('canDeleteMasterSongSet', 'allowAnyDelete');
    fs.writeFileSync(drawerPath, defectContent, 'utf8');

    const defectFindings = scanMasterLibrariesCrudFeatures(fs.readFileSync(drawerPath, 'utf8'));
    assert.ok(
      defectFindings.includes('Missing canDeleteMasterSongSet guard check in song set deletion'),
      'Physical absence guard must detect removal of canDeleteMasterSongSet on disk'
    );
  } finally {
    fs.writeFileSync(drawerPath, originalDrawer);
  }

  // Physical Defect 5: Strip isEditableElement safety check from real MockupCanvasPreview.tsx on disk
  try {
    const defectContent = originalPreview.toString('utf8').replaceAll('isEditableElement', 'ignoreFocusCheck');
    fs.writeFileSync(previewPath, defectContent, 'utf8');

    const defectFindings = scanAvCommandHeaderFeatures(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8')
    );
    assert.ok(
      defectFindings.includes('Missing isEditableElement check in keyboard shortcut listener'),
      'Physical absence guard must detect removal of isEditableElement on disk'
    );
  } finally {
    fs.writeFileSync(previewPath, originalPreview);
  }

  // Verify all files cleanly restored
  assert.deepEqual(
    scan1920LayoutFeatures(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(editorPath, 'utf8'),
      fs.readFileSync(timelinePath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8')
    ),
    [],
    'Restored layout files must pass all layout guards'
  );
  assert.deepEqual(
    scanMasterLibrariesCrudFeatures(fs.readFileSync(drawerPath, 'utf8')),
    [],
    'Restored drawer file must pass all CRUD guards'
  );
  assert.deepEqual(
    scanAvCommandHeaderFeatures(
      fs.readFileSync(pagePath, 'utf8'),
      fs.readFileSync(previewPath, 'utf8')
    ),
    [],
    'Restored header and preview files must pass all AV command guards'
  );
});
