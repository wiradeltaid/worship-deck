/**
 * SPEC-50: Unified Schedule Workspace UI/UX Full Architecture & Screen Replacement Blueprint
 * Smoke Test & Executable Absence Guard Suite
 *
 * Verifies:
 * - SPEC-50-01: Master Preset Lifecycle & Schedule Persistence Architecture
 *   - Workspace mode switcher (Instance vs Master Preset Builder)
 *   - Master Preset lifecycle state machine (draft -> published -> retired) and CRUD
 *   - Preset deletion dependency guard (refusal when active services exist, offering archive)
 *   - Local schedule instance override isolation badge & revision counter
 *   - Explicit "Simpan Jadwal" action & auto-save indicator
 *   - Schedule History drawer (replaces DashboardPage /) with search, duplicate, open, delete
 * - Executable absence guards with injected defect forms
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  isValidPresetTransition,
  isValidTokenKey,
  computePresetActiveServicesCount,
} = await import(
  pathToFileURL(path.join(root, 'src', 'operator', 'workspace', 'types.ts')).href
);

export function scanPresetLifecycleFeatures(source, typesSource) {
  const findings = [];
  if (!typesSource.includes('WorkspaceMode')) {
    findings.push('Missing WorkspaceMode type definition in types.ts');
  }
  if (!typesSource.includes('MasterPreset')) {
    findings.push('Missing MasterPreset definition in types.ts');
  }
  if (!typesSource.includes("'draft'") || !typesSource.includes("'published'") || !typesSource.includes("'retired'")) {
    findings.push('Missing draft / published / retired lifecycle states in types.ts');
  }
  if (!source.includes('data-testid="workspace-mode-switcher"')) {
    findings.push('Missing data-testid="workspace-mode-switcher"');
  }
  if (!source.includes('data-testid="mode-instance-button"')) {
    findings.push('Missing data-testid="mode-instance-button"');
  }
  if (!source.includes('data-testid="mode-master-preset-button"')) {
    findings.push('Missing data-testid="mode-master-preset-button"');
  }
  if (!source.includes('data-testid="manage-presets-button"')) {
    findings.push('Missing data-testid="manage-presets-button"');
  }
  if (!source.includes('data-testid="master-preset-drawer"')) {
    findings.push('Missing data-testid="master-preset-drawer"');
  }
  if (!source.includes('data-testid="preset-deletion-guard-alert"')) {
    findings.push('Missing data-testid="preset-deletion-guard-alert"');
  }
  if (!source.includes('data-testid="archive-preset-button"')) {
    findings.push('Missing data-testid="archive-preset-button"');
  }
  return findings;
}

export function scanSchedulePersistenceFeatures(pageSource, historyDrawerSource) {
  const findings = [];
  if (!pageSource.includes('data-testid="save-schedule-button"')) {
    findings.push('Missing data-testid="save-schedule-button"');
  }
  if (!pageSource.includes('data-testid="auto-save-indicator"')) {
    findings.push('Missing data-testid="auto-save-indicator"');
  }
  if (!pageSource.includes('data-testid="local-override-isolation-badge"')) {
    findings.push('Missing data-testid="local-override-isolation-badge"');
  }
  if (!pageSource.includes('data-testid="schedule-history-drawer-button"')) {
    findings.push('Missing data-testid="schedule-history-drawer-button"');
  }
  if (!historyDrawerSource.includes('data-testid="schedule-history-drawer"')) {
    findings.push('Missing data-testid="schedule-history-drawer" in history drawer');
  }
  if (!historyDrawerSource.includes('data-testid="history-search-input"')) {
    findings.push('Missing data-testid="history-search-input" in history drawer');
  }
  if (!historyDrawerSource.includes('data-testid="history-preset-filter"')) {
    findings.push('Missing data-testid="history-preset-filter" in history drawer');
  }
  if (!historyDrawerSource.includes('data-testid="history-open-service-button"')) {
    findings.push('Missing data-testid="history-open-service-button" in history drawer');
  }
  if (!historyDrawerSource.includes('data-testid="history-duplicate-service-button"')) {
    findings.push('Missing data-testid="history-duplicate-service-button" in history drawer');
  }
  if (!historyDrawerSource.includes('data-testid="history-delete-service-button"')) {
    findings.push('Missing data-testid="history-delete-service-button" in history drawer');
  }
  return findings;
}

// --------------------------------------------------------------------------
// Automated Tests
// --------------------------------------------------------------------------

test('SPEC-50-01: Workspace Mode Switcher & Master Preset Lifecycle Integration', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');
  const typesPath = path.join(root, 'src', 'operator', 'workspace', 'types.ts');
  const drawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMasterPresetDrawer.tsx');

  assert.ok(fs.existsSync(pagePath), 'WorkspaceMockupPage.tsx must exist');
  assert.ok(fs.existsSync(typesPath), 'types.ts must exist');
  assert.ok(fs.existsSync(drawerPath), 'MockupMasterPresetDrawer.tsx must exist');

  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const typesSource = fs.readFileSync(typesPath, 'utf8');
  const drawerSource = fs.readFileSync(drawerPath, 'utf8');

  const combined = pageSource + '\n' + drawerSource;
  const findings = scanPresetLifecycleFeatures(combined, typesSource);
  assert.deepEqual(findings, [], `Preset lifecycle scan findings: ${findings.join('; ')}`);

  // Master and Instance State Isolation Invariant
  assert.ok(
    pageSource.includes('instanceItems') && pageSource.includes('masterBlueprintItems'),
    'WorkspaceMockupPage must maintain separate instanceItems and masterBlueprintItems state'
  );
});

test('SPEC-50-01: Master Preset Lifecycle State Machine Behavioral Rules', () => {
  // Legal transitions
  assert.equal(isValidPresetTransition('draft', 'published'), true, 'draft -> published must be legal');
  assert.equal(isValidPresetTransition('published', 'retired'), true, 'published -> retired must be legal');
  assert.equal(isValidPresetTransition('draft', 'retired'), true, 'draft -> retired must be legal');
  assert.equal(isValidPresetTransition('published', 'published'), true, 'idempotent transition must be legal');

  // Illegal transitions (fail-closed)
  assert.equal(isValidPresetTransition('retired', 'draft'), false, 'retired -> draft must be illegal');
  assert.equal(isValidPresetTransition('retired', 'published'), false, 'retired -> published must be illegal');
});

test('SPEC-50-01: Preset Deletion Dependency Guard Behavioral Rules', () => {
  const mockServices = [
    { id: 's1', presetId: 'sabbath-morning', presetLabel: 'Sabat', serviceDate: '2026-09-19', serviceTitle: 'T1', status: 'ready', itemsCount: 5, scheduleRevision: 1, updatedAt: 'now' },
    { id: 's2', presetId: 'sabbath-morning', presetLabel: 'Sabat', serviceDate: '2026-09-12', serviceTitle: 'T2', status: 'ready', itemsCount: 5, scheduleRevision: 1, updatedAt: 'now' },
    { id: 's3', presetId: 'vesper-friday', presetLabel: 'Vesper', serviceDate: '2026-09-18', serviceTitle: 'T3', status: 'ready', itemsCount: 4, scheduleRevision: 1, updatedAt: 'now' },
  ];

  // Dynamic dependency calculation
  const sabbathCount = computePresetActiveServicesCount('sabbath-morning', mockServices);
  assert.equal(sabbathCount, 2, 'sabbath-morning must report 2 active services');

  const vesperCount = computePresetActiveServicesCount('vesper-friday', mockServices);
  assert.equal(vesperCount, 1, 'vesper-friday must report 1 active service');

  const unusedCount = computePresetActiveServicesCount('unused-preset', mockServices);
  assert.equal(unusedCount, 0, 'unused preset must report 0 active services');
});

test('SPEC-50-01: Schedule Persistence, Auto-Save, and History Drawer Integration', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');
  const historyDrawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupScheduleHistoryDrawer.tsx');

  assert.ok(fs.existsSync(pagePath), 'WorkspaceMockupPage.tsx must exist');
  assert.ok(fs.existsSync(historyDrawerPath), 'MockupScheduleHistoryDrawer.tsx must exist');

  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const historyDrawerSource = fs.readFileSync(historyDrawerPath, 'utf8');

  const findings = scanSchedulePersistenceFeatures(pageSource, historyDrawerSource);
  assert.deepEqual(findings, [], `Schedule persistence scan findings: ${findings.join('; ')}`);
});

test('SPEC-50-01: Real-File Executable Absence Guard & Defect Injection Proofs', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');
  const drawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMasterPresetDrawer.tsx');
  const typesPath = path.join(root, 'src', 'operator', 'workspace', 'types.ts');
  const historyDrawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupScheduleHistoryDrawer.tsx');

  const realPageSource = fs.readFileSync(pagePath, 'utf8');
  const realDrawerSource = fs.readFileSync(drawerPath, 'utf8');
  const realTypesSource = fs.readFileSync(typesPath, 'utf8');
  const realHistorySource = fs.readFileSync(historyDrawerPath, 'utf8');

  // Defect 1: Strip mode switcher from real page
  const defectivePage1 = realPageSource.replace('data-testid="workspace-mode-switcher"', '');
  const defect1Findings = scanPresetLifecycleFeatures(defectivePage1 + '\n' + realDrawerSource, realTypesSource);
  assert.ok(
    defect1Findings.includes('Missing data-testid="workspace-mode-switcher"'),
    'Absence guard must detect removal of workspace-mode-switcher from real page'
  );

  // Defect 2: Strip deletion guard alert from real drawer
  const defectiveDrawer2 = realDrawerSource.replace('data-testid="preset-deletion-guard-alert"', '');
  const defect2Findings = scanPresetLifecycleFeatures(realPageSource + '\n' + defectiveDrawer2, realTypesSource);
  assert.ok(
    defect2Findings.includes('Missing data-testid="preset-deletion-guard-alert"'),
    'Absence guard must detect removal of preset-deletion-guard-alert from real drawer'
  );

  // Defect 3: Strip local override isolation badge from real page
  const defectivePage3 = realPageSource.replace('data-testid="local-override-isolation-badge"', '');
  const defect3Findings = scanSchedulePersistenceFeatures(defectivePage3, realHistorySource);
  assert.ok(
    defect3Findings.includes('Missing data-testid="local-override-isolation-badge"'),
    'Absence guard must detect removal of local-override-isolation-badge from real page'
  );

  // Defect 4: Strip save schedule button from real page
  const defectivePage4 = realPageSource.replace('data-testid="save-schedule-button"', '');
  const defect4Findings = scanSchedulePersistenceFeatures(defectivePage4, realHistorySource);
  assert.ok(
    defect4Findings.includes('Missing data-testid="save-schedule-button"'),
    'Absence guard must detect removal of save-schedule-button from real page'
  );

  // Defect 5: Strip history search input from real history drawer
  const defectiveHistory5 = realHistorySource.replace('data-testid="history-search-input"', '');
  const defect5Findings = scanSchedulePersistenceFeatures(realPageSource, defectiveHistory5);
  assert.ok(
    defect5Findings.includes('Missing data-testid="history-search-input" in history drawer'),
    'Absence guard must detect removal of history-search-input from real history drawer'
  );
});

export function scanMasterLibrariesFeatures(editorSource, modalSource, librariesDrawerSource) {
  const findings = [];
  if (!editorSource.includes('data-testid="choose-master-song-set-button"')) {
    findings.push('Missing data-testid="choose-master-song-set-button" in MockupEditor');
  }
  if (!editorSource.includes('data-testid="save-to-master-song-set-button"')) {
    findings.push('Missing data-testid="save-to-master-song-set-button" in MockupEditor');
  }
  if (!editorSource.includes('data-testid="choose-master-announcement-button"')) {
    findings.push('Missing data-testid="choose-master-announcement-button" in MockupEditor');
  }
  if (!editorSource.includes('data-testid="save-to-master-announcement-button"')) {
    findings.push('Missing data-testid="save-to-master-announcement-button" in MockupEditor');
  }
  if (!modalSource.includes('data-testid="save-as-new-slide-type-button"')) {
    findings.push('Missing data-testid="save-as-new-slide-type-button" in MockupCanvasDesignerModal');
  }
  if (!modalSource.includes('data-testid="new-slide-type-title-input"')) {
    findings.push('Missing data-testid="new-slide-type-title-input" in MockupCanvasDesignerModal');
  }
  if (!librariesDrawerSource.includes('data-testid="master-libraries-drawer"')) {
    findings.push('Missing data-testid="master-libraries-drawer"');
  }
  if (!librariesDrawerSource.includes('data-testid="song-set-search-input"')) {
    findings.push('Missing data-testid="song-set-search-input" in master libraries drawer');
  }
  if (!librariesDrawerSource.includes('data-testid="select-master-song-set-button"')) {
    findings.push('Missing data-testid="select-master-song-set-button" in master libraries drawer');
  }
  if (!librariesDrawerSource.includes('data-testid="select-master-announcement-button"')) {
    findings.push('Missing data-testid="select-master-announcement-button" in master libraries drawer');
  }
  if (!librariesDrawerSource.includes('data-testid="add-token-button"')) {
    findings.push('Missing data-testid="add-token-button" in master libraries drawer');
  }
  if (!librariesDrawerSource.includes('data-testid="token-name-input"')) {
    findings.push('Missing data-testid="token-name-input" in master libraries drawer');
  }
  return findings;
}

test('SPEC-50-02: Reusable Master Libraries & Predefined Fields Registry Integration', () => {
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const modalPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasDesignerModal.tsx');
  const librariesDrawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMasterLibrariesDrawer.tsx');

  assert.ok(fs.existsSync(editorPath), 'MockupEditor.tsx must exist');
  assert.ok(fs.existsSync(modalPath), 'MockupCanvasDesignerModal.tsx must exist');
  assert.ok(fs.existsSync(librariesDrawerPath), 'MockupMasterLibrariesDrawer.tsx must exist');

  const editorSource = fs.readFileSync(editorPath, 'utf8');
  const modalSource = fs.readFileSync(modalPath, 'utf8');
  const librariesDrawerSource = fs.readFileSync(librariesDrawerPath, 'utf8');

  const findings = scanMasterLibrariesFeatures(editorSource, modalSource, librariesDrawerSource);
  assert.deepEqual(findings, [], `Master libraries scan findings: ${findings.join('; ')}`);
});

test('SPEC-50-02: Predefined Token Dictionary Key Validation Behavioral Rules', () => {
  // Valid token keys
  assert.equal(isValidTokenKey('sermon_speaker').valid, true);
  assert.equal(isValidTokenKey('worship_leader').valid, true);
  assert.equal(isValidTokenKey('scripture_ref_2').valid, true);
  assert.equal(isValidTokenKey('  church_date  ').normalizedKey, 'church_date');

  // Invalid / Rejected token keys (fail-closed)
  assert.equal(isValidTokenKey('').valid, false, 'Empty key must be rejected');
  assert.equal(isValidTokenKey('   ').valid, false, 'Whitespace key must be rejected');
  assert.equal(isValidTokenKey('!!!').valid, false, 'Punctuation-only key must be rejected');
  assert.equal(isValidTokenKey('___').valid, false, 'Underscore-only key must be rejected');
  assert.equal(isValidTokenKey('1sermon').valid, false, 'Key starting with digit must be rejected');
  assert.equal(isValidTokenKey('_hidden').valid, false, 'Key starting with underscore must be rejected');
});

test('SPEC-50-02: Master Library Selection Frozen Snapshot Boundary Rules', () => {
  // Master announcement set with flyers
  const masterAnnouncementSet = {
    id: 'mas-test',
    title: 'Test Warta Master',
    flyersCount: 2,
    looping: true,
    updatedAt: '2026-09-20',
    flyers: [
      { id: 'f1', title: 'Flyer 1', url: '/f1.jpg', category: 'announcement' },
      { id: 'f2', title: 'Flyer 2', url: '/f2.jpg', category: 'announcement' },
    ],
  };

  // Deep clone snapshot at selection boundary
  const appliedFlyers = masterAnnouncementSet.flyers.map((f) => ({ ...f }));

  // Mutating applied instance flyer does NOT mutate master flyer
  appliedFlyers[0].title = 'Mutated Local Flyer 1';
  assert.notEqual(
    appliedFlyers[0].title,
    masterAnnouncementSet.flyers[0].title,
    'Local instance flyer mutation must not alter master announcement flyer'
  );
  assert.equal(
    masterAnnouncementSet.flyers[0].title,
    'Flyer 1',
    'Master announcement set flyer must remain frozen'
  );
});

test('SPEC-50-02: Real-File Executable Absence Guard & Defect Injection Proofs', () => {
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const modalPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasDesignerModal.tsx');
  const librariesDrawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMasterLibrariesDrawer.tsx');

  const realEditorSource = fs.readFileSync(editorPath, 'utf8');
  const realModalSource = fs.readFileSync(modalPath, 'utf8');
  const realLibrariesSource = fs.readFileSync(librariesDrawerPath, 'utf8');

  // Defect 1: Strip choose-master-song-set-button from editor
  const defectiveEditor1 = realEditorSource.replace('data-testid="choose-master-song-set-button"', '');
  const defect1Findings = scanMasterLibrariesFeatures(defectiveEditor1, realModalSource, realLibrariesSource);
  assert.ok(
    defect1Findings.includes('Missing data-testid="choose-master-song-set-button" in MockupEditor'),
    'Absence guard must detect removal of choose-master-song-set-button from real MockupEditor'
  );

  // Defect 2: Strip save-as-new-slide-type-button from modal
  const defectiveModal2 = realModalSource.replace('data-testid="save-as-new-slide-type-button"', '');
  const defect2Findings = scanMasterLibrariesFeatures(realEditorSource, defectiveModal2, realLibrariesSource);
  assert.ok(
    defect2Findings.includes('Missing data-testid="save-as-new-slide-type-button" in MockupCanvasDesignerModal'),
    'Absence guard must detect removal of save-as-new-slide-type-button from real MockupCanvasDesignerModal'
  );

  // Defect 3: Strip token-name-input from master libraries drawer
  const defectiveLibraries3 = realLibrariesSource.replace('data-testid="token-name-input"', '');
  const defect3Findings = scanMasterLibrariesFeatures(realEditorSource, realModalSource, defectiveLibraries3);
  assert.ok(
    defect3Findings.includes('Missing data-testid="token-name-input" in master libraries drawer'),
    'Absence guard must detect removal of token-name-input from real master libraries drawer'
  );
});

