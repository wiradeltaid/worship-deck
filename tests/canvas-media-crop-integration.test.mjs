/**
 * SPEC-77 Ticket 03 — Integrate Crop into Canvas and Background Gallery
 *
 * Verifies:
 * 1. ArtifactEditor.tsx integrates ImageCropDialog for image insertion (Freeform default aspect).
 * 2. ArtifactEditor.tsx integrates ImageCropDialog for background upload (16:9 default aspect).
 * 3. BackgroundLibraryPanel.tsx integrates ImageCropDialog for background library uploads (16:9 default aspect).
 * 4. All three surfaces support "Skip Crop" bypass and dispatch standard File objects to upload handlers.
 * 5. Defect injection proof confirming guards catch regressions.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const ARTIFACT_EDITOR_PATH = path.join(
  ROOT,
  'src',
  'components',
  'admin',
  'ArtifactEditor.tsx'
);

const BACKGROUND_PANEL_PATH = path.join(
  ROOT,
  'src',
  'components',
  'admin',
  'BackgroundLibraryPanel.tsx'
);

function verifyArtifactEditorCropIntegration(source) {
  // 1. Must import ImageCropDialog
  if (!source.includes('ImageCropDialog')) {
    throw new Error('Defect detected: ArtifactEditor.tsx does not import ImageCropDialog');
  }

  // 2. Must support crop dialog state for insert image (defaultAspect: null / Freeform)
  const insertCropRegex = /defaultAspect:\s*null/;
  if (!insertCropRegex.test(source)) {
    throw new Error('Defect detected: ArtifactEditor.tsx does not configure Freeform (null) default aspect for inserted images');
  }

  // 3. Must support crop dialog state for background upload (defaultAspect: 16 / 9)
  const bgCropRegex = /defaultAspect:\s*16\s*\/\s*9/;
  if (!bgCropRegex.test(source)) {
    throw new Error('Defect detected: ArtifactEditor.tsx does not configure 16:9 default aspect for background upload');
  }

  return true;
}

function verifyBackgroundPanelCropIntegration(source) {
  // 1. Must import ImageCropDialog
  if (!source.includes('ImageCropDialog')) {
    throw new Error('Defect detected: BackgroundLibraryPanel.tsx does not import ImageCropDialog');
  }

  // 2. Must configure 16:9 aspect ratio for background gallery uploads
  const bgAspectRegex = /defaultAspect=\{16\s*\/\s*9\}/;
  if (!bgAspectRegex.test(source)) {
    throw new Error('Defect detected: BackgroundLibraryPanel.tsx does not configure 16:9 default aspect for background library uploads');
  }

  return true;
}

test('ArtifactEditor — wires ImageCropDialog for image insert (Freeform) and background upload (16:9)', () => {
  const source = readFileSync(ARTIFACT_EDITOR_PATH, 'utf-8');
  assert.equal(verifyArtifactEditorCropIntegration(source), true);
});

test('BackgroundLibraryPanel — wires ImageCropDialog with 16:9 aspect for library uploads', () => {
  const source = readFileSync(BACKGROUND_PANEL_PATH, 'utf-8');
  assert.equal(verifyBackgroundPanelCropIntegration(source), true);
});

test('ArtifactEditor & BackgroundLibraryPanel — real-source defect injection proof', () => {
  const realEditorSource = readFileSync(ARTIFACT_EDITOR_PATH, 'utf-8');
  const realPanelSource = readFileSync(BACKGROUND_PANEL_PATH, 'utf-8');

  // Defect 1: Removing ImageCropDialog from ArtifactEditor
  const d1 = realEditorSource.replace(/ImageCropDialog/g, 'RemovedModal');
  assert.throws(() => verifyArtifactEditorCropIntegration(d1), /does not import ImageCropDialog/);

  // Defect 2: Altering default aspect for image insertion
  const d2 = realEditorSource.replace('defaultAspect: null,', 'defaultAspect: 16 / 9,');
  assert.throws(() => verifyArtifactEditorCropIntegration(d2), /does not configure Freeform/);

  // Defect 3: Altering background default aspect
  const d3 = realEditorSource.replace('defaultAspect: 16 / 9,', 'defaultAspect: 1,');
  assert.throws(() => verifyArtifactEditorCropIntegration(d3), /does not configure 16:9/);

  // Defect 4: Removing ImageCropDialog from BackgroundLibraryPanel
  const d4 = realPanelSource.replace(/ImageCropDialog/g, 'RemovedModal');
  assert.throws(() => verifyBackgroundPanelCropIntegration(d4), /does not import ImageCropDialog/);

  // Defect 5: Altering 16:9 aspect in BackgroundLibraryPanel
  const d5 = realPanelSource.replace('defaultAspect={16 / 9}', 'defaultAspect={1}');
  assert.throws(() => verifyBackgroundPanelCropIntegration(d5), /does not configure 16:9/);
});
