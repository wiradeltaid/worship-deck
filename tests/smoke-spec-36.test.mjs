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
import JSZip from 'jszip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const {
  FONT_CATALOG,
  FONT_CATEGORY_LABELS,
  registerDynamicFontFace,
  getFontDefinition,
  resolveFontVariantKey,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'registry', 'font-catalog.ts')).href
);

const {
  embedPresentationFonts,
  deriveObfuscationKey,
  obfuscateFont,
} = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'fonts', 'embed-fonts.ts')).href
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

  const toolbarSection = editorCode.slice(toolbarRow1Idx, toolbarRow1Idx + 10000);
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

// --------------------------------------------------------------------------
// SPEC-36-02: Font Family & Variant Association Tests
// --------------------------------------------------------------------------

test('T-36-02: resolveFontVariantKey correctly categorizes standard weight and style permutations', () => {
  assert.equal(resolveFontVariantKey('normal', 'normal'), 'regular');
  assert.equal(resolveFontVariantKey('400', 'normal'), 'regular');
  assert.equal(resolveFontVariantKey('700', 'normal'), 'bold');
  assert.equal(resolveFontVariantKey('bold', 'normal'), 'bold');
  assert.equal(resolveFontVariantKey('normal', 'italic'), 'italic');
  assert.equal(resolveFontVariantKey('400', 'italic'), 'italic');
  assert.equal(resolveFontVariantKey('700', 'italic'), 'boldItalic');
  assert.equal(resolveFontVariantKey('bold', 'italic'), 'boldItalic');
});

test('T-36-02: Multiple faces under same family register distinct variants without overwriting each other', async () => {
  const family = 'Spec36FamilyGroupingTest';

  // 1. Register regular variant
  await registerDynamicFontFace({
    id: 'f-reg-1',
    family,
    sourceTypeface: `${family}-Regular`,
    weight: 'normal',
    style: 'normal',
    format: 'ttf',
    url: '/api/fonts/f-reg-1',
  });

  // 2. Register bold variant
  await registerDynamicFontFace({
    id: 'f-bold-2',
    family,
    sourceTypeface: `${family}-Bold`,
    weight: '700',
    style: 'normal',
    format: 'ttf',
    url: '/api/fonts/f-bold-2',
  });

  // 3. Register italic variant
  await registerDynamicFontFace({
    id: 'f-ital-3',
    family,
    sourceTypeface: `${family}-Italic`,
    weight: 'normal',
    style: 'italic',
    format: 'ttf',
    url: '/api/fonts/f-ital-3',
  });

  const def = getFontDefinition(family);
  assert.ok(def, 'Family definition must exist in catalog');
  assert.equal(def.category, 'custom', 'Family must be in custom category');
  assert.ok(Array.isArray(def.variants), 'def.variants must be an array');
  assert.ok(def.variants.includes('regular'), 'Must include regular variant');
  assert.ok(def.variants.includes('bold'), 'Must include bold variant');
  assert.ok(def.variants.includes('italic'), 'Must include italic variant');
  assert.equal(def.variants.length, 3, 'Must contain exactly 3 unique variants');
});

test('T-36-02: ArtifactEditor Popover items render variant badges for custom fonts', () => {
  // Check that variant badges markup is present in ArtifactEditor popover
  assert.ok(
    editorCode.includes('f.variants && f.variants.length > 0'),
    'ArtifactEditor must inspect f.variants to render badges'
  );
  assert.ok(
    editorCode.includes("v === 'boldItalic' ? 'BI' : v === 'bold' ? 'B' : v === 'italic' ? 'I' : 'R'"),
    'ArtifactEditor must render standard compact badge labels (R, B, I, BI)'
  );
});

test('T-36-02: Replacement of existing face with new URL refreshes active registration', async () => {
  const family = 'Spec36ReplacementUrlTest';
  const loadedUrls = [];

  const mockLoader = async (fam, url, descriptors) => {
    loadedUrls.push(url);
    return true;
  };

  // 1. Initial registration
  const ok1 = await registerDynamicFontFace(
    {
      id: 'f-init-1',
      family,
      sourceTypeface: `${family}-Regular`,
      weight: 'normal',
      style: 'normal',
      format: 'ttf',
      url: '/api/fonts/f-init-1',
    },
    mockLoader
  );
  assert.equal(ok1, true, 'Initial registration must succeed');
  assert.equal(loadedUrls.length, 1);
  assert.equal(loadedUrls[0], '/api/fonts/f-init-1');

  // 2. Replacement registration with new URL for same (family, weight, style)
  const ok2 = await registerDynamicFontFace(
    {
      id: 'f-init-2',
      family,
      sourceTypeface: `${family}-Regular`,
      weight: 'normal',
      style: 'normal',
      format: 'ttf',
      url: '/api/fonts/f-init-2',
    },
    mockLoader
  );
  assert.equal(ok2, true, 'Replacement registration must succeed');
  assert.equal(loadedUrls.length, 2, 'New URL must be loaded upon replacement');
  assert.equal(loadedUrls[1], '/api/fonts/f-init-2');
});

