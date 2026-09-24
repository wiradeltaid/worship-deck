/**
 * SPEC-73: Release artifact naming and single checksum file guard (WSD-H-01)
 *
 * Enforces:
 * 1. Windows installer outputs WorshipDeck-<version>-x64-setup.exe (never unversioned WorshipDeckSetup.exe)
 * 2. Checksum file is named SHA256SUMS (never SHA256SUMS.txt)
 * 3. Zero occurrences of WorshipDeckSetup or SHA256SUMS.txt across release, installer, workflow, and script files.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function checkReleaseArtifactNames(dir = root) {
  const filesToCheck = [
    'installer/worship-deck.iss',
    '.github/workflows/release.yml',
    'scripts/build-desktop.mjs',
    'SECURITY.md',
    'package.json',
  ];

  const prohibitedPatterns = [
    { pattern: /\bWorshipDeckSetup\b/, name: 'WorshipDeckSetup' },
    { pattern: /\bSHA256SUMS\.txt\b/, name: 'SHA256SUMS.txt' },
  ];

  const violations = [];
  for (const relPath of filesToCheck) {
    const fullPath = path.join(dir, relPath);
    if (!fs.existsSync(fullPath)) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    for (const { pattern, name } of prohibitedPatterns) {
      if (pattern.test(content)) {
        violations.push(`${relPath} contains prohibited legacy name: ${name}`);
      }
    }
  }
  return violations;
}

test('WSD-H-01: release artifact names absence guard passes cleanly', () => {
  const violations = checkReleaseArtifactNames(root);
  assert.deepEqual(violations, [], `Expected zero legacy artifact naming occurrences, got: ${violations.join(', ')}`);
});

test('WSD-H-01: guard proof — injected WorshipDeckSetup in real installer/worship-deck.iss is detected', () => {
  const targetFile = path.join(root, 'installer', 'worship-deck.iss');
  const original = fs.readFileSync(targetFile, 'utf8');
  try {
    fs.writeFileSync(targetFile, original + '\nOutputBaseFilename=WorshipDeckSetup\n');
    const violations = checkReleaseArtifactNames(root);
    assert.ok(
      violations.some((v) => v.includes('installer/worship-deck.iss contains prohibited legacy name: WorshipDeckSetup')),
      'Injected WorshipDeckSetup in real installer script must be caught'
    );
  } finally {
    fs.writeFileSync(targetFile, original);
  }
});

test('WSD-H-01: guard proof — injected SHA256SUMS.txt in real .github/workflows/release.yml is detected', () => {
  const targetFile = path.join(root, '.github', 'workflows', 'release.yml');
  const original = fs.readFileSync(targetFile, 'utf8');
  try {
    fs.writeFileSync(targetFile, original + '\n# Injected defect: dist-installer/SHA256SUMS.txt\n');
    const violations = checkReleaseArtifactNames(root);
    assert.ok(
      violations.some((v) => v.includes('.github/workflows/release.yml contains prohibited legacy name: SHA256SUMS.txt')),
      'Injected SHA256SUMS.txt in real release workflow must be caught'
    );
  } finally {
    fs.writeFileSync(targetFile, original);
  }
});

test('WSD-H-01: installer and release files enforce WorshipDeck-{#MyAppVersion}-x64-setup and SHA256SUMS', () => {
  const iss = fs.readFileSync(path.join(root, 'installer', 'worship-deck.iss'), 'utf8');
  assert.match(iss, /OutputBaseFilename=WorshipDeck-\{#MyAppVersion\}-x64-setup/);

  const releaseYml = fs.readFileSync(path.join(root, '.github', 'workflows', 'release.yml'), 'utf8');
  assert.match(releaseYml, /WorshipDeck-\$\(\$env:VERSION\)-x64-setup\.exe/);
  assert.match(releaseYml, /dist-installer\\SHA256SUMS/);
  assert.ok(!releaseYml.includes('SHA256SUMS.txt'));
});
