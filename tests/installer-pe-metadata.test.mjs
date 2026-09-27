/**
 * SPEC-90-01: Windows PE VersionInfo Metadata Staging & Inno Setup Directives Test Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { generateVersionInfoRc, resolvePackageVersion } from '../scripts/build-desktop.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

export function verifyInnoSetupDirectives(issContent) {
  const requiredDirectives = [
    'VersionInfoVersion={#MyAppVersion}',
    'VersionInfoCompany={#MyAppPublisher}',
    'VersionInfoDescription={#MyAppName} Setup',
    'VersionInfoCopyright=Copyright (c) 2026 {#MyAppPublisher}',
    'VersionInfoProductName={#MyAppName}',
    'VersionInfoProductVersion={#MyAppVersion}',
    'VersionInfoOriginalFileName=WorshipDeck-{#MyAppVersion}-x64-setup.exe',
    'AppCopyright=Copyright (c) 2026 {#MyAppPublisher}',
    'UninstallDisplayName={#MyAppName}',
    'UninstallDisplayIcon={app}\\worship-deck.ico',
    'Source: "..\\dist-desktop\\PRIVACY.md"; DestDir: "{app}"; Flags: ignoreversion',
    'Type: files; Name: "{app}\\PRIVACY.md"',
  ];

  for (const directive of requiredDirectives) {
    if (!issContent.includes(directive)) {
      throw new Error(`Missing required Inno Setup directive: "${directive}"`);
    }
  }

  // Publisher name must not contain "PT" prefix
  const publisherMatch = issContent.match(/#define\s+MyAppPublisher\s+"([^"]+)"/);
  if (!publisherMatch) {
    throw new Error('Missing #define MyAppPublisher in installer/worship-deck.iss');
  }
  const publisher = publisherMatch[1];
  if (publisher !== 'Wira Delta Indonesia') {
    throw new Error(`Expected MyAppPublisher to be "Wira Delta Indonesia", got "${publisher}"`);
  }
  if (/\bPT\b/i.test(publisher)) {
    throw new Error(`Publisher name must not contain "PT" prefix per legal guidelines: "${publisher}"`);
  }
}

test('SPEC-90-01: installer/worship-deck.iss contains all required VersionInfo directives', () => {
  const issPath = path.join(repoRoot, 'installer', 'worship-deck.iss');
  assert.ok(fs.existsSync(issPath), 'installer/worship-deck.iss must exist');
  const content = fs.readFileSync(issPath, 'utf8');

  verifyInnoSetupDirectives(content);
});

test('SPEC-90-01 guard proof: verifyInnoSetupDirectives detects missing or invalid metadata', () => {
  const validContent = fs.readFileSync(path.join(repoRoot, 'installer', 'worship-deck.iss'), 'utf8');

  // Defect 1: Missing VersionInfoCompany
  const missingCompany = validContent.replace('VersionInfoCompany={#MyAppPublisher}', '');
  assert.throws(
    () => verifyInnoSetupDirectives(missingCompany),
    /Missing required Inno Setup directive: "VersionInfoCompany={#MyAppPublisher}"/
  );

  // Defect 2: Publisher has PT prefix
  const ptPublisher = validContent.replace('#define MyAppPublisher "Wira Delta Indonesia"', '#define MyAppPublisher "PT Wira Delta Indonesia"');
  assert.throws(
    () => verifyInnoSetupDirectives(ptPublisher),
    /Expected MyAppPublisher to be "Wira Delta Indonesia"/
  );
});

test('SPEC-90-01: generateVersionInfoRc produces compliant Windows PE resource script', () => {
  const version = resolvePackageVersion(repoRoot);
  const rc = generateVersionInfoRc(version);

  assert.ok(rc.includes('1 ICON "../../installer/worship-deck.ico"'), 'Must embed shell icon resource');
  assert.ok(rc.includes('1 VERSIONINFO'), 'Must declare VERSIONINFO resource block');
  assert.ok(rc.includes(`VALUE "CompanyName", "Wira Delta Indonesia"`), 'Must declare CompanyName');
  assert.ok(rc.includes(`VALUE "FileDescription", "WorshipDeck"`), 'Must declare FileDescription');
  assert.ok(rc.includes(`VALUE "FileVersion", "${version}"`), 'Must declare FileVersion matching package.json');
  assert.ok(rc.includes(`VALUE "ProductVersion", "${version}"`), 'Must declare ProductVersion matching package.json');
  assert.ok(rc.includes(`VALUE "ProductName", "WorshipDeck"`), 'Must declare ProductName');
  assert.ok(rc.includes(`VALUE "LegalCopyright", "Copyright (c) 2026 Wira Delta Indonesia"`), 'Must declare LegalCopyright');
  assert.ok(rc.includes(`VALUE "OriginalFilename", "worship-deck.exe"`), 'Must declare OriginalFilename');

  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  const numericVersion = `${match[1]},${match[2]},${match[3]},0`;
  assert.ok(rc.includes(`FILEVERSION ${numericVersion}`), `Must declare numeric FILEVERSION ${numericVersion}`);
  assert.ok(rc.includes(`PRODUCTVERSION ${numericVersion}`), `Must declare numeric PRODUCTVERSION ${numericVersion}`);
});

test('SPEC-90-01 guard proof: generateVersionInfoRc rejects invalid semver version', () => {
  assert.throws(() => generateVersionInfoRc('invalid'), /Invalid semver version format/);
  assert.throws(() => generateVersionInfoRc(''), /Invalid semver version format/);
});

test('SPEC-90-01: Windows PE binary worship-deck.exe metadata verification', (t) => {
  if (process.platform !== 'win32') {
    t.skip('Windows PE VersionInfo inspection is only supported on Windows');
    return;
  }

  const exePath = path.join(repoRoot, 'dist-desktop', 'worship-deck.exe');
  if (!fs.existsSync(exePath)) {
    t.skip('dist-desktop/worship-deck.exe not yet built; skipping artifact inspection');
    return;
  }

  const psScript = `(Get-Item -LiteralPath '${exePath.replace(/'/g, "''")}').VersionInfo | Select-Object CompanyName, FileDescription, FileVersion, ProductVersion, LegalCopyright, ProductName | ConvertTo-Json`;
  const res = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
    encoding: 'utf8',
    shell: false,
  });

  assert.equal(res.status, 0, `PowerShell VersionInfo inspection failed: ${res.stderr}`);
  const info = JSON.parse(res.stdout);
  const expectedVersion = resolvePackageVersion(repoRoot);

  assert.equal(info.CompanyName, 'Wira Delta Indonesia', 'CompanyName must match');
  assert.equal(info.FileDescription, 'WorshipDeck', 'FileDescription must match');
  assert.equal(info.FileVersion, expectedVersion, 'FileVersion must match package.json');
  assert.equal(info.ProductVersion, expectedVersion, 'ProductVersion must match package.json');
  assert.equal(info.LegalCopyright, 'Copyright (c) 2026 Wira Delta Indonesia', 'LegalCopyright must match');
  assert.equal(info.ProductName, 'WorshipDeck', 'ProductName must match');
});
