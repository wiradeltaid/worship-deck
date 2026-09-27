/**
 * SPEC-86-06: Strict Bilingual i18n Localization Parity Across Service & Presenter Surfaces
 * Unit, dictionary parity, locale switching, and real-file defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const keysPath = path.join(rootDir, 'src', 'lib', 'i18n', 'keys.ts');
const catalogueEnPath = path.join(rootDir, 'src', 'lib', 'i18n', 'catalogue-en.ts');
const catalogueIdPath = path.join(rootDir, 'src', 'lib', 'i18n', 'catalogue-id.ts');

const { I18N_KEYS } = await import(pathToFileURL(keysPath).href);
const { resolveString, catalogueKeys } = await import(
  pathToFileURL(path.join(rootDir, 'src', 'lib', 'i18n', 'index.ts')).href
);

export const SPEC_86_KEYS = [
  // Run-Sheet Header & Emergency Reconciliation
  'edit.offline.banner',
  'edit.offline.savedLocal',
  'edit.emergency.bannerPrefix',
  'edit.emergency.changesSaved',
  'edit.emergency.syncServer',
  'edit.emergency.saving',
  'edit.emergency.discard',
  'edit.emergency.conflictError',
  'edit.pptx.wordWrapDefault',
  'edit.pptx.wordWrapDefaultDesc',
  'edit.pptx.wordWrapDisabled',
  'edit.pptx.wordWrapDisabledDesc',
  // Song-Set Lyric Actions
  'form.songSet.editLyrics',
  'form.songSet.closeLyrics',
  'form.songSet.saveToBook',
  'form.songSet.saving',
  'form.songSet.placeholder',
  // Slide Visibility
  'slide.visibility.hide',
  'slide.visibility.unhide',
  'slide.visibility.hidden',
  // Presenter Console Controls
  'presenter.allSlides',
  'presenter.remoteCode',
  'presenter.lock',
  'presenter.unlock',
  'presenter.lockedBadge',
  'presenter.lockTitle',
  'presenter.unlockTitle',
  'presenter.emergencyEdit',
  'presenter.runSheet',
  'presenter.prev',
  'presenter.next',
  'presenter.blankScreen',
  'presenter.resumeScreen',
  'presenter.clearScripture',
  'presenter.autoLoop',
  'presenter.stopLoop',
  'presenter.liveTransition',
  'presenter.liveOnlyBadge',
  // Emergency Canvas Designer Modal
  'emergency.modal.title',
  'emergency.modal.badge',
  'emergency.modal.description',
  'emergency.modal.bgTab',
  'emergency.modal.elementPrefix',
  'emergency.modal.textLabel',
  'emergency.modal.typography',
  'emergency.modal.geometry',
  'emergency.modal.shapeFill',
  'emergency.modal.shapeStroke',
  'emergency.modal.lineColor',
  'emergency.modal.lineOpacity',
  'emergency.modal.imageUpload',
  'emergency.modal.imageUrl',
  'emergency.modal.imageFit',
  'emergency.modal.imageOpacity',
  'emergency.modal.bgHeading',
  'emergency.modal.bgColor',
  'emergency.modal.bgImageUrl',
  'emergency.modal.bgRemove',
  'emergency.modal.cancel',
  'emergency.modal.apply',
  'emergency.modal.uploading',
  'emergency.modal.footerNotice',
  // Image Crop Dialog
  'crop.hint',
  'crop.ratioLabel',
  'crop.skip',
  'crop.cancel',
  'crop.apply',
  'crop.processing',
];

export function scanBilingualParity(enPath = catalogueEnPath, idPath = catalogueIdPath, kPath = keysPath) {
  const findings = [];
  const enSrc = fs.readFileSync(enPath, 'utf8');
  const idSrc = fs.readFileSync(idPath, 'utf8');
  const keysSrc = fs.readFileSync(kPath, 'utf8');

  for (const key of SPEC_86_KEYS) {
    const keyLiteral = `'${key}'`;
    if (!keysSrc.includes(keyLiteral)) {
      findings.push(`keys.ts missing key declaration: ${key}`);
    }
    if (!enSrc.includes(`${keyLiteral}:`)) {
      findings.push(`catalogue-en.ts missing translation for key: ${key}`);
    }
    if (!idSrc.includes(`${keyLiteral}:`)) {
      findings.push(`catalogue-id.ts missing translation for key: ${key}`);
    }

    // Verify non-empty translation values
    const enVal = resolveString(key, 'en');
    const idVal = resolveString(key, 'id');
    if (!enVal || enVal.trim() === '' || enVal.startsWith('[missing:')) {
      findings.push(`English translation missing or empty for key: ${key}`);
    }
    if (!idVal || idVal.trim() === '' || idVal.startsWith('[missing:')) {
      findings.push(`Indonesian translation missing or empty for key: ${key}`);
    }
  }

  return findings;
}

test('SPEC-86-06: Strict Bilingual i18n parity across all 68 SPEC-86 keys', () => {
  const findings = scanBilingualParity();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-86-06: Language switching renders distinct, idiomatic English and Indonesian text', () => {
  // 1. Presenter Lock & Unlock
  assert.equal(resolveString('presenter.lock', 'en'), 'Lock Service');
  assert.equal(resolveString('presenter.lock', 'id'), 'Kunci Ibadah');
  assert.equal(resolveString('presenter.unlock', 'en'), 'Unlock Service');
  assert.equal(resolveString('presenter.unlock', 'id'), 'Buka Kunci');

  // 2. Slide Visibility
  assert.equal(resolveString('slide.visibility.hide', 'en'), 'Hide slide');
  assert.equal(resolveString('slide.visibility.hide', 'id'), 'Sembunyikan slide');
  assert.equal(resolveString('slide.visibility.unhide', 'en'), 'Unhide slide');
  assert.equal(resolveString('slide.visibility.unhide', 'id'), 'Tampilkan slide');
  assert.equal(resolveString('slide.visibility.hidden', 'en'), 'Hidden');
  assert.equal(resolveString('slide.visibility.hidden', 'id'), 'Tersembunyi');

  // 3. Emergency Canvas Modal
  assert.equal(resolveString('emergency.modal.title', 'en'), 'Emergency Canvas Editor');
  assert.equal(resolveString('emergency.modal.title', 'id'), 'Edit Kanvas Darurat');
  assert.equal(resolveString('emergency.modal.badge', 'en'), 'Local / Stage');
  assert.equal(resolveString('emergency.modal.badge', 'id'), 'Lokal / Panggung');

  // 4. Image Crop Dialog
  assert.equal(resolveString('crop.skip', 'en'), 'Skip Crop');
  assert.equal(resolveString('crop.skip', 'id'), 'Lewati Pemotongan');
  assert.equal(resolveString('crop.apply', 'en'), 'Crop & Upload');
  assert.equal(resolveString('crop.apply', 'id'), 'Potong & Unggah');

  // 5. Song-Set Lyric Actions
  assert.equal(resolveString('form.songSet.editLyrics', 'en'), 'Edit Lyrics');
  assert.equal(resolveString('form.songSet.editLyrics', 'id'), 'Edit Lirik');
  assert.equal(resolveString('form.songSet.saveToBook', 'en'), 'Save to Book');
  assert.equal(resolveString('form.songSet.saveToBook', 'id'), 'Simpan ke Buku');
});

test('SPEC-86-06: Real-file defect injection — missing key in catalogue-en.ts fails parity guard', () => {
  const original = fs.readFileSync(catalogueEnPath, 'utf8');
  try {
    const defective = original.replace("'slide.visibility.hide': 'Hide slide',", '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(catalogueEnPath, defective);

    const findings = scanBilingualParity();
    assert.ok(
      findings.some((f) => f.includes('catalogue-en.ts missing translation for key: slide.visibility.hide')),
      'Expected missing key in catalogue-en.ts to fail guard'
    );
  } finally {
    fs.writeFileSync(catalogueEnPath, original);
    assert.equal(fs.readFileSync(catalogueEnPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-06: Real-file defect injection — missing key in catalogue-id.ts fails parity guard', () => {
  const original = fs.readFileSync(catalogueIdPath, 'utf8');
  try {
    const defective = original.replace("'slide.visibility.hide': 'Sembunyikan slide',", '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(catalogueIdPath, defective);

    const findings = scanBilingualParity();
    assert.ok(
      findings.some((f) => f.includes('catalogue-id.ts missing translation for key: slide.visibility.hide')),
      'Expected missing key in catalogue-id.ts to fail guard'
    );
  } finally {
    fs.writeFileSync(catalogueIdPath, original);
    assert.equal(fs.readFileSync(catalogueIdPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-86-06: Real-file defect injection — missing key declaration in keys.ts fails guard', () => {
  const original = fs.readFileSync(keysPath, 'utf8');
  try {
    const defective = original.replace(/\s*'slide\.visibility\.hide',/, '');
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(keysPath, defective);

    const findings = scanBilingualParity();
    assert.ok(
      findings.some((f) => f.includes('keys.ts missing key declaration: slide.visibility.hide')),
      'Expected missing key declaration in keys.ts to fail guard'
    );
  } finally {
    fs.writeFileSync(keysPath, original);
    assert.equal(fs.readFileSync(keysPath, 'utf8'), original, 'file must be restored identically');
  }
});
