/**
 * SPEC-36: Font Import UX, Variant Association, and PPTX Microsoft OpenXML Embedding Parity Smoke Suite
 *
 * Verification of:
 * - SPEC-36-01: Font Import UX & Reusable Multi-File Upload in Artifact Editor
 * - T-36-01: Reusable import buttons in Font Popover and Toolbar Row 1
 * - T-36-01: Multi-file input with accept=".ttf,.otf" and input reset
 * - T-36-01: Dedicated "custom" category in font catalog and priority ordering
 * - T-36-01: Batch upload handling, partial failure resilience, and one-family selection rule
 * - T-36-01: Absence guards with defect injection proofs
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
  FONT_CATEGORY_LABELS,
  registerDynamicFontFace,
  getFontDefinition,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts')).href
);

const artifactEditorPath = path.join(root, 'src', 'components', 'admin', 'ArtifactEditor.tsx');
assert.ok(fs.existsSync(artifactEditorPath), 'ArtifactEditor.tsx must exist');
const editorCode = fs.readFileSync(artifactEditorPath, 'utf8');

// --------------------------------------------------------------------------
// SPEC-36-01: Font Import Controls Structure & Popover Integration
// --------------------------------------------------------------------------

test('T-36-01: ArtifactEditor contains multi-file font input with format restriction and reset', () => {
  // 1. Font import input has accept=".ttf,.otf" and multiple
  assert.ok(
    editorCode.includes('ref={fontImportInputRef}') &&
      editorCode.includes('accept=".ttf,.otf"') &&
      editorCode.includes('multiple'),
    'Font import input must support multiple .ttf and .otf files'
  );

  // 2. Both inputs reset e.target.value to allow re-uploading identical file
  const resetCount = (editorCode.match(/e\.target\.value\s*=\s*['"]['"]/g) || []).length;
  assert.ok(
    resetCount >= 2,
    'Font import and acquire file inputs must reset e.target.value upon selection'
  );
});

test('T-36-01: Popover header contains + Import Font button with click isolation', () => {
  // Popover header includes button with stopPropagation preventing premature popover dismissal
  assert.ok(
    editorCode.includes('fontImportInputRef.current?.click()'),
    'ArtifactEditor must have trigger clicking fontImportInputRef'
  );
  assert.ok(
    editorCode.includes("t('admin.artifacts.importFont')"),
    'ArtifactEditor must use translated importFont i18n label'
  );
  assert.ok(
    editorCode.includes('border-dashed'),
    'Popover import font button should use distinct styling (dashed border)'
  );
});

test('T-36-01: Toolbar Row 1 contains accessible Font Import button available without text selection', () => {
  // Toolbar row 1 has Background and Font import side by side before placeholder
  const toolbarRow1Idx = editorCode.indexOf('TOOLBAR ROW 1: ADD NEW ELEMENTS & CHANGE BACKGROUND');
  assert.ok(toolbarRow1Idx > 0, 'Toolbar Row 1 marker must exist');

  const toolbarSection = editorCode.slice(toolbarRow1Idx, toolbarRow1Idx + 5000);
  assert.ok(
    toolbarSection.includes('fontImportInputRef.current?.click()'),
    'Toolbar Row 1 must provide direct Font Import button'
  );
  assert.ok(
    toolbarSection.includes('title="Import custom font (.ttf, .otf)"'),
    'Toolbar Font Import button must provide descriptive tooltip'
  );
});

test('T-36-01: Font Catalog defines "custom" category with bilingual labels and priority ordering', () => {
  // 1. FONT_CATEGORY_LABELS contains custom with en and id
  assert.ok('custom' in FONT_CATEGORY_LABELS, 'custom category must exist in FONT_CATEGORY_LABELS');
  assert.equal(FONT_CATEGORY_LABELS.custom.en, 'Custom / Uploaded Fonts');
  assert.equal(FONT_CATEGORY_LABELS.custom.id, 'Font Kustom / Diunggah');

  // 2. ArtifactEditor lists custom category first in Popover list
  assert.ok(
    editorCode.includes("['custom', 'system', 'sans', 'serif', 'display', 'script']"),
    'ArtifactEditor Popover list must order custom category at the top'
  );
});

test('T-36-01: Dynamic FontFace registration assigns category "custom" for newly imported families', async () => {
  const dummyFace = {
    id: 'test-custom-family-123',
    family: 'Spec36TestCustomFont',
    sourceTypeface: 'Spec36TestCustomFont',
    weight: 'normal',
    style: 'normal',
    format: 'ttf',
    url: '/api/fonts/test-custom-family-123',
  };

  const ok = await registerDynamicFontFace(dummyFace);
  assert.equal(ok, true, 'Registration must succeed');
  const def = getFontDefinition(dummyFace.family);
  assert.ok(def, 'Registered face definition must be retrievable from font catalog');
  assert.equal(def.category, 'custom', 'Newly registered custom font must belong to "custom" category');
  assert.equal(def.embeddable, true, 'Custom uploaded font must be marked embeddable');
});

test('T-36-01: Failed FontFace hydration does not mutate FONT_CATALOG and returns false', async () => {
  const badFace = {
    id: 'test-corrupt-font-456',
    family: 'Spec36CorruptFontNeverRegistered',
    sourceTypeface: 'Spec36CorruptFontNeverRegistered',
    weight: 'normal',
    style: 'normal',
    format: 'ttf',
    url: '/api/fonts/test-corrupt-font-456',
  };

  // Simulate loader throwing or returning false
  const mockFailingLoader = async () => {
    throw new Error('Simulated FontFace.load() network/corrupt failure');
  };

  const result = await registerDynamicFontFace(badFace, mockFailingLoader);
  assert.equal(result, false, 'registerDynamicFontFace must return false on load failure');

  const def = getFontDefinition(badFace.family);
  assert.equal(
    def,
    undefined,
    'Failed font must NOT be added to font catalog FONT_MAP or FONT_CATALOG'
  );
});

test('T-36-01: Batch upload logic enforces case-insensitive one-family rule and text-only element guard', () => {
  // 1. Case-insensitive canonicalization
  assert.ok(
    editorCode.includes('canonical = raw.toLowerCase()'),
    'Batch upload handler must canonicalize family names case-insensitively'
  );
  assert.ok(
    editorCode.includes('familyMap.size === 1'),
    'One-family rule must check canonical familyMap size'
  );

  // 2. Only text elements are updated (shapes and images protected)
  assert.ok(
    editorCode.includes("el.type === 'text'"),
    'Batch upload application must guard against modifying non-text elements'
  );

  // 3. Selection stability guard before updating toolbar state
  assert.ok(
    editorCode.includes('selectionStillMatches'),
    'Batch upload must check selectionStillMatches before updating toolbar fontFamily'
  );

  // 4. Localized progress & result feedback
  assert.ok(
    editorCode.includes("t('admin.artifacts.importProgress')"),
    'Batch upload must report per-file progress'
  );
  assert.ok(
    editorCode.includes("t('admin.artifacts.importSingleFamilySuccess')"),
    'Batch upload must use localized single family success message'
  );
  assert.ok(
    editorCode.includes("t('admin.artifacts.importMultiFamilySuccess')"),
    'Batch upload must use localized multi family success message'
  );
});

// --------------------------------------------------------------------------
// Absence Guards & Defect Injection Proofs
// --------------------------------------------------------------------------

test('T-36-Absence-Guard 1: File input must have multiple attribute (defect injection proof)', () => {
  function validateFontInput(codeSnippet) {
    const inputMatch = codeSnippet.match(/ref=\{fontImportInputRef\}[\s\S]*?>/);
    if (!inputMatch) return false;
    if (!inputMatch[0].includes('multiple')) {
      throw new Error('ABSENCE_DEFECT: font import input lacks multiple attribute');
    }
    return true;
  }

  // Real implementation passes
  assert.ok(validateFontInput(editorCode), 'Real editor code must pass multiple validation');

  // Defect 1: missing multiple attribute
  const defectWithoutMultiple = editorCode.replace(
    /ref=\{fontImportInputRef\}[\s\S]*?multiple/,
    (match) => match.replace('multiple', '')
  );
  assert.throws(
    () => validateFontInput(defectWithoutMultiple),
    /ABSENCE_DEFECT: font import input lacks multiple attribute/
  );
});

test('T-36-Absence-Guard 2: File inputs must clear value to prevent upload lock (defect injection proof)', () => {
  function validateInputReset(codeSnippet) {
    const inputMatch = codeSnippet.match(/<input[^>]*ref=\{fontImportInputRef\}[\s\S]*?\/>/);
    if (!inputMatch) return false;
    if (!inputMatch[0].match(/e\.target\.value\s*=\s*['"]['"]/)) {
      throw new Error('ABSENCE_DEFECT: font import input fails to reset e.target.value');
    }
    return true;
  }

  // Real code passes
  assert.ok(validateInputReset(editorCode), 'Real editor code must reset e.target.value');

  // Defect 2: omitted e.target.value = ''
  const defectWithoutReset = editorCode.replace(
    /<input[^>]*ref=\{fontImportInputRef\}[\s\S]*?\/>/,
    (match) => match.replace(/e\.target\.value\s*=\s*['"]['"];?/, '/* omitted reset */')
  );
  assert.throws(
    () => validateInputReset(defectWithoutReset),
    /ABSENCE_DEFECT: font import input fails to reset e.target.value/
  );
});

