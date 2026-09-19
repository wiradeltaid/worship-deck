/**
 * SPEC-49: Unified Schedule Workspace Full Milestone Prototype
 * Smoke Test & Executable Absence Guard Suite
 *
 * Verifies:
 * - In-place visual Canvas Designer modal (SPEC-49-01)
 * - Custom Slide (custom_slide) item type and Blank Slate workflow (SPEC-49-02)
 * - Duty roster personnel integration and predefined token dynamic binding (SPEC-49-03)
 * - In-place media gallery asset manager drawer (SPEC-49-04)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanCanvasDesignerFeatures(source) {
  const findings = [];
  if (!source.includes('data-testid="canvas-designer-modal"')) {
    findings.push('Missing data-testid="canvas-designer-modal"');
  }
  if (!source.includes('data-testid="designer-live-canvas"')) {
    findings.push('Missing 16:9 interactive live canvas stage');
  }
  if (!source.includes('data-testid="designer-align-left"')) {
    findings.push('Missing horizontal align left button');
  }
  if (!source.includes('data-testid="designer-align-center"')) {
    findings.push('Missing horizontal align center button');
  }
  if (!source.includes('data-testid="designer-align-right"')) {
    findings.push('Missing horizontal align right button');
  }
  if (!source.includes('data-testid="designer-valign-top"')) {
    findings.push('Missing vertical align top button');
  }
  if (!source.includes('data-testid="designer-valign-middle"')) {
    findings.push('Missing vertical align middle button');
  }
  if (!source.includes('data-testid="designer-valign-bottom"')) {
    findings.push('Missing vertical align bottom button');
  }
  if (!source.includes('data-testid="designer-font-family-select"')) {
    findings.push('Missing font family select control');
  }
  if (!source.includes('data-testid="designer-font-size-input"')) {
    findings.push('Missing font size control');
  }
  if (!source.includes('data-testid="canvas-designer-apply-button"')) {
    findings.push('Missing apply changes button');
  }
  if (!source.includes('data-testid="canvas-designer-cancel-button"')) {
    findings.push('Missing cancel button');
  }
  return findings;
}

export function scanCustomSlideFeatures(timelineSource, editorSource, typesSource, pageSource) {
  const findings = [];
  if (!typesSource.includes("'custom_slide'")) {
    findings.push("Missing 'custom_slide' in TimelineItemType (types.ts)");
  }
  if (!typesSource.includes('customSlideData')) {
    findings.push('Missing customSlideData definition in types.ts');
  }
  if (!timelineSource.includes('data-testid="add-custom-slide-option"')) {
    findings.push('Missing add custom slide option in timeline dropdown');
  }
  if (!timelineSource.includes('data-testid="timeline-empty-state"')) {
    findings.push('Missing timeline empty state placeholder for blank schedule');
  }
  if (!timelineSource.includes('data-testid="add-first-item-button"')) {
    findings.push('Missing add first item button in empty timeline');
  }
  if (!editorSource.includes('data-testid="custom-slide-context-editor"')) {
    findings.push('Missing custom slide contextual editor in MockupEditor');
  }
  if (!editorSource.includes('data-testid="custom-slide-title-input"')) {
    findings.push('Missing custom slide title input in MockupEditor');
  }
  if (!editorSource.includes('data-testid="custom-slide-content-textarea"')) {
    findings.push('Missing custom slide multiline textarea in MockupEditor');
  }
  if (!pageSource.includes('data-testid="blank-slate-clear-button"')) {
    findings.push('Missing blank slate clear schedule button in WorkspaceMockupPage');
  }
  return findings;
}

export function scanDutyRosterFeatures(drawerSource, editorSource) {
  const findings = [];
  if (!drawerSource.includes('data-testid="duty-roster-drawer"')) {
    findings.push('Missing data-testid="duty-roster-drawer"');
  }
  if (!drawerSource.includes('data-testid="duty-roster-list"')) {
    findings.push('Missing duty roster personnel list');
  }
  if (!drawerSource.includes('data-testid="add-roster-person-input"')) {
    findings.push('Missing inline add new roster person input');
  }
  if (!drawerSource.includes('data-testid="add-roster-person-button"')) {
    findings.push('Missing inline add new roster person submit button');
  }
  if (!editorSource.includes('data-testid="open-duty-roster-button"')) {
    findings.push('Missing open duty roster button in sermon editor');
  }
  if (!editorSource.includes('data-testid="sermon-speaker-token-badge"')) {
    findings.push('Missing dynamic token binding preview badge for {sermon_speaker}');
  }
  return findings;
}

export function scanMediaGalleryFeatures(drawerSource, editorSource) {
  const findings = [];
  if (!drawerSource.includes('data-testid="media-gallery-drawer"')) {
    findings.push('Missing data-testid="media-gallery-drawer"');
  }
  if (!drawerSource.includes('media-category-all')) {
    findings.push('Missing category all filter button');
  }
  if (!drawerSource.includes('media-category-background')) {
    findings.push('Missing category background filter button');
  }
  if (!drawerSource.includes('data-testid="media-gallery-grid"')) {
    findings.push('Missing media gallery asset grid');
  }
  if (!drawerSource.includes('data-testid="media-gallery-assign-button"')) {
    findings.push('Missing assign background button');
  }
  if (!drawerSource.includes('data-testid="media-gallery-upload-button"')) {
    findings.push('Missing simulate upload button');
  }
  if (!editorSource.includes('data-testid="open-media-gallery-button"')) {
    findings.push('Missing open media gallery button in MockupEditor');
  }
  return findings;
}

test('SPEC-49-01: In-Place Visual Canvas Designer Modal Structure & Controls', () => {
  const designerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasDesignerModal.tsx');
  assert.ok(fs.existsSync(designerPath), 'MockupCanvasDesignerModal.tsx must exist');
  const designerSource = fs.readFileSync(designerPath, 'utf8');
  const findings = scanCanvasDesignerFeatures(designerSource);
  assert.deepEqual(findings, [], 'MockupCanvasDesignerModal must render all layout and typography controls');

  // Verify modal triggers in editor and preview
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const editorSource = fs.readFileSync(editorPath, 'utf8');
  assert.ok(
    editorSource.includes('data-testid="open-canvas-designer-button"'),
    'MockupEditor must provide trigger button for Canvas Designer'
  );

  const previewPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx');
  const previewSource = fs.readFileSync(previewPath, 'utf8');
  assert.ok(
    previewSource.includes('data-testid="canvas-preview-edit-layout-button"'),
    'MockupCanvasPreview must provide edit canvas layout button in header'
  );
});

test('SPEC-49-01: Executable Absence Guard & Physical Real-File Defect Injection for Canvas Designer Modal', () => {
  const designerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasDesignerModal.tsx');
  const originalBytes = fs.readFileSync(designerPath);

  try {
    // Inject physical defect: remove the live canvas element
    const defect = originalBytes.toString('utf8').replace('data-testid="designer-live-canvas"', '');
    fs.writeFileSync(designerPath, defect, 'utf8');

    const defectSource = fs.readFileSync(designerPath, 'utf8');
    const defectFindings = scanCanvasDesignerFeatures(defectSource);
    assert.ok(
      defectFindings.length > 0,
      'Absence guard must catch missing designer live canvas'
    );
  } finally {
    // Physical reversion
    fs.writeFileSync(designerPath, originalBytes);
  }

  // Verify clean restoration
  const restoredSource = fs.readFileSync(designerPath, 'utf8');
  assert.deepEqual(scanCanvasDesignerFeatures(restoredSource), [], 'Restored file must pass cleanly');
});

test('SPEC-49-02: Custom Slide Item Type & Blank Slate Free Schedule Workflow', () => {
  const timelinePath = path.join(root, 'src', 'operator', 'workspace', 'MockupTimeline.tsx');
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const typesPath = path.join(root, 'src', 'operator', 'workspace', 'types.ts');
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');

  const timelineSource = fs.readFileSync(timelinePath, 'utf8');
  const editorSource = fs.readFileSync(editorPath, 'utf8');
  const typesSource = fs.readFileSync(typesPath, 'utf8');
  const pageSource = fs.readFileSync(pagePath, 'utf8');

  const findings = scanCustomSlideFeatures(timelineSource, editorSource, typesSource, pageSource);
  assert.deepEqual(findings, [], 'Custom slide item type and blank slate free schedule must be complete');

  // Verify custom slide rendering in canvas preview
  const previewPath = path.join(root, 'src', 'operator', 'workspace', 'MockupCanvasPreview.tsx');
  const previewSource = fs.readFileSync(previewPath, 'utf8');
  assert.ok(
    previewSource.includes('data-testid="custom-slide-preview"'),
    'MockupCanvasPreview must render custom_slide items with observable preview container'
  );
});

test('SPEC-49-02: Executable Absence Guard & Physical Real-File Defect Injection for Custom Slide & Blank Slate', () => {
  const timelinePath = path.join(root, 'src', 'operator', 'workspace', 'MockupTimeline.tsx');
  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const typesPath = path.join(root, 'src', 'operator', 'workspace', 'types.ts');
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'WorkspaceMockupPage.tsx');

  const timelineSource = fs.readFileSync(timelinePath, 'utf8');
  const editorSource = fs.readFileSync(editorPath, 'utf8');
  const typesSource = fs.readFileSync(typesPath, 'utf8');
  const originalBytes = fs.readFileSync(pagePath);

  try {
    // Inject physical defect: remove blank-slate-clear-button
    const defect = originalBytes.toString('utf8').replace('data-testid="blank-slate-clear-button"', '');
    fs.writeFileSync(pagePath, defect, 'utf8');

    const defectSource = fs.readFileSync(pagePath, 'utf8');
    const defectFindings = scanCustomSlideFeatures(timelineSource, editorSource, typesSource, defectSource);
    assert.ok(
      defectFindings.length > 0 &&
        defectFindings.includes('Missing blank slate clear schedule button in WorkspaceMockupPage'),
      'Absence guard must detect missing blank slate button through scanCustomSlideFeatures'
    );
  } finally {
    // Physical reversion
    fs.writeFileSync(pagePath, originalBytes);
  }

  // Verify clean restoration
  const restoredSource = fs.readFileSync(pagePath, 'utf8');
  assert.deepEqual(
    scanCustomSlideFeatures(timelineSource, editorSource, typesSource, restoredSource),
    [],
    'Restored file must pass scanCustomSlideFeatures cleanly'
  );
});

test('SPEC-49-03: Duty Roster Personnel Integration & Dynamic Token Binding', () => {
  const drawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupDutyRosterDrawer.tsx');
  assert.ok(fs.existsSync(drawerPath), 'MockupDutyRosterDrawer.tsx must exist');
  const drawerSource = fs.readFileSync(drawerPath, 'utf8');

  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const editorSource = fs.readFileSync(editorPath, 'utf8');

  const findings = scanDutyRosterFeatures(drawerSource, editorSource);
  assert.deepEqual(findings, [], 'Duty roster drawer and sermon token binding must be complete');

  // Verify strictly synthetic names
  const typesPath = path.join(root, 'src', 'operator', 'workspace', 'types.ts');
  const typesSource = fs.readFileSync(typesPath, 'utf8');
  assert.ok(
    typesSource.includes('Diaken Natanael Markus (Sintetis)') &&
    typesSource.includes('Pdt. Yohanes Timotius (Sintetis)'),
    'Duty roster must strictly use synthetic identities'
  );
});

test('SPEC-49-03: Executable Absence Guard & Physical Real-File Defect Injection for Duty Roster', () => {
  const drawerPath = path.join(root, 'src', 'operator', 'workspace', 'MockupDutyRosterDrawer.tsx');
  const originalBytes = fs.readFileSync(drawerPath);

  try {
    // Inject physical defect: remove duty-roster-list
    const defect = originalBytes.toString('utf8').replace('data-testid="duty-roster-list"', '');
    fs.writeFileSync(drawerPath, defect, 'utf8');

    const defectSource = fs.readFileSync(drawerPath, 'utf8');
    const editorSource = fs.readFileSync(path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx'), 'utf8');
    const defectFindings = scanDutyRosterFeatures(defectSource, editorSource);
    assert.ok(defectFindings.length > 0, 'Absence guard must detect missing duty roster list');
  } finally {
    // Physical reversion
    fs.writeFileSync(drawerPath, originalBytes);
  }

  // Verify clean restoration
  const restoredSource = fs.readFileSync(drawerPath, 'utf8');
  const editorSource = fs.readFileSync(path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx'), 'utf8');
  assert.deepEqual(scanDutyRosterFeatures(restoredSource, editorSource), [], 'Restored file must pass');
});

test('SPEC-49-04: In-Place Media Gallery Asset Manager Drawer', () => {
  const galleryPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMediaGalleryDrawer.tsx');
  assert.ok(fs.existsSync(galleryPath), 'MockupMediaGalleryDrawer.tsx must exist');
  const gallerySource = fs.readFileSync(galleryPath, 'utf8');

  const editorPath = path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx');
  const editorSource = fs.readFileSync(editorPath, 'utf8');

  const findings = scanMediaGalleryFeatures(gallerySource, editorSource);
  assert.deepEqual(findings, [], 'Media gallery drawer and editor triggers must be complete');
});

test('SPEC-49-04: Executable Absence Guard & Physical Real-File Defect Injection for Media Gallery', () => {
  const galleryPath = path.join(root, 'src', 'operator', 'workspace', 'MockupMediaGalleryDrawer.tsx');
  const originalBytes = fs.readFileSync(galleryPath);

  try {
    // Inject physical defect: remove media-gallery-grid
    const defect = originalBytes.toString('utf8').replace('data-testid="media-gallery-grid"', '');
    fs.writeFileSync(galleryPath, defect, 'utf8');

    const defectSource = fs.readFileSync(galleryPath, 'utf8');
    const editorSource = fs.readFileSync(path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx'), 'utf8');
    const defectFindings = scanMediaGalleryFeatures(defectSource, editorSource);
    assert.ok(defectFindings.length > 0, 'Absence guard must detect missing media gallery grid');
  } finally {
    // Physical reversion
    fs.writeFileSync(galleryPath, originalBytes);
  }

  // Verify clean restoration
  const restoredSource = fs.readFileSync(galleryPath, 'utf8');
  const editorSource = fs.readFileSync(path.join(root, 'src', 'operator', 'workspace', 'MockupEditor.tsx'), 'utf8');
  assert.deepEqual(scanMediaGalleryFeatures(restoredSource, editorSource), [], 'Restored file must pass');
});

test('SPEC-49-Behavioral: Data model and token binding integrity', async () => {
  const { SYNTHETIC_ROSTER_SEED, SYNTHETIC_MEDIA_CATALOG } = await import('../src/operator/workspace/types.ts');
  assert.ok(SYNTHETIC_ROSTER_SEED.length >= 5, 'Roster seed must contain at least 5 synthetic personnel');
  for (const person of SYNTHETIC_ROSTER_SEED) {
    assert.ok(person.name.includes('(Sintetis)'), `Roster name "${person.name}" must be explicitly marked synthetic`);
  }

  assert.ok(SYNTHETIC_MEDIA_CATALOG.length >= 6, 'Media catalog must contain at least 6 initial assets');
  const categories = new Set(SYNTHETIC_MEDIA_CATALOG.map((a) => a.category));
  assert.ok(
    categories.has('background') && categories.has('cross') && categories.has('nature') && categories.has('texture'),
    'Catalog must cover all 4 main visual categories'
  );
});
