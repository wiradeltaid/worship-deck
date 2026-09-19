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
