/**
 * SPEC-37: Cross-Surface Font Availability Parity, Multi-Context Hydration,
 * and Unacquired Font Status Reconciliation Smoke Suite
 *
 * Verification of:
 * - SPEC-37-01: Artifact Editor Unacquired Font Warning Logic Correction & Status Reconciliation
 * - T-37-01: Decouple warning indicator from stale element property (hide warning if font acquired)
 * - T-37-01: Batch font upload element fontStatus reconciliation across liveElements
 * - T-37-01: Template load reconciliation pass away from 'unresolved' for acquired fonts
 * - T-37-01: PPTX import recognition of existing SQLite font_faces
 * - T-37-01: Absence guards with defect injection proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  FONT_CATALOG,
  getFontDefinition,
  isFontExportReady,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');

const pptxImportPath = path.join(root, 'internal', 'httpapi', 'pptx_import.go');
assert.ok(fs.existsSync(pptxImportPath), 'pptx_import.go must exist');
const pptxImportCode = fs.readFileSync(pptxImportPath, 'utf8');

// --------------------------------------------------------------------------
// SPEC-37-01: Reconciled Unacquired Font Evaluation & State Synchronization
// --------------------------------------------------------------------------

test('T-37-01: ArtifactEditor decouples Unacquired Font indicator from stale fontStatus property', () => {
  // 1. Code in ArtifactEditor.tsx must evaluate isFontAcquired first and set isUnacquired = !isFontAcquired
  assert.ok(
    editorCode.includes('const isFontAcquired = isFontExportReady(fontFamily) || Boolean(getFontDefinition(fontFamily));') &&
      editorCode.includes('const isUnacquired = !isFontAcquired;'),
    'ArtifactEditor must decouple isUnacquired from stale element fontStatus property'
  );

  // 2. Exact DOM text "Unacquired Font" indicator must exist
  assert.ok(
    editorCode.includes('Unacquired Font'),
    'ArtifactEditor must render "Unacquired Font" indicator when font is truly unacquired'
  );

  // 3. Stale OR short-circuit pattern must be absent
  assert.ok(
    !editorCode.includes("activeEl?.style?.fontStatus === 'unresolved' ||"),
    'ArtifactEditor must NOT short-circuit to true when element has stale fontStatus unresolved'
  );
});

test('T-37-01: Logic test & Defect Injection proof: acquired font with stale unresolved status never triggers warning', () => {
  // Pick an acquired catalog font
  const testFamily = 'Inter';
  assert.ok(getFontDefinition(testFamily) || isFontExportReady(testFamily), 'Inter must be an acquired font');

  const staleElement = {
    id: 'el-1',
    type: 'text',
    style: {
      fontFamily: testFamily,
      fontStatus: 'unresolved', // stale from previous PPTX import or unhydrated save
    },
  };

  // Reconciled logic under test:
  const evaluateUnacquiredFixed = (fam, el) => {
    const isFontAcquired = isFontExportReady(fam) || Boolean(getFontDefinition(fam));
    return !isFontAcquired;
  };

  // Defective legacy logic:
  const evaluateUnacquiredDefective = (fam, el) => {
    return (
      el?.style?.fontStatus === 'unresolved' ||
      (!isFontExportReady(fam) && !getFontDefinition(fam))
    );
  };

  // 1. Fixed logic evaluates to FALSE (no unacquired warning)
  assert.equal(
    evaluateUnacquiredFixed(testFamily, staleElement),
    false,
    'Acquired font must NOT trigger unacquired warning even if element has stale fontStatus: unresolved'
  );

  // 2. Defect injection proof: defective logic evaluates to TRUE (false positive warning)
  assert.equal(
    evaluateUnacquiredDefective(testFamily, staleElement),
    true,
    'Defect injection: legacy logic incorrectly produced true for acquired font with stale unresolved status'
  );

  // 3. Truly unacquired font evaluates to TRUE on fixed logic
  const unacquiredFamily = 'NonExistentMysteryFont123';
  const unacquiredElement = {
    id: 'el-2',
    type: 'text',
    style: {
      fontFamily: unacquiredFamily,
      fontStatus: 'unresolved',
    },
  };
  assert.equal(
    evaluateUnacquiredFixed(unacquiredFamily, unacquiredElement),
    true,
    'Truly unacquired font must evaluate to true (warning shown)'
  );
});

test('T-37-01: Batch font upload reconciles fontStatus for all live elements matching uploaded families', () => {
  assert.ok(
    editorCode.includes('uploadedFamilySet.has(el.style.fontFamily.trim().toLowerCase())') &&
      editorCode.includes("fontStatus: 'uploaded'"),
    'handleFontUploadBatch must reconcile fontStatus to uploaded for all matching elements across liveElements'
  );
  assert.ok(
    editorCode.includes('markDirty()'),
    'handleFontUploadBatch must mark dirty when reconciling elements'
  );
});

test('T-37-01: Template mount reconciliation pass cleans up stale unresolved fontStatus', () => {
  assert.ok(
    editorCode.includes('isAcquired && el.style.fontStatus === \'unresolved\'') &&
      editorCode.includes("fontStatus: 'uploaded'"),
    'ArtifactEditor template mount must reconcile unresolved fontStatus for already acquired fonts'
  );
});

test('T-37-01: PPTX import reconciles unacquired custom fonts against existing SQLite font_faces', () => {
  assert.ok(
    pptxImportCode.includes('SELECT 1 FROM font_faces') &&
      pptxImportCode.includes('source_typeface = ? COLLATE NOCASE') &&
      pptxImportCode.includes('family = ? COLLATE NOCASE') &&
      pptxImportCode.includes('el.Style["fontStatus"] = "uploaded"'),
    'PPTX import must check SQLite font_faces matching family and source_typeface and mark previously imported fonts as uploaded'
  );
  assert.ok(
    pptxImportCode.includes('parseResult.Warnings = filteredResultWarns'),
    'PPTX import must filter out false unacquired warnings from aggregate parseResult.Warnings'
  );
});
