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
  'emergency.modal.bgUpload',
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
  assert.equal(resolveString('emergency.modal.bgUpload', 'en'), 'Upload & Crop Background');
  assert.equal(resolveString('emergency.modal.bgUpload', 'id'), 'Unggah & Potong Latar');

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

export function scanAllKeysBilingualParity(
  enPath = catalogueEnPath,
  idPath = catalogueIdPath,
  kPath = keysPath
) {
  const findings = [];
  const enSrc = fs.readFileSync(enPath, 'utf8');
  const idSrc = fs.readFileSync(idPath, 'utf8');
  const keysSrc = fs.readFileSync(kPath, 'utf8');

  for (const key of I18N_KEYS) {
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

test('SPEC-112-01: Full dictionary parity across all I18N_KEYS', () => {
  const findings = scanAllKeysBilingualParity();
  assert.deepEqual(
    findings,
    [],
    `Expected 0 findings across all ${I18N_KEYS.length} keys, got: ${findings.join(', ')}`
  );
});

test('SPEC-112-01: Interpolation engine replaces {variable} tokens and handles edge cases', () => {
  // 1. Numeric percent interpolation
  assert.equal(
    resolveString('media.badge.downloading', 'en', { percent: 45 }),
    'Downloading 45%'
  );
  assert.equal(
    resolveString('media.badge.downloading', 'id', { percent: 45 }),
    'Mengunduh 45%'
  );

  // 2. Count interpolation
  assert.equal(
    resolveString('media.topBar.drawerCount', 'en', { count: 3 }),
    'Media (3)'
  );
  assert.equal(
    resolveString('media.topBar.drawerCount', 'id', { count: 3 }),
    'Media (3)'
  );

  // 3. Interval interpolation
  assert.equal(
    resolveString('presenter.stage.loopingBadge', 'en', { interval: 5 }),
    'Looping (5s)'
  );
  assert.equal(
    resolveString('presenter.stage.loopingBadge', 'id', { interval: 5 }),
    'Looping (5s)'
  );

  // 4. Slide index interpolation
  assert.equal(
    resolveString('runsheet.resumeAction', 'en', { slide: 12 }),
    'Resume (Slide 12)'
  );
  assert.equal(
    resolveString('runsheet.resumeAction', 'id', { slide: 12 }),
    'Lanjutkan (Slide 12)'
  );

  // 5. Missing param preserves {token}
  assert.equal(
    resolveString('media.badge.downloading', 'en', {}),
    'Downloading {percent}%'
  );

  // 6. Missing key defect marker invariant
  assert.equal(
    resolveString('nonexistent.key.xyz', 'en'),
    '[missing:i18n:nonexistent.key.xyz]'
  );
});

test('SPEC-112-01: operator.tsx static contract wires optional params in LocaleApi.t and useT()', () => {
  const operatorSrc = fs.readFileSync(
    path.join(rootDir, 'src', 'lib', 'i18n', 'operator.tsx'),
    'utf8'
  );
  assert.ok(
    operatorSrc.includes(
      't: (key: I18nKey, params?: Record<string, string | number>) => string;'
    ),
    'LocaleApi.t must declare optional params parameter'
  );
  assert.ok(
    operatorSrc.includes('t: (key, params) => resolveString(key, locale, params)'),
    'OperatorUiLocaleProvider must forward params to resolveString'
  );
  assert.ok(
    operatorSrc.includes("t: (key, params) => resolveString(key, 'en', params)"),
    'useT fallback must forward params to resolveString'
  );
});

test('SPEC-112-01: Real-file defect injection — missing key in catalogue-en.ts fails all-keys parity guard', () => {
  const original = fs.readFileSync(catalogueEnPath, 'utf8');
  try {
    const defective = original.replace(
      "'media.badge.downloading': 'Downloading {percent}%',",
      ''
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(catalogueEnPath, defective);

    const findings = scanAllKeysBilingualParity();
    assert.ok(
      findings.some((f) =>
        f.includes(
          'catalogue-en.ts missing translation for key: media.badge.downloading'
        )
      ),
      'Expected missing key in catalogue-en.ts to fail guard'
    );
  } finally {
    fs.writeFileSync(catalogueEnPath, original);
    assert.equal(
      fs.readFileSync(catalogueEnPath, 'utf8'),
      original,
      'file must be restored identically'
    );
  }
});

export function scanMediaPlayerSuiteLocalization(
  mediaDir = path.join(rootDir, 'src', 'operator', 'present', 'media-player')
) {
  const findings = [];
  const files = [
    'MediaDrawer.tsx',
    'MediaTopBar.tsx',
    'MediaStatusBadge.tsx',
    'MediaUploader.tsx',
    'MediaLauncherButton.tsx',
    'MediaDock.tsx',
    'MediaControlBar.tsx',
  ];

  for (const file of files) {
    const fullPath = path.join(mediaDir, file);
    if (!fs.existsSync(fullPath)) {
      findings.push(`File missing: ${file}`);
      continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');
    if (!content.includes('useT()')) {
      findings.push(`${file} must consume useT() hook`);
    }
  }

  const drawerSrc = fs.readFileSync(path.join(mediaDir, 'MediaDrawer.tsx'), 'utf8');
  const topBarSrc = fs.readFileSync(path.join(mediaDir, 'MediaTopBar.tsx'), 'utf8');
  const dockSrc = fs.readFileSync(path.join(mediaDir, 'MediaDock.tsx'), 'utf8');
  const uploaderSrc = fs.readFileSync(path.join(mediaDir, 'MediaUploader.tsx'), 'utf8');
  const launcherSrc = fs.readFileSync(path.join(mediaDir, 'MediaLauncherButton.tsx'), 'utf8');
  const controlBarSrc = fs.readFileSync(path.join(mediaDir, 'MediaControlBar.tsx'), 'utf8');

  // Forbidden un-localized literals
  const forbiddenRawStrings = [
    { src: drawerSrc, file: 'MediaDrawer.tsx', raw: 'Tutup Panel Media' },
    { src: drawerSrc, file: 'MediaDrawer.tsx', raw: '<h2 className="text-sm font-semibold text-foreground">Pustaka Media</h2>' },
    { src: drawerSrc, file: 'MediaDrawer.tsx', raw: 'Pustaka cloud kosong' },
    { src: drawerSrc, file: 'MediaDrawer.tsx', raw: 'Belum ada media offline' },
    { src: drawerSrc, file: 'MediaDrawer.tsx', raw: "description: 'Media files'" },
    { src: drawerSrc, file: 'MediaDrawer.tsx', raw: '<span>KIRIM</span>' },
    { src: topBarSrc, file: 'MediaTopBar.tsx', raw: '<span>PUTAR</span>' },
    { src: topBarSrc, file: 'MediaTopBar.tsx', raw: '<span>JEDA</span>' },
    { src: topBarSrc, file: 'MediaTopBar.tsx', raw: '<span>FADE</span>' },
    { src: topBarSrc, file: 'MediaTopBar.tsx', raw: 'title="Berhenti (Stop)"' },
    { src: dockSrc, file: 'MediaDock.tsx', raw: 'title="Buka Daftar Putar"' },
    { src: dockSrc, file: 'MediaDock.tsx', raw: 'aria-label="Posisi pemutaran media"' },
    { src: dockSrc, file: 'MediaDock.tsx', raw: 'aria-label="Volume media"' },
    { src: launcherSrc, file: 'MediaLauncherButton.tsx', raw: 'title="Buka Media Player & Playlist"' },
    { src: uploaderSrc, file: 'MediaUploader.tsx', raw: 'Tambah Audio / Video (Maks 500 MiB)' },
    { src: controlBarSrc, file: 'MediaControlBar.tsx', raw: "'Proyeksi video hanya untuk berkas video'" },
  ];

  for (const { src, file, raw } of forbiddenRawStrings) {
    if (src.includes(raw)) {
      findings.push(`${file} contains un-localized raw string: ${raw}`);
    }
  }

  return findings;
}

test('SPEC-112-02: Media player suite components consume useT() and avoid hardcoded raw strings', () => {
  const findings = scanMediaPlayerSuiteLocalization();
  assert.deepEqual(findings, [], `Expected 0 findings in media player suite, got: ${findings.join(', ')}`);
});

test('SPEC-112-02: Real-file defect injection — raw un-localized string in MediaDock.tsx fails scan', () => {
  const dockPath = path.join(rootDir, 'src', 'operator', 'present', 'media-player', 'MediaDock.tsx');
  const original = fs.readFileSync(dockPath, 'utf8');
  try {
    const defective = original.replace(
      "{t('media.dock.openPlaylist')}",
      '"Buka Daftar Putar"'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(dockPath, defective);

    const findings = scanMediaPlayerSuiteLocalization();
    assert.ok(
      findings.some((f) => f.includes('MediaDock.tsx contains un-localized raw string')),
      'Expected raw string in MediaDock.tsx to trigger finding'
    );
  } finally {
    fs.writeFileSync(dockPath, original);
    assert.equal(
      fs.readFileSync(dockPath, 'utf8'),
      original,
      'file must be restored identically'
    );
  }
});

test('SPEC-113-02: Real-file defect injection — raw tooltip string in MediaControlBar.tsx fails scan', () => {
  const barPath = path.join(rootDir, 'src', 'operator', 'present', 'media-player', 'MediaControlBar.tsx');
  const original = fs.readFileSync(barPath, 'utf8');
  try {
    const defective = original.replace(
      "t('media.controlBar.videoOnlyTooltip')",
      "'Proyeksi video hanya untuk berkas video'"
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(barPath, defective);

    const findings = scanMediaPlayerSuiteLocalization();
    assert.ok(
      findings.some((f) => f.includes('MediaControlBar.tsx contains un-localized raw string')),
      'Expected raw string in MediaControlBar.tsx to trigger finding'
    );
  } finally {
    fs.writeFileSync(barPath, original);
    assert.equal(
      fs.readFileSync(barPath, 'utf8'),
      original,
      'file must be restored identically'
    );
  }
});

export function scanPresenterConsoleLocalization(
  presentDir = path.join(rootDir, 'src', 'operator', 'present')
) {
  const findings = [];
  const operatorSrc = fs.readFileSync(path.join(presentDir, 'PresenterOperator.tsx'), 'utf8');
  const gridSrc = fs.readFileSync(path.join(presentDir, 'SlideGridDialog.tsx'), 'utf8');
  const displayCtrlSrc = fs.readFileSync(path.join(presentDir, 'PresenterDisplayControl.tsx'), 'utf8');

  if (!operatorSrc.includes('useT()')) {
    findings.push('PresenterOperator.tsx must consume useT()');
  }
  if (!gridSrc.includes('useT()')) {
    findings.push('SlideGridDialog.tsx must consume useT()');
  }
  if (!displayCtrlSrc.includes('useT()')) {
    findings.push('PresenterDisplayControl.tsx must consume useT()');
  }

  const forbiddenRaw = [
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: '<span className="font-semibold">Terdapat koreksi panggung:</span>' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'perubahan tersimpan secara lokal' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Projector blanked' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Scripture live' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'End of deck — nothing after this slide.' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Gagal menyimpan koreksi darurat lokal:' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Koreksi panggung diterapkan ke layar (lokal)' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Gagal memuat status server:' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Konflik: Susunan acara di server telah berubah' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Konflik versi: Layanan telah diubah di server' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Koreksi panggung berhasil disimpan ke server' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Koreksi lokal dibuang, kembali ke versi server' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Gagal memproses gambar lokal' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Current slide is not in an announcement section' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: "|| 'Storage error'" },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'data-testid="list-hidden-badge"\n          className="text-[9px] font-bold uppercase tracking-wider px-1 py-0.25 rounded border border-zinc-700 bg-zinc-900/90 text-zinc-300"\n        >\n          Hidden' },
    { src: displayCtrlSrc, file: 'PresenterDisplayControl.tsx', raw: 'Presentation Lock is active. Are you sure you want to close' },
    { src: displayCtrlSrc, file: 'PresenterDisplayControl.tsx', raw: '(1 Screen detected)' },
    { src: gridSrc, file: 'SlideGridDialog.tsx', raw: '<DialogTitle>All slides</DialogTitle>' },
    // SPEC-115: Mobile Remote QR Pairing raw string guards
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: '<DialogTitle>Mobile Remote Pairing</DialogTitle>' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Generating code…' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: '<span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">\n                  Pairing Code\n                </span>' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Code expires in 60 seconds if unclaimed.' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: '<span className="text-muted-foreground font-medium">Status</span>' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Connected · Remote Active' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Awaiting Connection' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Role Reassigned' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: 'Connection Error' },
    { src: operatorSrc, file: 'PresenterOperator.tsx', raw: '<span className="text-xs text-muted-foreground font-medium">\n                Mobile URL\n              </span>' },
  ];

  for (const { src, file, raw } of forbiddenRaw) {
    if (src.includes(raw)) {
      findings.push(`${file} contains un-localized raw string: ${raw}`);
    }
  }

  return findings;
}

test('SPEC-112-03: Presenter console, slide grid, and display control consume useT() without raw strings', () => {
  const findings = scanPresenterConsoleLocalization();
  assert.deepEqual(findings, [], `Expected 0 findings in presenter console, got: ${findings.join(', ')}`);
});

test('SPEC-112-03: Real-file defect injection — raw string in SlideGridDialog.tsx fails scan', () => {
  const gridPath = path.join(rootDir, 'src', 'operator', 'present', 'SlideGridDialog.tsx');
  const original = fs.readFileSync(gridPath, 'utf8');
  try {
    const defective = original.replace(
      "<DialogTitle>{t('grid.title', { count: entries.length })}</DialogTitle>",
      '<DialogTitle>All slides</DialogTitle>'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(gridPath, defective);

    const findings = scanPresenterConsoleLocalization();
    assert.ok(
      findings.some((f) => f.includes('SlideGridDialog.tsx contains un-localized raw string')),
      'Expected raw string in SlideGridDialog.tsx to trigger finding'
    );
  } finally {
    fs.writeFileSync(gridPath, original);
    assert.equal(
      fs.readFileSync(gridPath, 'utf8'),
      original,
      'file must be restored identically'
    );
  }
});

test('SPEC-112-03: Real-file defect injection — raw error toast in PresenterOperator.tsx fails scan', () => {
  const operatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const original = fs.readFileSync(operatorPath, 'utf8');
  try {
    const defective = original.replace(
      "toast.success(t('edit.emergency.appliedToast'));",
      "toast.success('Koreksi panggung diterapkan ke layar (lokal)');"
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(operatorPath, defective);

    const findings = scanPresenterConsoleLocalization();
    assert.ok(
      findings.some((f) => f.includes('PresenterOperator.tsx contains un-localized raw string')),
      'Expected raw string in PresenterOperator.tsx to trigger finding'
    );
  } finally {
    fs.writeFileSync(operatorPath, original);
    assert.equal(
      fs.readFileSync(operatorPath, 'utf8'),
      original,
      'file must be restored identically'
    );
  }
});

test('SPEC-112-03: Real-file defect injection — raw English announcement toast in PresenterOperator.tsx fails scan', () => {
  const operatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const original = fs.readFileSync(operatorPath, 'utf8');
  try {
    const defective = original.replace(
      "toast.error(t('presenter.loop.notInAnnouncementSection'));",
      "toast.error('Current slide is not in an announcement section');"
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(operatorPath, defective);

    const findings = scanPresenterConsoleLocalization();
    assert.ok(
      findings.some((f) => f.includes('Current slide is not in an announcement section')),
      'Expected raw English toast in PresenterOperator.tsx to trigger finding'
    );
  } finally {
    fs.writeFileSync(operatorPath, original);
    assert.equal(
      fs.readFileSync(operatorPath, 'utf8'),
      original,
      'file must be restored identically'
    );
  }
});

export function scanRunSheetAndFormLocalization() {
  const findings = [];
  const runSheetSrc = fs.readFileSync(path.join(rootDir, 'spa', 'src', 'pages', 'RunSheetPage.tsx'), 'utf8');
  const headerSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'Header.tsx'), 'utf8');
  const bgPanelSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'admin', 'BackgroundLibraryPanel.tsx'), 'utf8');
  const formLayoutSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'admin', 'FormLayoutAdminPanel.tsx'), 'utf8');
  const dynamicFormSrc = fs.readFileSync(path.join(rootDir, 'src', 'operator', 'DynamicFormBody.tsx'), 'utf8');
  const badgeSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'offline', 'OfflineReadinessBadge.tsx'), 'utf8');

  const forbiddenRaw = [
    { src: runSheetSrc, file: 'RunSheetPage.tsx', raw: '<h1\n            className="text-2xl sm:text-3xl font-extrabold tracking-tight truncate whitespace-nowrap"\n            title={`Run-Sheet: ${svc.date || svc.id}`}\n          >\n            Run-Sheet: ' },
    { src: runSheetSrc, file: 'RunSheetPage.tsx', raw: '<p className="mt-0.5 text-xs text-muted-foreground">Service ID: {svc.id}</p>' },
    { src: headerSrc, file: 'Header.tsx', raw: 'New Workspace Mockup' },
    { src: headerSrc, file: 'Header.tsx', raw: 'title="Pengaturan server dinonaktifkan saat offline"' },
    { src: bgPanelSrc, file: 'BackgroundLibraryPanel.tsx', raw: '<Label className="text-xs font-semibold text-foreground">Media Category:</Label>' },
    { src: bgPanelSrc, file: 'BackgroundLibraryPanel.tsx', raw: "cat === 'all'\n                      ? 'All Assets'" },
    { src: formLayoutSrc, file: 'FormLayoutAdminPanel.tsx', raw: 'Loading Form Layout Settings...' },
    { src: formLayoutSrc, file: 'FormLayoutAdminPanel.tsx', raw: 'Card Groupings & Layout\n            </Button>' },
    { src: formLayoutSrc, file: 'FormLayoutAdminPanel.tsx', raw: "'Seeding...'" },
    { src: dynamicFormSrc, file: 'DynamicFormBody.tsx', raw: 'Suggestion: {suggestion.slice(0, 30)}' },
    { src: dynamicFormSrc, file: 'DynamicFormBody.tsx', raw: 'placeholder="Use Song-Set Default"' },
    { src: badgeSrc, file: 'OfflineReadinessBadge.tsx', raw: 'Offline scripture failed:' },
  ];

  for (const { src, file, raw } of forbiddenRaw) {
    if (src.includes(raw)) {
      findings.push(`${file} contains un-localized raw string: ${raw}`);
    }
  }

  return findings;
}

test('SPEC-112-04: RunSheet, DynamicForm, Header, and Admin panels avoid hardcoded raw strings', () => {
  const findings = scanRunSheetAndFormLocalization();
  assert.deepEqual(findings, [], `Expected 0 findings in runsheet and forms, got: ${findings.join(', ')}`);
});

test('SPEC-112-04: Codebase conventions guide permanently binds mandatory bilingual i18n convention', () => {
  const guidePath = path.join(rootDir, '.constitution', 'project', 'codebase-conventions-guide.md');
  const content = fs.readFileSync(guidePath, 'utf8');
  assert.ok(
    content.includes('Mandatory Bilingual i18n & UI Chrome Separation (WDI Playbook 07 § 4)'),
    'codebase-conventions-guide.md must contain the ratified i18n section'
  );
  assert.ok(
    content.includes('Pemisahan Kamus i18n Terjaga `[L2-Guard]`'),
    'codebase-conventions-guide.md must bind L2-Guard i18n dictionary separation'
  );
  assert.ok(
    content.includes('Larangan Teks Mentah (Raw String Prohibition) `[L2-Guard]`'),
    'codebase-conventions-guide.md must bind raw string prohibition'
  );
});

test('SPEC-112-04: Real-file defect injection — raw mockup string in Header.tsx fails scan', () => {
  const headerPath = path.join(rootDir, 'src', 'components', 'Header.tsx');
  const original = fs.readFileSync(headerPath, 'utf8');
  try {
    const defective = original.replace(
      "{t('chrome.nav.mockup')}",
      'New Workspace Mockup'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(headerPath, defective);

    const findings = scanRunSheetAndFormLocalization();
    assert.ok(
      findings.some((f) => f.includes('Header.tsx contains un-localized raw string: New Workspace Mockup')),
      'Expected raw mockup string in Header.tsx to trigger finding'
    );
  } finally {
    fs.writeFileSync(headerPath, original);
    assert.equal(
      fs.readFileSync(headerPath, 'utf8'),
      original,
      'file must be restored identically'
    );
  }
});

test('SPEC-112-04: Real-file defect injection — raw toast in OfflineReadinessBadge.tsx fails scan', () => {
  const badgePath = path.join(rootDir, 'src', 'components', 'offline', 'OfflineReadinessBadge.tsx');
  const original = fs.readFileSync(badgePath, 'utf8');
  try {
    const defective = original.replace(
      "toast.error(t('offline.statusScriptureFailed', { refs: failedRefs.join(', ') }));",
      "toast.error(`Offline scripture failed: ${failedRefs.join(', ')}`);"
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(badgePath, defective);

    const findings = scanRunSheetAndFormLocalization();
    assert.ok(
      findings.some((f) => f.includes('OfflineReadinessBadge.tsx contains un-localized raw string: Offline scripture failed:')),
      'Expected raw string in OfflineReadinessBadge.tsx to trigger finding'
    );
  } finally {
    fs.writeFileSync(badgePath, original);
    assert.equal(
      fs.readFileSync(badgePath, 'utf8'),
      original,
      'file must be restored identically'
    );
  }
});

test('SPEC-114-04: Strict Bilingual i18n parity across all SPEC-114 keys', () => {
  const spec114Keys = [
    'media.drawer.deleteFromLocalOnly',
    'media.drawer.deleteFromCloudOnly',
    'media.drawer.deleteBoth',
    'media.controlBar.shuffleLabel',
    'media.controlBar.shuffleOn',
    'media.controlBar.shuffleOff',
    'media.controlBar.repeatLabel',
    'media.controlBar.repeatOff',
    'media.controlBar.repeatAll',
    'media.controlBar.repeatOne',
    'media.controlBar.prevTitle',
    'media.controlBar.nextTitle',
  ];

  for (const key of spec114Keys) {
    const en = resolveString(key, 'en');
    const id = resolveString(key, 'id');
    assert.ok(!en.startsWith('[missing:i18n:'), `Missing English translation for ${key}`);
    assert.ok(!id.startsWith('[missing:i18n:'), `Missing Indonesian translation for ${key}`);
    assert.notEqual(en, id, `Translations must differ between EN and ID for ${key}`);
  }
});

test('SPEC-114-04: Real-file defect injection — missing SPEC-114 key in catalogue-en.ts fails guard', () => {
  const original = fs.readFileSync(catalogueEnPath, 'utf8');
  try {
    const defective = original.replace(
      "'media.controlBar.shuffleOn': 'Shuffle: On',",
      ''
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(catalogueEnPath, defective);

    const findings = scanAllKeysBilingualParity();
    assert.ok(
      findings.some((f) =>
        f.includes('catalogue-en.ts missing translation for key: media.controlBar.shuffleOn')
      ),
      'Expected missing key in catalogue-en.ts to fail guard'
    );
  } finally {
    fs.writeFileSync(catalogueEnPath, original);
    assert.equal(fs.readFileSync(catalogueEnPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-115-01: Strict Bilingual i18n parity across all SPEC-115 keys', () => {
  const spec115Keys = [
    'presenter.remote.qrTitle',
    'presenter.remote.qrHint',
    'presenter.remote.copyLink',
    'presenter.remote.linkCopied',
    'presenter.remote.generatingCode',
    'presenter.remote.pairingCode',
    'presenter.remote.codeExpiry',
    'presenter.remote.statusLabel',
    'presenter.remote.statusConnected',
    'presenter.remote.statusPairing',
    'presenter.remote.statusRoleLost',
    'presenter.remote.statusError',
    'presenter.remote.statusDisconnected',
    'presenter.remote.mobileUrl',
  ];

  for (const key of spec115Keys) {
    const en = resolveString(key, 'en');
    const id = resolveString(key, 'id');
    assert.ok(!en.startsWith('[missing:i18n:'), `Missing English translation for ${key}`);
    assert.ok(!id.startsWith('[missing:i18n:'), `Missing Indonesian translation for ${key}`);
    assert.notEqual(en, id, `Translations must differ between EN and ID for ${key}`);
  }
});

test('SPEC-115-01: Real-file defect injection — missing SPEC-115 key in catalogue-en.ts fails guard', () => {
  const original = fs.readFileSync(catalogueEnPath, 'utf8');
  try {
    const defective = original.replace(
      "'presenter.remote.qrTitle': 'Scan to Control Remotely',",
      ''
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(catalogueEnPath, defective);

    const findings = scanAllKeysBilingualParity();
    assert.ok(
      findings.some((f) =>
        f.includes('catalogue-en.ts missing translation for key: presenter.remote.qrTitle')
      ),
      'Expected missing key in catalogue-en.ts to fail guard'
    );
  } finally {
    fs.writeFileSync(catalogueEnPath, original);
    assert.equal(fs.readFileSync(catalogueEnPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-115-01: Real-file defect injection — raw string in PresenterOperator QR modal fails guard', () => {
  const operatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const original = fs.readFileSync(operatorPath, 'utf8');
  try {
    const defective = original.replace(
      "{t('presenter.remote.generatingCode')}",
      'Generating code…'
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(operatorPath, defective);

    const findings = scanPresenterConsoleLocalization();
    assert.ok(
      findings.some((f) => f.includes('Generating code…')),
      'Expected raw "Generating code…" to trigger finding'
    );
  } finally {
    fs.writeFileSync(operatorPath, original);
    assert.equal(fs.readFileSync(operatorPath, 'utf8'), original, 'file must be restored identically');
  }
});

test('SPEC-116-04: Strict Bilingual i18n parity across all SPEC-116 keys', () => {
  const spec116Keys = [
    'presenter.projectorReopenRequested',
    'presenter.openProjectorNow',
    'presenter.requestReopenProjector',
  ];

  for (const key of spec116Keys) {
    const en = resolveString(key, 'en');
    const id = resolveString(key, 'id');
    assert.ok(!en.startsWith('[missing:i18n:'), `Missing English translation for ${key}`);
    assert.ok(!id.startsWith('[missing:i18n:'), `Missing Indonesian translation for ${key}`);
    assert.notEqual(en, id, `Translations must differ between EN and ID for ${key}`);
  }
});

test('SPEC-116-04: Real-file defect injection — missing SPEC-116 key in catalogue-en.ts fails guard', () => {
  const original = fs.readFileSync(catalogueEnPath, 'utf8');
  try {
    const defective = original.replace(
      "'presenter.openProjectorNow': 'Open Projector Now',",
      ''
    );
    assert.notEqual(defective, original, 'mutation replacement must succeed');
    fs.writeFileSync(catalogueEnPath, defective);

    const findings = scanAllKeysBilingualParity();
    assert.ok(
      findings.some((f) =>
        f.includes('catalogue-en.ts missing translation for key: presenter.openProjectorNow')
      ),
      'Expected missing key in catalogue-en.ts to fail guard'
    );
  } finally {
    fs.writeFileSync(catalogueEnPath, original);
    assert.equal(fs.readFileSync(catalogueEnPath, 'utf8'), original, 'file must be restored identically');
  }
});

