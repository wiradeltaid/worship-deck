/**
 * Tests for SPEC-64: Windows installer version sync from package.json
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const buildDesktopUrl = pathToFileURL(path.join(root, 'scripts', 'build-desktop.mjs')).href;
const { resolvePackageVersion } = await import(buildDesktopUrl);

const issPath = path.join(root, 'installer', 'worship-deck.iss');
const issSource = fs.readFileSync(issPath, 'utf8');

const buildScriptPath = path.join(root, 'scripts', 'build-desktop.mjs');
const buildSource = fs.readFileSync(buildScriptPath, 'utf8');

const releaseYmlPath = path.join(root, '.github', 'workflows', 'release.yml');
const releaseYmlSource = fs.readFileSync(releaseYmlPath, 'utf8');

test('SPEC-64: resolvePackageVersion extracts and validates semver from package.json', () => {
  const version = resolvePackageVersion(root);
  assert.match(version, /^\d+\.\d+\.\d+/, 'version must be standard semver format');

  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(version, pkg.version);
});

test('SPEC-64: worship-deck.iss enforces MyAppVersion via /D with fail-closed #error', () => {
  // 1. Must NOT contain unconditional hardcoded #define MyAppVersion literal
  assert.equal(
    /^#define\s+MyAppVersion\s+["'].*?["']/m.test(issSource),
    false,
    'worship-deck.iss must NOT declare an unconditional #define MyAppVersion literal'
  );

  // 2. Must contain #ifndef MyAppVersion with #error
  assert.ok(
    /#ifndef\s+MyAppVersion[\s\S]*?#error[\s\S]*?#endif/.test(issSource),
    'worship-deck.iss must contain #ifndef MyAppVersion with #error'
  );

  // 3. Must use {#MyAppVersion} in [Setup] AppVersion
  assert.ok(
    /AppVersion=\{#MyAppVersion\}/.test(issSource),
    'worship-deck.iss must use AppVersion={#MyAppVersion}'
  );
});

test('SPEC-64: build-desktop.mjs passes /DMyAppVersion=<version> to ISCC.exe', () => {
  assert.ok(
    buildSource.includes("'/DMyAppVersion=' + appVersion"),
    'build-desktop.mjs must pass /DMyAppVersion= flag to ISCC.exe'
  );
  assert.ok(
    !buildSource.includes('WorshipPresenterSetup.exe'),
    'build-desktop.mjs dead fallback for pre-rename WorshipPresenterSetup.exe should be removed'
  );
});

test('SPEC-64: release.yml verifies compiled installer FileVersion against tag/version', () => {
  assert.ok(
    releaseYmlSource.includes('Verify compiled installer file version'),
    'release.yml must include installer version verification step'
  );
  assert.ok(
    releaseYmlSource.includes('VersionInfo.FileVersion'),
    'release.yml must inspect VersionInfo.FileVersion of installer'
  );
});

test('SPEC-73: installer naming follows WorshipDeck-{#MyAppVersion}-x64-setup and SHA256SUMS', () => {
  assert.match(
    issSource,
    /OutputBaseFilename=WorshipDeck-\{#MyAppVersion\}-x64-setup/,
    'worship-deck.iss must output WorshipDeck-{#MyAppVersion}-x64-setup'
  );
  assert.ok(
    buildSource.includes('WorshipDeck-${appVersion}-x64-setup.exe'),
    'build-desktop.mjs must look for WorshipDeck-${appVersion}-x64-setup.exe'
  );
  assert.ok(
    releaseYmlSource.includes('WorshipDeck-$($env:VERSION)-x64-setup.exe'),
    'release.yml must use WorshipDeck-$($env:VERSION)-x64-setup.exe'
  );
  assert.ok(
    releaseYmlSource.includes('dist-installer\\SHA256SUMS'),
    'release.yml must output to dist-installer\\SHA256SUMS'
  );
  assert.ok(
    !releaseYmlSource.includes('SHA256SUMS.txt'),
    'release.yml must strictly avoid SHA256SUMS.txt'
  );
});

test('SPEC-64: Absence guard & defect injection proofs for version resolver', () => {
  const tempDir = fs.mkdtempSync(path.join(path.resolve(root, '..'), 'test-pkg-version-'));
  try {
    // Defect 1: Invalid semver
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ version: 'invalid-version' }));
    assert.throws(
      () => resolvePackageVersion(tempDir),
      /Invalid or missing semver version/
    );

    // Defect 2: Missing version field
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({ name: 'test' }));
    assert.throws(
      () => resolvePackageVersion(tempDir),
      /Invalid or missing semver version/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
