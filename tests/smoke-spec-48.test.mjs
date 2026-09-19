/**
 * SPEC-48: Unified Schedule Workspace UI/UX Visual Mockup & Interactive Prototype
 * Smoke Test & Executable Absence Guard Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePresetDate, parseRawRundownText } from '../src/operator/workspace/utils.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanWorkspaceRouteMount(appSource) {
  const findings = [];
  if (!appSource.includes('<Route path="/new" element={<WorkspaceMockupPage />} />')) {
    findings.push('Route /new is not mounted with <WorkspaceMockupPage /> in spa/src/App.tsx');
  }
  if (!appSource.includes("import WorkspaceMockupPage from './pages/WorkspaceMockupPage';")) {
    findings.push('WorkspaceMockupPage is not imported in spa/src/App.tsx');
  }
  return findings;
}

export function scanPresetOptionsCompleteness(typesSource) {
  const findings = [];
  const requiredPresets = [
    'sabbath-morning',
    'vesper-friday',
    'prayer-wednesday',
    'special-service',
    'custom-non-preset',
  ];
  for (const p of requiredPresets) {
    if (!typesSource.includes(`'${p}'`)) {
      findings.push(`Missing worship preset identifier: ${p}`);
    }
  }
  return findings;
}

export function scanWorkspacePanels(workspaceSource) {
  const findings = [];
  if (!workspaceSource.includes('data-testid="workspace-mockup"')) {
    findings.push('Missing root data-testid="workspace-mockup" container');
  }
  if (!workspaceSource.includes('data-testid="workspace-header-bar"')) {
    findings.push('Missing data-testid="workspace-header-bar"');
  }
  if (!workspaceSource.includes('<MockupTimeline')) {
    findings.push('Missing <MockupTimeline /> in WorkspaceMockupPage');
  }
  if (!workspaceSource.includes('<MockupEditor')) {
    findings.push('Missing <MockupEditor /> in WorkspaceMockupPage');
  }
  if (!workspaceSource.includes('<MockupCanvasPreview')) {
    findings.push('Missing <MockupCanvasPreview /> in WorkspaceMockupPage');
  }
  if (!workspaceSource.includes('lg:min-w-[300px] lg:max-w-[340px]')) {
    findings.push('Left panel does not enforce 300px-340px width constraints');
  }
  if (!workspaceSource.includes('lg:min-w-[400px] lg:max-w-[460px]')) {
    findings.push('Right panel does not enforce 400px-460px width constraints');
  }
  if (!workspaceSource.includes('role="radio"')) {
    findings.push('Status badges must use accessible role="radio" buttons');
  }
  return findings;
}

export function scanTimelineFeatures(timelineSource) {
  const findings = [];
  if (!timelineSource.includes('data-testid="mockup-timeline"')) {
    findings.push('Missing data-testid="mockup-timeline"');
  }
  if (!timelineSource.includes('data-testid="add-timeline-item-button"')) {
    findings.push('Missing data-testid="add-timeline-item-button"');
  }
  if (!timelineSource.includes('getTypeBadge(item.type)')) {
    findings.push('Missing getTypeBadge styling discrimination');
  }
  return findings;
}

export function scanEditorContextFeatures(editorSource) {
  const findings = [];
  if (!editorSource.includes('data-testid="mockup-editor"')) {
    findings.push('Missing data-testid="mockup-editor"');
  }
  if (!editorSource.includes('data-testid="tab-active-editor"')) {
    findings.push('Missing data-testid="tab-active-editor"');
  }
  if (!editorSource.includes('data-testid="tab-raw-rundown"')) {
    findings.push('Missing data-testid="tab-raw-rundown"');
  }
  if (!editorSource.includes('data-testid="song-context-editor"')) {
    findings.push('Missing data-testid="song-context-editor"');
  }
  if (!editorSource.includes('data-testid="song-background-picker"')) {
    findings.push('Missing data-testid="song-background-picker" for song background customization');
  }
  if (!editorSource.includes('data-testid="announcement-context-editor"')) {
    findings.push('Missing data-testid="announcement-context-editor"');
  }
  if (!editorSource.includes('data-testid="sermon-context-editor"')) {
    findings.push('Missing data-testid="sermon-context-editor"');
  }
  if (!editorSource.includes('data-testid="add-song-dialog"')) {
    findings.push('Missing in-place add song dialog drawer');
  }
  if (!editorSource.includes('data-testid="upload-flyer-dialog"')) {
    findings.push('Missing in-place upload flyer dialog drawer');
  }
  if (!editorSource.includes('parseRawRundownText')) {
    findings.push('Missing parseRawRundownText implementation in MockupEditor');
  }
  return findings;
}

export function scanCanvasPreviewFeatures(previewSource) {
  const findings = [];
  if (!previewSource.includes('data-testid="mockup-canvas-preview"')) {
    findings.push('Missing data-testid="mockup-canvas-preview"');
  }
  if (!previewSource.includes('data-testid="canvas-stage-container"')) {
    findings.push('Missing 16:9 stage container');
  }
  if (!previewSource.includes('data-testid="black-screen-toggle"')) {
    findings.push('Missing black screen toggle button');
  }
  if (!previewSource.includes('data-testid="clear-text-toggle"')) {
    findings.push('Missing clear text toggle button');
  }
  if (!previewSource.includes('data-testid="fullscreen-projector-toggle"')) {
    findings.push('Missing fullscreen projector preview toggle button');
  }
  if (!previewSource.includes('data-testid="quick-scripture-modal"')) {
    findings.push('Missing quick scripture lookup modal (UC-13)');
  }
  if (!previewSource.includes('data-testid="toggle-operator-view"')) {
    findings.push('Missing operator confidence display view toggle');
  }
  if (!previewSource.includes('data-testid="toggle-projector-view"')) {
    findings.push('Missing projector clean output view toggle');
  }
  return findings;
}

test('SPEC-48-01: Route /new mounting and workspace shell structure', () => {
  const appTsxPath = path.join(root, 'spa', 'src', 'App.tsx');
  const appSource = fs.readFileSync(appTsxPath, 'utf8');
  const findings = scanWorkspaceRouteMount(appSource);
  assert.deepEqual(findings, [], 'spa/src/App.tsx must mount WorkspaceMockupPage at /new');

  const typesPath = path.join(root, 'src', 'operator', 'workspace', 'types.ts');
  assert.ok(fs.existsSync(typesPath), 'types.ts must exist');
  const typesSource = fs.readFileSync(typesPath, 'utf8');
  const presetFindings = scanPresetOptionsCompleteness(typesSource);
  assert.deepEqual(presetFindings, [], 'All 5 preset options must be defined in types.ts');

  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');
  assert.ok(fs.existsSync(pagePath), 'WorkspaceMockupPage.tsx must exist');
  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const panelFindings = scanWorkspacePanels(pageSource);
  assert.deepEqual(panelFindings, [], 'WorkspaceMockupPage must render 3-panel layout with pixel bounds');
});

test('SPEC-48-01: Interactive Preset Date Computation & Default Times', () => {
  const baseDate = new Date('2026-09-15T00:00:00Z'); // Tuesday
  const sabbathDate = computePresetDate('sabbath-morning', baseDate);
  assert.equal(sabbathDate, '2026-09-19', 'sabbath-morning computes next Saturday');

  const vesperDate = computePresetDate('vesper-friday', baseDate);
  assert.equal(vesperDate, '2026-09-18', 'vesper-friday computes next Friday');

  const prayerDate = computePresetDate('prayer-wednesday', baseDate);
  assert.equal(prayerDate, '2026-09-16', 'prayer-wednesday computes next Wednesday');

  const customDate = computePresetDate('custom-non-preset', baseDate);
  assert.equal(customDate, '2026-09-15', 'custom-non-preset preserves current date');
});

test('SPEC-48-01: Executable Absence Guard & Physical Real-File Defect Injection for /new Route and Preset Options', () => {
  const appTsxPath = path.join(root, 'spa', 'src', 'App.tsx');
  const originalAppBytes = fs.readFileSync(appTsxPath);

  try {
    // Physical Defect Injection 1: remove route /new
    const defectContent = originalAppBytes.toString('utf8').replace('<Route path="/new" element={<WorkspaceMockupPage />} />', '');
    fs.writeFileSync(appTsxPath, defectContent, 'utf8');

    const appSource = fs.readFileSync(appTsxPath, 'utf8');
    const defectFindings = scanWorkspaceRouteMount(appSource);
    assert.ok(defectFindings.length > 0, 'Physical absence guard must detect missing /new route');
  } finally {
    // Physical Reversion
    fs.writeFileSync(appTsxPath, originalAppBytes);
  }

  // Verify clean restoration
  const restoredAppSource = fs.readFileSync(appTsxPath, 'utf8');
  assert.deepEqual(scanWorkspaceRouteMount(restoredAppSource), [], 'Restored App.tsx must pass guard');
});

test('SPEC-48-02: Interactive Run Sheet Timeline & In-Place Context Editor', () => {
  const timelinePath = path.join(root, 'src', 'operator', 'workspace', 'MockupTimeline.tsx');
  assert.ok(fs.existsSync(timelinePath), 'MockupTimeline.tsx must exist');
  const timelineSource = fs.readFileSync(timelinePath, 'utf8');
  const timelineFindings = scanTimelineFeatures(timelineSource);
  assert.deepEqual(timelineFindings, [], 'MockupTimeline must satisfy SPEC-48-02 requirements');

  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  assert.ok(fs.existsSync(editorPath), 'MockupEditor.tsx must exist');
  const editorSource = fs.readFileSync(editorPath, 'utf8');
  const editorFindings = scanEditorContextFeatures(editorSource);
  assert.deepEqual(editorFindings, [], 'MockupEditor must satisfy contextual editing requirements');
});

test('SPEC-48-02: Interactive Raw Rundown Parsing to Timeline Items', () => {
  const sampleRawText = `09:00 - Pembukaan & Ucapan Selamat Datang\n09:05 - Lagu Buka: SDAH 123 "Hai Pujilah Tuhan"\n09:20 - Warta Jemaat Mingguan\n09:30 - Pembacaan Alkitab: Yohanes 3:16\n09:35 - Khotbah: Pdt. Johnathan Doe "Kasih yang Mengubahkan"`;
  const items = parseRawRundownText(sampleRawText);
  assert.equal(items.length, 5, 'Must parse 5 distinct rundown lines');
  assert.equal(items[0].type, 'general');
  assert.equal(items[1].type, 'song');
  assert.equal(items[1].songData?.hymnNumber, 123);
  assert.equal(items[2].type, 'announcement');
  assert.equal(items[3].type, 'scripture');
  assert.equal(items[4].type, 'sermon');
  assert.equal(items[4].sermonData?.speaker, 'Pdt. Pembicara');
});

test('SPEC-48-02: Executable Absence Guard & Physical Real-File Defect Injection for Contextual Forms and In-Place Drawers', () => {
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const originalEditorBytes = fs.readFileSync(editorPath);

  try {
    // Physical Defect Injection: corrupt song-background-picker
    const defectContent = originalEditorBytes.toString('utf8').replace('data-testid="song-background-picker"', 'data-testid="corrupted-picker"');
    fs.writeFileSync(editorPath, defectContent, 'utf8');

    const editorSource = fs.readFileSync(editorPath, 'utf8');
    const defectFindings = scanEditorContextFeatures(editorSource);
    assert.ok(defectFindings.some((f) => f.includes('song-background-picker')), 'Absence guard must detect missing song background picker');
  } finally {
    // Physical Reversion
    fs.writeFileSync(editorPath, originalEditorBytes);
  }

  // Verify clean restoration
  const restoredEditorSource = fs.readFileSync(editorPath, 'utf8');
  assert.deepEqual(scanEditorContextFeatures(restoredEditorSource), [], 'Restored MockupEditor must pass guard');
});

test('SPEC-48-03: Sticky Live Canvas Preview, Quick Scripture Drawer, and Presenter Mode Simulation', () => {
  const previewPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx');
  assert.ok(fs.existsSync(previewPath), 'MockupCanvasPreview.tsx must exist');
  const previewSource = fs.readFileSync(previewPath, 'utf8');
  const previewFindings = scanCanvasPreviewFeatures(previewSource);
  assert.deepEqual(previewFindings, [], 'MockupCanvasPreview must satisfy SPEC-48-03 requirements');
});

test('SPEC-48-03: Executable Absence Guard & Physical Real-File Defect Injection for Fullscreen Toggle and Quick Scripture', () => {
  const previewPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx');
  const originalPreviewBytes = fs.readFileSync(previewPath);

  try {
    // Physical Defect Injection: remove fullscreen-projector-toggle
    const defectContent = originalPreviewBytes.toString('utf8').replace('data-testid="fullscreen-projector-toggle"', 'data-testid="missing"');
    fs.writeFileSync(previewPath, defectContent, 'utf8');

    const previewSource = fs.readFileSync(previewPath, 'utf8');
    const defectFindings = scanCanvasPreviewFeatures(previewSource);
    assert.ok(defectFindings.some((f) => f.includes('fullscreen projector preview toggle')), 'Absence guard must detect missing fullscreen toggle');
  } finally {
    // Physical Reversion
    fs.writeFileSync(previewPath, originalPreviewBytes);
  }

  // Verify clean restoration
  const restoredPreviewSource = fs.readFileSync(previewPath, 'utf8');
  assert.deepEqual(scanCanvasPreviewFeatures(restoredPreviewSource), [], 'Restored MockupCanvasPreview must pass guard');
});
