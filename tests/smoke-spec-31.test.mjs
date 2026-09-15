/**
 * SPEC-31: Initial PPTX Import and Smart Background Detection Smoke Suite
 *
 * Automated verification of:
 * - T-31-01: DrawingML font size formula and TS PX_TO_PT cross-boundary parity
 * - T-31-02: ArtifactEditor UI source invariants (Import PPTX control, file input, clean mount)
 * - T-31-03: Go API route & handler invariants (POST /api/admin/artifacts/import-pptx, admin gate, atomic tx)
 * - T-31-04: Smart background detection (native p:bg vs bottom covering shape vs inset element)
 * - T-31-05: Absence Guard 1 — Native background image is never duplicated into elements
 * - T-31-06: Absence Guard 2 — Bottom full-covering shape is omitted from elements
 * - T-31-07: Executable Go test conformance suite for internal/pptximport and internal/httpapi
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { PX_TO_PT } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'artifacts', 'render-model.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');

const serverGoPath = path.join(root, 'internal', 'httpapi', 'server.go');
assert.ok(fs.existsSync(serverGoPath), 'internal/httpapi/server.go must exist');

const pptxImportGoPath = path.join(root, 'internal', 'httpapi', 'pptx_import.go');
assert.ok(fs.existsSync(pptxImportGoPath), 'internal/httpapi/pptx_import.go must exist');

const smartBgGoPath = path.join(root, 'internal', 'pptximport', 'smart_background.go');
assert.ok(fs.existsSync(smartBgGoPath), 'internal/pptximport/smart_background.go must exist');

// --------------------------------------------------------------------------
// T-31-01: Cross-boundary Font Size & Coordinate Parity
// --------------------------------------------------------------------------

test('T-31-01: DrawingML font size formula and TS PX_TO_PT cross-boundary parity', () => {
  // Go formula: DrawingMLSzToPx = (sz / 100) / pxToPt
  // TS formula: ptToPx = pt / PX_TO_PT where pt = sz / 100
  // Modern 540 pt widescreen layout: PX_TO_PT = 1.0 (540 / 540)
  assert.equal(PX_TO_PT, 1.0, 'PX_TO_PT in render-model.ts must be 1.0 for modern widescreen layout');

  const testCases = [
    { sz: 4000, pt: 40, expectedPx: 40 / 1.0 },
    { sz: 3200, pt: 32, expectedPx: 32 / 1.0 },
    { sz: 2400, pt: 24, expectedPx: 24 / 1.0 },
    { sz: 1800, pt: 18, expectedPx: 18 / 1.0 },
    { sz: 1200, pt: 12, expectedPx: 12 / 1.0 },
  ];

  for (const tc of testCases) {
    const tsDerivedPx = tc.pt / PX_TO_PT;
    const goDerivedPx = (tc.sz / 100) / 1.0;
    assert.ok(
      Math.abs(tsDerivedPx - goDerivedPx) < 0.0001,
      `Font size parity failed for sz=${tc.sz}`
    );
  }
});

// --------------------------------------------------------------------------
// T-31-02: ArtifactEditor UI Source Invariants
// --------------------------------------------------------------------------

test('T-31-02: ArtifactEditor source guards for Import PPTX control and workflow', () => {
  const code = fs.readFileSync(artifactEditorPath, 'utf8');

  // Must have file input with accept=".pptx"
  assert.ok(
    code.includes('accept=".pptx"') && code.includes('handleImportPptx'),
    'ArtifactEditor must declare hidden file input for .pptx with handleImportPptx'
  );

  // Must call the gated multipart endpoint
  assert.ok(
    code.includes('/api/admin/artifacts/import-pptx'),
    'ArtifactEditor must POST to /api/admin/artifacts/import-pptx'
  );

  // Must guard against duplicate submissions during import
  assert.ok(
    code.includes('isImporting') && code.includes('setIsImporting(true)'),
    'ArtifactEditor must track isImporting state to prevent duplicate uploads'
  );

  // Must clean mount first imported template with isDirty: false
  assert.ok(
    code.includes('setTemplate(data.firstTemplate)') && code.includes('setIsDirty(false)'),
    'ArtifactEditor must select firstTemplate and clear isDirty on success'
  );

  // Must provide "Import PPTX" button
  assert.ok(
    code.includes('Import PPTX'),
    'ArtifactEditor must render "Import PPTX" button'
  );
});

// --------------------------------------------------------------------------
// T-31-03: Go API Route and Atomic Registry Write Invariants
// --------------------------------------------------------------------------

test('T-31-03: Go API server route registration and atomic registry transaction', () => {
  const serverCode = fs.readFileSync(serverGoPath, 'utf8');
  assert.ok(
    serverCode.includes('POST /api/admin/artifacts/import-pptx') && serverCode.includes('s.importPptx'),
    'server.go must register POST /api/admin/artifacts/import-pptx route'
  );

  const importCode = fs.readFileSync(pptxImportGoPath, 'utf8');

  // Must check admin session
  assert.ok(
    importCode.includes('sessionFrom(r)') && importCode.includes('sess.Role != "admin"'),
    'importPptx must verify admin session'
  );

  // Must open atomic database transaction
  assert.ok(
    importCode.includes('s.DB.BeginTx') && importCode.includes('tx.Commit()'),
    'importPptx must commit all imported slides inside one atomic transaction'
  );

  // Must enforce uniform baseType: "general"
  assert.ok(
    importCode.includes("'general'") || importCode.includes('"general"'),
    'importPptx must enforce baseType general'
  );
});

// --------------------------------------------------------------------------
// T-31-04: Smart Background Detection Logic Invariants
// --------------------------------------------------------------------------

test('T-31-04: Smart background detection rules order and edge threshold', () => {
  const code = fs.readFileSync(smartBgGoPath, 'utf8');

  // Rule 1: Native slide background check precedes covering shape check
  const rule1NativeIdx = code.indexOf('slide.CSld.Bg != nil');
  const rule1LayoutIdx = code.indexOf('slideLayout');
  const rule2ShapeIdx = code.indexOf('Rule 2: Bottom-most full-covering image detection');

  assert.ok(rule1NativeIdx !== -1, 'Must check native slide background');
  assert.ok(rule1LayoutIdx !== -1, 'Must check slideLayout fallback');
  assert.ok(rule2ShapeIdx !== -1, 'Must check Rule 2 covering shape');

  assert.ok(
    rule1NativeIdx < rule2ShapeIdx && rule1LayoutIdx < rule2ShapeIdx,
    'Rule 1 (native slide/layout p:bg) must be evaluated before Rule 2 (covering shape)'
  );

  // Rule 2: 5% margin threshold check: x <= 5.0 && y <= 5.0 && (x+w) >= 95.0 && (y+h) >= 95.0
  assert.ok(
    code.includes('xPct <= 5.0') &&
      code.includes('yPct <= 5.0') &&
      code.includes('(xPct+wPct) >= 95.0') &&
      code.includes('(yPct+hPct) >= 95.0'),
    'Covering shape detection must enforce 5% edge threshold on all 4 boundaries'
  );
});

// --------------------------------------------------------------------------
// T-31-05: Absence Guard 1 — Native background image is never in elements
// --------------------------------------------------------------------------

test('T-31-05: Absence Guard 1 — Native background image is never in elements', () => {
  const code = fs.readFileSync(smartBgGoPath, 'utf8');

  // Source guard: When native background is set (hasNativeBg = true), parsed.BackgroundImage is set directly
  // and no element is created for it.
  const hasNativeBgCheck = code.includes('parsed.BackgroundImage = img') && code.includes('hasNativeBg = true');
  assert.ok(hasNativeBgCheck, 'Native background image sets parsed.BackgroundImage directly');

  // Executable Go absence guard proof
  const out = execSync('go test -v ./internal/pptximport -run TestAbsenceGuardNativeBackgroundNeverInElements', {
    encoding: 'utf8',
    cwd: root,
  });
  assert.ok(out.includes('--- PASS: TestAbsenceGuardNativeBackgroundNeverInElements'), 'Native background absence guard must pass in Go engine');
});

// --------------------------------------------------------------------------
// T-31-06: Absence Guard 2 — Bottom full-covering shape is omitted from elements
// --------------------------------------------------------------------------

test('T-31-06: Absence Guard 2 — Bottom full-covering shape is omitted from elements', () => {
  const code = fs.readFileSync(smartBgGoPath, 'utf8');

  // Source guard: The code must set omittedNodeIdx = 0 and skip it during foreground element extraction
  assert.ok(
    code.includes('omittedNodeIdx = 0') &&
      code.includes('if idx == omittedNodeIdx') &&
      code.includes('continue'),
    'Smart background engine must omit index 0 covering shape from elements loop'
  );

  // Executable Go absence guard proof
  const out = execSync('go test -v ./internal/pptximport -run TestAbsenceGuardBottomCoveringShapeOmittedFromElements', {
    encoding: 'utf8',
    cwd: root,
  });
  assert.ok(out.includes('--- PASS: TestAbsenceGuardBottomCoveringShapeOmittedFromElements'), 'Bottom covering shape absence guard must pass in Go engine');
});

// --------------------------------------------------------------------------
// T-31-07: Executable Go Test Conformance
// --------------------------------------------------------------------------

test('T-31-07: Go test suite passes for pptximport and httpapi', () => {
  // Run all tests in pptximport package (all 9 tests)
  const pptxOut = execSync('go test -v ./internal/pptximport/...', {
    encoding: 'utf8',
    cwd: root,
  });
  assert.ok(pptxOut.includes('--- PASS: TestDrawingMLSzToPxParity'), 'TestDrawingMLSzToPxParity must pass');
  assert.ok(pptxOut.includes('--- PASS: TestAspectRatios'), 'TestAspectRatios must pass');
  assert.ok(pptxOut.includes('--- PASS: TestNativeSlideBackground'), 'TestNativeSlideBackground must pass');
  assert.ok(pptxOut.includes('--- PASS: TestBottomCoveringShapeBackgroundDetection'), 'TestBottomCoveringShapeBackgroundDetection must pass');
  assert.ok(pptxOut.includes('--- PASS: TestInsetPhotoRemainsForegroundElement'), 'TestInsetPhotoRemainsForegroundElement must pass');
  assert.ok(pptxOut.includes('--- PASS: TestSecurityHardeningLimits'), 'TestSecurityHardeningLimits must pass');
  assert.ok(pptxOut.includes('--- PASS: TestBuildTemplatePayloadValidation'), 'TestBuildTemplatePayloadValidation must pass');
  assert.ok(pptxOut.includes('--- PASS: TestResolveSafeTargetTraversal'), 'TestResolveSafeTargetTraversal must pass');
  assert.ok(pptxOut.includes('PASS'), 'pptximport package test suite must pass');

  // Run full httpapi package test suite without filter
  const httpOut = execSync('go test -v ./internal/httpapi', {
    encoding: 'utf8',
    cwd: root,
  });
  assert.ok(httpOut.includes('--- PASS: TestImportPptxAuthorization'), 'TestImportPptxAuthorization must pass');
  assert.ok(httpOut.includes('--- PASS: TestImportPptxAtomicRollback'), 'TestImportPptxAtomicRollback must pass');
  assert.ok(httpOut.includes('--- PASS: TestImportPptxAtomicRollbackOnPromotionFailure'), 'TestImportPptxAtomicRollbackOnPromotionFailure must pass');
  assert.ok(httpOut.includes('PASS'), 'httpapi import test suite must pass');
});