test('T-36-Absence-Guard 5: Go backend checks family, weight, and style case-insensitively (defect injection proof)', () => {
  const fontsGoPath = path.join(root, 'internal', 'httpapi', 'fonts.go');
  assert.ok(fs.existsSync(fontsGoPath), 'fonts.go must exist');
  const fontsGoCode = fs.readFileSync(fontsGoPath, 'utf8');

  function validateUniquenessQuery(code) {
    const hasConflictQuery = code.includes(
      'family = ? COLLATE NOCASE AND weight = ? COLLATE NOCASE AND style = ? COLLATE NOCASE'
    );
    if (!hasConflictQuery) {
      throw new Error(
        'ABSENCE_DEFECT: fonts.go lacks case-insensitive (family, weight, style) conflict query'
      );
    }
    return true;
  }

  // Real code passes
  assert.ok(validateUniquenessQuery(fontsGoCode), 'Real Go code must pass uniqueness validation');

  // Defect 5: omitting COLLATE NOCASE on weight or style
  const defectQuery = fontsGoCode.replace(
    'family = ? COLLATE NOCASE AND weight = ? COLLATE NOCASE AND style = ? COLLATE NOCASE',
    'family = ? COLLATE NOCASE AND weight = ? AND style = ?'
  );
  assert.throws(
    () => validateUniquenessQuery(defectQuery),
    /ABSENCE_DEFECT: fonts\.go lacks case-insensitive \(family, weight, style\) conflict query/
  );
});

// --------------------------------------------------------------------------
// SPEC-36-03: ECMA-376 PPTX Font Obfuscation & Slot Packaging Tests
// --------------------------------------------------------------------------

test('T-36-03: deriveObfuscationKey parses GUID and reverses bytes in first 3 parts', () => {
  const guid = '{A1B2C3D4-E5F6-7890-1234-56789ABCDEF0}';
  const key = deriveObfuscationKey(guid);
  assert.ok(key && key.length === 16, 'Key must be exactly 16 bytes');

  // Part 1: A1 B2 C3 D4 -> D4 C3 B2 A1
  assert.equal(key[0], 0xd4);
  assert.equal(key[1], 0xc3);
  assert.equal(key[2], 0xb2);
  assert.equal(key[3], 0xa1);

  // Part 2: E5 F6 -> F6 E5
  assert.equal(key[4], 0xf6);
  assert.equal(key[5], 0xe5);

  // Part 3: 78 90 -> 90 78
  assert.equal(key[6], 0x90);
  assert.equal(key[7], 0x78);

  // Part 4 & 5: 12 34 56 78 9A BC DE F0
  assert.equal(key[8], 0x12);
  assert.equal(key[9], 0x34);
  assert.equal(key[10], 0x56);
  assert.equal(key[11], 0x78);
  assert.equal(key[12], 0x9a);
  assert.equal(key[13], 0xbc);
  assert.equal(key[14], 0xde);
  assert.equal(key[15], 0xf0);
});

test('T-36-03: obfuscateFont XORs first 32 bytes and round-trips symmetrically', () => {
  const dummyFont = Buffer.alloc(64);
  for (let i = 0; i < 64; i++) {
    dummyFont[i] = i & 0xff;
  }
  const key = Buffer.from('0123456789ABCDEF', 'utf8');

  // 1. Obfuscate
  const obfuscated = obfuscateFont(dummyFont, key);
  assert.equal(obfuscated.length, dummyFont.length);
  assert.notDeepEqual(obfuscated.subarray(0, 32), dummyFont.subarray(0, 32));
  assert.deepEqual(obfuscated.subarray(32), dummyFont.subarray(32), 'Bytes past 32 must remain untouched');

  // 2. Symmetric de-obfuscation
  const deobfuscated = obfuscateFont(obfuscated, key);
  assert.deepEqual(deobfuscated, dummyFont, 'De-obfuscating must yield identical source buffer');
});