test('T-36-Absence-Guard 3: Popover button must stop event propagation (defect injection proof)', () => {
  function validatePopoverClickIsolation(codeSnippet) {
    const allBtns = codeSnippet.match(/<Button[\s\S]*?<\/Button>/g) || [];
    const popoverBtn = allBtns.find(
      (b) => b.includes('border-dashed') && b.includes('fontImportInputRef.current?.click()')
    );
    if (!popoverBtn) return false;
    if (!popoverBtn.includes('stopPropagation')) {
      throw new Error('ABSENCE_DEFECT: Popover button lacks event propagation isolation');
    }
    return true;
  }

  // Real code passes
  assert.ok(validatePopoverClickIsolation(editorCode), 'Real editor code must isolate popover button events');

  // Defect 3: missing stopPropagation
  const allBtns = editorCode.match(/<Button[\s\S]*?<\/Button>/g) || [];
  const popoverBtn = allBtns.find(
    (b) => b.includes('border-dashed') && b.includes('fontImportInputRef.current?.click()')
  );
  assert.ok(popoverBtn, 'Popover button must be found for defect injection');
  const defectBtn = popoverBtn.replaceAll('stopPropagation', 'noop');
  const defectWithoutIsolation = editorCode.replace(popoverBtn, defectBtn);

  assert.throws(
    () => validatePopoverClickIsolation(defectWithoutIsolation),
    /ABSENCE_DEFECT: Popover button lacks event propagation isolation/
  );
});

test('T-36-Absence-Guard 4: Batch apply must strictly protect non-text elements (defect injection proof)', () => {
  function validateTextOnlyApply(codeSnippet) {
    const batchApplySnippet = codeSnippet.match(/setLiveElements\(\(prev\)[\s\S]*?fontStatus:\s*'uploaded'/);
    if (!batchApplySnippet) return false;
    if (!batchApplySnippet[0].includes("el.type === 'text'")) {
      throw new Error('ABSENCE_DEFECT: batch apply does not guard el.type === "text"');
    }
    return true;
  }

  // Real code passes
  assert.ok(validateTextOnlyApply(editorCode), 'Real editor code must guard el.type === "text"');

  // Defect 4: omitting el.type === 'text'
  const defectWithoutTextGuard = editorCode.replace(
    "initialSelectedIds.includes(el.id) && el.type === 'text' && el.style",
    "initialSelectedIds.includes(el.id) && el.style"
  );
  assert.throws(
    () => validateTextOnlyApply(defectWithoutTextGuard),
    /ABSENCE_DEFECT: batch apply does not guard el.type === "text"/
  );
});
