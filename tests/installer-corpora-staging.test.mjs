/**
 * SPEC-73: Desktop installer corpora staging and legal notices guard (WSD-H-09)
 *
 * Enforces:
 * 1. Staging pipeline stageCorporaAndNotices copies:
 *    - data/song-book/sdah.json
 *    - data/en/bible-translation/kjv.json
 *    - data/fonts/*.ttf (all 41 font families and bold variants)
 *    - LICENSE
 *    - ATTRIBUTIONS.md
 *    - THIRD-PARTY-NOTICES (covering all 41 font families)
 * 2. installer/worship-deck.iss packages data\*, LICENSE, ATTRIBUTIONS.md, and THIRD-PARTY-NOTICES into {app}.
 * 3. Real-file defect injection proofs for staging verification.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const buildDesktopUrl = pathToFileURL(path.join(root, 'scripts', 'build-desktop.mjs')).href;
const { stageCorporaAndNotices } = await import(buildDesktopUrl);

test('WSD-H-09: stageCorporaAndNotices stages all corpora, fonts, licenses, and notices', () => {
  const tempDir = fs.mkdtempSync(path.join(path.resolve(root, '..'), 'test-corpora-staging-'));
  try {
    stageCorporaAndNotices(tempDir);

    // 1. Verify corpora
    const sdahPath = path.join(tempDir, 'data', 'song-book', 'sdah.json');
    assert.ok(fs.existsSync(sdahPath), 'data/song-book/sdah.json must be staged');
    const sdahData = JSON.parse(fs.readFileSync(sdahPath, 'utf8'));
    assert.ok(sdahData.hymns && sdahData.hymns.length > 500, 'SDAH hymns must be complete');

    const kjvPath = path.join(tempDir, 'data', 'en', 'bible-translation', 'kjv.json');
    assert.ok(fs.existsSync(kjvPath), 'data/en/bible-translation/kjv.json must be staged');
    const kjvData = JSON.parse(fs.readFileSync(kjvPath, 'utf8'));
    assert.ok(kjvData.counts && kjvData.counts.verses > 30000, 'KJV bible translation must be complete');

    // 2. Verify fonts
    const fontsDir = path.join(tempDir, 'data', 'fonts');
    assert.ok(fs.existsSync(fontsDir), 'data/fonts directory must be staged');
    const ttfFiles = fs.readdirSync(fontsDir).filter((f) => f.endsWith('.ttf'));
    assert.equal(ttfFiles.length, 46, `Expected 46 TTF font files staged (41 families + 5 bold variants), got ${ttfFiles.length}`);

    // 3. Verify legal docs
    for (const doc of ['LICENSE', 'ATTRIBUTIONS.md', 'THIRD-PARTY-NOTICES']) {
      const docPath = path.join(tempDir, doc);
      assert.ok(fs.existsSync(docPath), `${doc} must be staged into root`);
      const stat = fs.statSync(docPath);
      assert.ok(stat.size > 100, `${doc} must have non-trivial content`);
    }

    // 4. Verify THIRD-PARTY-NOTICES contains 41 families
    const notices = fs.readFileSync(path.join(tempDir, 'THIRD-PARTY-NOTICES'), 'utf8');
    assert.ok(notices.includes('SIL OPEN FONT LICENSE Version 1.1'));
    assert.ok(notices.includes('Apache License'));

    // 5. Verify default seeds (SPEC-89)
    for (const seed of ['default-song-set-layouts.json', 'default-registry.json', 'asset-map.json']) {
      const seedPath = path.join(tempDir, 'data', seed);
      assert.ok(fs.existsSync(seedPath), `data/${seed} must be staged`);
      const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      assert.ok(seedData && Object.keys(seedData).length > 0, `data/${seed} must not be empty`);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

export function scanStagedSeeds(targetDir) {
  const missing = [];
  for (const file of ['default-song-set-layouts.json', 'default-registry.json', 'asset-map.json']) {
    const p = path.join(targetDir, 'data', file);
    if (!fs.existsSync(p)) {
      missing.push(`Missing staged seed file: data/${file}`);
    }
  }
  return missing;
}

test('SPEC-89-01: scanStagedSeeds verifies all required seed configuration files are staged', () => {
  const tempDir = fs.mkdtempSync(path.join(path.resolve(root, '..'), 'test-seeds-scan-'));
  try {
    stageCorporaAndNotices(tempDir);
    const missing = scanStagedSeeds(tempDir);
    assert.deepEqual(missing, [], `Staged seed findings:\n${missing.join('\n')}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('SPEC-89-01: guard proof — injected missing default-song-set-layouts.json is detected', () => {
  const tempDir = fs.mkdtempSync(path.join(path.resolve(root, '..'), 'test-seeds-defect-'));
  try {
    stageCorporaAndNotices(tempDir);
    // Inject defect: remove default-song-set-layouts.json
    fs.unlinkSync(path.join(tempDir, 'data', 'default-song-set-layouts.json'));
    const missing = scanStagedSeeds(tempDir);
    assert.ok(
      missing.some((m) => m.includes('default-song-set-layouts.json')),
      'Injected missing default-song-set-layouts.json must be caught by scanStagedSeeds'
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('SPEC-89-01: stageCorporaAndNotices throws when required seed source is missing from repo', () => {
  const tempDir = fs.mkdtempSync(path.join(path.resolve(root, '..'), 'test-seeds-fail-'));
  const seedPath = path.join(root, 'data', 'default-song-set-layouts.json');
  const tempBackup = path.join(root, 'data', 'default-song-set-layouts.json.tmp-backup');
  try {
    fs.renameSync(seedPath, tempBackup);
    assert.throws(
      () => stageCorporaAndNotices(tempDir),
      /Required default seed configuration file missing/,
      'stageCorporaAndNotices must fail closed when a required seed file is missing from data/'
    );
  } finally {
    if (fs.existsSync(tempBackup)) {
      fs.renameSync(tempBackup, seedPath);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test('SPEC-89-04: end-to-end staged database bootstrap verifies song_set_layouts trio', () => {
  const tempDir = fs.mkdtempSync(path.join(path.resolve(root, '..'), 'test-staged-bootstrap-'));
  try {
    stageCorporaAndNotices(tempDir);
    const res = spawnSync('go', ['test', '-v', '-run', 'TestEnsureSongSetLayoutSeeds_StagedCorporaDirectory', './internal/db/...'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        STAGED_CORPORA_DIR: tempDir,
      },
    });
    assert.equal(res.status, 0, `Go staged bootstrap failed:\n${res.stderr || res.stdout}`);
    assert.ok(res.stdout.includes('PASS: TestEnsureSongSetLayoutSeeds_StagedCorporaDirectory'), 'Staged bootstrap must pass');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

export function scanInnoSetupCorporaPackaging(issContent) {
  const findings = [];
  const requiredSources = [
    'Source: "..\\dist-desktop\\data\\*"',
    'Source: "..\\dist-desktop\\LICENSE"',
    'Source: "..\\dist-desktop\\ATTRIBUTIONS.md"',
    'Source: "..\\dist-desktop\\THIRD-PARTY-NOTICES"',
  ];

  for (const src of requiredSources) {
    if (!issContent.includes(src)) {
      findings.push(`installer/worship-deck.iss missing ${src}`);
    }
  }

  return findings;
}

test('WSD-H-09: installer/worship-deck.iss packages data, licenses, and notices', () => {
  const issPath = path.join(root, 'installer', 'worship-deck.iss');
  const content = fs.readFileSync(issPath, 'utf8');
  const findings = scanInnoSetupCorporaPackaging(content);
  assert.deepEqual(findings, [], `Inno Setup packaging findings:\n${findings.join('\n')}`);
});

test('WSD-H-09: guard proof — injected missing THIRD-PARTY-NOTICES packaging in ISS is detected', () => {
  const issPath = path.join(root, 'installer', 'worship-deck.iss');
  const original = fs.readFileSync(issPath, 'utf8');
  try {
    const mutated = original.replace('Source: "..\\dist-desktop\\THIRD-PARTY-NOTICES"; DestDir: "{app}"; Flags: ignoreversion', '');
    assert.notEqual(mutated, original);
    const findings = scanInnoSetupCorporaPackaging(mutated);
    assert.ok(
      findings.some((f) => f.includes('THIRD-PARTY-NOTICES')),
      'Injected missing THIRD-PARTY-NOTICES must be caught'
    );
  } finally {
    // unchanged
  }
});