test('T-36-03: embedPresentationFonts packages .odttf, MIME type, and grouped variant slots', async () => {
  const testZip = new JSZip();
  testZip.file(
    '[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  testZip.file(
    'ppt/presentation.xml',
    '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:notesSz cx="5143500" cy="9144000"/><p:defaultTextStyle/></p:presentation>'
  );
  testZip.file(
    'ppt/_rels/presentation.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="sample" Target="sample"/></Relationships>'
  );

  // Valid SFNT TrueType font fixture (with head table and 1.0 version)
  const validTtfHeader = Buffer.from([
    0x00, 0x01, 0x00, 0x00, // sfnt version 1.0 (TrueType)
    0x00, 0x01,             // numTables = 1
    0x00, 0x10,             // searchRange
    0x00, 0x00,             // entrySelector
    0x00, 0x00,             // rangeShift
    0x68, 0x65, 0x61, 0x64, // 'head' tag
    0x00, 0x00, 0x00, 0x00, // checkSum
    0x00, 0x00, 0x00, 0x1c, // offset = 28
    0x00, 0x00, 0x00, 0x14, // length = 20
    // head table data (20 bytes)
    0x00, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x5F, 0x0F, 0x3C, 0xF5, // magic number
    0x00, 0x03,
    0x08, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ]);

  const tempDir = fs.mkdtempSync(path.join(root, 'tests', '.tmp-font-'));
  const regPath = path.join(tempDir, 'custom-reg.ttf');
  const boldPath = path.join(tempDir, 'custom-bold.ttf');

  fs.writeFileSync(regPath, validTtfHeader);
  fs.writeFileSync(boldPath, validTtfHeader);

  try {
    const fontManifest = [
      { family: 'CustomBrand', weight: 'normal', style: 'normal', path: regPath },
      { family: 'CustomBrand', weight: '700', style: 'normal', path: boldPath },
    ];

    const used = [
      { family: 'CustomBrand', weight: 'normal', style: 'normal' },
      { family: 'CustomBrand', weight: '700', style: 'normal' },
    ];

    const embedded = await embedPresentationFonts(testZip, used, fontManifest);
    assert.ok(embedded.includes('CustomBrand'));

    // 1. Check .odttf parts in archive
    const odttfFiles = Object.keys(testZip.files).filter(
      (k) => k.startsWith('ppt/fonts/') && k.endsWith('.odttf')
    );
    assert.equal(odttfFiles.length, 2, 'Must contain 2 obfuscated font parts');

    // 2. Verify ECMA-376 deobfuscation roundtrip for each generated .odttf part
    for (const odttfPath of odttfFiles) {
      const obfData = await testZip.file(odttfPath).async('nodebuffer');
      assert.equal(obfData.length, validTtfHeader.length);
      assert.notDeepEqual(obfData.subarray(0, 32), validTtfHeader.subarray(0, 32));

      const filename = path.basename(odttfPath, '.odttf'); // {GUID}
      const key = deriveObfuscationKey(filename);
      assert.ok(key, `Must derive valid key from ${filename}`);
      const deobfuscated = obfuscateFont(obfData, key);
      assert.deepEqual(
        deobfuscated,
        validTtfHeader,
        'De-obfuscating archive bytes must reproduce exact valid SFNT font header'
      );
    }

    // 3. Check [Content_Types].xml MIME type
    const ctXml = await testZip.file('[Content_Types].xml').async('string');
    assert.ok(
      ctXml.includes('Extension="odttf"') &&
        ctXml.includes('ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"'),
      '[Content_Types].xml must register application/vnd.openxmlformats-officedocument.obfuscatedFont for odttf'
    );

    // 4. Check presentation.xml grouping and schema sequence
    const presXml = await testZip.file('ppt/presentation.xml').async('string');
    assert.ok(presXml.includes('<p:embeddedFontLst>'), 'Must include <p:embeddedFontLst>');

    const notesSzIdx = presXml.indexOf('notesSz');
    const fontLstIdx = presXml.indexOf('embeddedFontLst');
    const defStyleIdx = presXml.indexOf('defaultTextStyle');
    assert.ok(
      notesSzIdx !== -1 && fontLstIdx !== -1 && defStyleIdx !== -1,
      'notesSz, embeddedFontLst, and defaultTextStyle must all exist'
    );
    assert.ok(
      notesSzIdx < fontLstIdx && fontLstIdx < defStyleIdx,
      `Schema sequence must be notesSz < embeddedFontLst < defaultTextStyle (got ${notesSzIdx}, ${fontLstIdx}, ${defStyleIdx})`
    );

    const fontLstMatch = presXml.match(/<p:embeddedFontLst>([\s\S]*?)<\/p:embeddedFontLst>/);
    assert.ok(fontLstMatch, 'Must find embeddedFontLst block');
    const innerXml = fontLstMatch[1];

    // Single <p:embeddedFont> element for CustomBrand containing both regular and bold slots
    const familyBlocks = innerXml.match(/<p:embeddedFont>[\s\S]*?<\/p:embeddedFont>/g) || [];
    assert.equal(familyBlocks.length, 1, 'Both variants must be grouped in a single <p:embeddedFont>');
    assert.ok(familyBlocks[0].includes('<p:regular r:id='), 'Must declare regular slot');
    assert.ok(familyBlocks[0].includes('<p:bold r:id='), 'Must declare bold slot');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('T-36-03: Fonts flagged as restricted in manifest are omitted from embedded PPTX', async () => {
  const testZip = new JSZip();
  testZip.file(
    '[Content_Types].xml',
    '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  testZip.file(
    'ppt/presentation.xml',
    '<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"/>'
  );
  testZip.file(
    'ppt/_rels/presentation.xml.rels',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>'
  );

  const fontManifest = [
    {
      family: 'RestrictedFont',
      weight: 'normal',
      style: 'normal',
      path: '/dev/null',
      restricted: true,
    },
  ];

  const embedded = await embedPresentationFonts(testZip, ['RestrictedFont'], fontManifest);
  assert.equal(embedded.length, 0, 'Restricted fonts must not be embedded');
  const odttfFiles = Object.keys(testZip.files).filter((k) => k.endsWith('.odttf'));
  assert.equal(odttfFiles.length, 0, 'No font files should be embedded for restricted fonts');
});

test('T-36-Absence-Guard 6: [Content_Types].xml must declare obfuscatedFont MIME type (real-file defect injection proof)', () => {
  const embedFontsPath = path.join(root, 'src', 'lib', 'fonts', 'embed-fonts.ts');
  assert.ok(fs.existsSync(embedFontsPath), 'embed-fonts.ts must exist');
  const originalCode = fs.readFileSync(embedFontsPath, 'utf8');

  function scanMimeType(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    if (
      !code.includes('application/vnd.openxmlformats-officedocument.obfuscatedFont') ||
      !code.includes('Extension="odttf"')
    ) {
      throw new Error('ABSENCE_DEFECT: embed-fonts.ts does not register obfuscatedFont MIME type');
    }
    return true;
  }

  // 1. Real production file passes green
  assert.ok(scanMimeType(embedFontsPath), 'Real embed-fonts.ts must pass MIME type guard');

  // 2. Real-file defect injection with guaranteed restoration
  try {
    const defective = originalCode.replaceAll(
      'application/vnd.openxmlformats-officedocument.obfuscatedFont',
      'application/x-fontdata'
    );
    fs.writeFileSync(embedFontsPath, defective, 'utf8');
    assert.throws(
      () => scanMimeType(embedFontsPath),
      /ABSENCE_DEFECT: embed-fonts\.ts does not register obfuscatedFont MIME type/
    );
  } finally {
    fs.writeFileSync(embedFontsPath, originalCode, 'utf8');
  }
});

test('T-36-Absence-Guard 7: Font parts must use .odttf extension and ECMA-376 key obfuscation (real-file defect injection proof)', () => {
  const embedFontsPath = path.join(root, 'src', 'lib', 'fonts', 'embed-fonts.ts');
  const originalCode = fs.readFileSync(embedFontsPath, 'utf8');

  function scanObfuscation(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    if (!code.includes('.odttf') || !code.includes('deriveObfuscationKey')) {
      throw new Error('ABSENCE_DEFECT: embed-fonts.ts lacks .odttf naming or key obfuscation');
    }
    return true;
  }

  // 1. Real production file passes green
  assert.ok(scanObfuscation(embedFontsPath), 'Real code must pass obfuscation guard');

  // 2. Real-file defect injection with guaranteed restoration
  try {
    const defective = originalCode.replaceAll('.odttf', '.fntdata');
    fs.writeFileSync(embedFontsPath, defective, 'utf8');
    assert.throws(
      () => scanObfuscation(embedFontsPath),
      /ABSENCE_DEFECT: embed-fonts\.ts lacks \.odttf naming or key obfuscation/
    );
  } finally {
    fs.writeFileSync(embedFontsPath, originalCode, 'utf8');
  }
});
