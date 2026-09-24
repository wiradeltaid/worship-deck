/**
 * SPEC-73: Desktop Mode and WorshipDeck Data Folder Absence Guard (WSD-H-02)
 *
 * Enforces:
 * 1. Zero occurrences of WorshipPresenter or worship-presenter in cmd/, internal/, scripts/, and installer/
 *    (strictly preserving only the single documented legacy AppMutex entry in installer/worship-deck.iss).
 * 2. installer/worship-deck.iss configures Start menu, desktop icon, and post-install Run to pass --desktop.
 * 3. Real-file defect injection proofs for absence guards and all three installer launch points.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const SCAN_DIRS = [
  path.join(root, 'cmd'),
  path.join(root, 'internal'),
  path.join(root, 'scripts'),
  path.join(root, 'installer'),
];

function listFilesRecursively(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFilesRecursively(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

export function scanLegacyPresenterNames() {
  const violations = [];
  const files = SCAN_DIRS.flatMap((d) => listFilesRecursively(d));

  const legacyPattern = /worshippresenter|worship-presenter/i;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const rel = path.relative(root, file).split(path.sep).join('/');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (legacyPattern.test(line)) {
        // Only permissible exception is the documented AppMutex line in installer/worship-deck.iss
        const isPermittedLegacyMutex =
          rel === 'installer/worship-deck.iss' &&
          line.includes('AppMutex=') &&
          line.includes('Local\\WorshipPresenter.SingleInstance');

        if (!isPermittedLegacyMutex) {
          violations.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      }
    }
  }

  return violations;
}

export function scanInstallerDesktopParams() {
  const issPath = path.join(root, 'installer', 'worship-deck.iss');
  const content = fs.readFileSync(issPath, 'utf8');
  const findings = [];
  const lines = content.split('\n');

  // 1. Group Icon must have Parameters: "--desktop"
  const groupLines = lines.filter((l) => l.includes('Name: "{group}\\{#MyAppName}"'));
  if (groupLines.length === 0 || groupLines.some((l) => !l.includes('Parameters: "--desktop"'))) {
    findings.push('Start menu shortcut in [Icons] must pass Parameters: "--desktop"');
  }

  // 2. Desktop icon must have Parameters: "--desktop"
  const desktopLines = lines.filter((l) => l.includes('Name: "{autodesktop}\\{#MyAppName}"'));
  if (desktopLines.length === 0 || desktopLines.some((l) => !l.includes('Parameters: "--desktop"'))) {
    findings.push('Desktop icon in [Icons] must pass Parameters: "--desktop"');
  }

  // 3. Post-install run must have Parameters: "--desktop" and WorkingDir: "{app}"
  const runLines = lines.filter((l) => l.includes('Filename: "{app}\\{#MyAppExeName}"') && l.includes('postinstall'));
  if (runLines.length === 0 || runLines.some((l) => !l.includes('Parameters: "--desktop"'))) {
    findings.push('[Run] entry must pass Parameters: "--desktop"');
  }
  if (runLines.length === 0 || runLines.some((l) => !l.includes('WorkingDir: "{app}"'))) {
    findings.push('[Run] entry must set WorkingDir: "{app}"');
  }

  return findings;
}

test('WSD-H-02: zero occurrences of WorshipPresenter across cmd/, internal/, scripts/, and installer/', () => {
  const violations = scanLegacyPresenterNames();
  assert.deepEqual(violations, [], `Legacy WorshipPresenter occurrences found:\n${violations.join('\n')}`);
});

test('WSD-H-02: installer passes --desktop to all shortcuts and launch commands', () => {
  const findings = scanInstallerDesktopParams();
  assert.deepEqual(findings, [], `Installer desktop parameter findings:\n${findings.join('\n')}`);
});

test('WSD-H-02: guard proof — injected WorshipPresenter in cmd/api/main.go is caught', () => {
  const target = path.join(root, 'cmd', 'api', 'main.go');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, original + '\n// Injected: WorshipPresenter legacy\n');
    const violations = scanLegacyPresenterNames();
    assert.ok(
      violations.some((v) => v.includes('cmd/api/main.go') && v.includes('WorshipPresenter')),
      'Injected WorshipPresenter in cmd/api/main.go must be detected'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-02: guard proof — injected legacy path in internal/desktop/datadir.go is caught', () => {
  const target = path.join(root, 'internal', 'desktop', 'datadir.go');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, original + '\n// Injected: worship-presenter path\n');
    const violations = scanLegacyPresenterNames();
    assert.ok(
      violations.some((v) => v.includes('internal/desktop/datadir.go') && v.includes('worship-presenter')),
      'Injected worship-presenter in internal/desktop/datadir.go must be detected'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-02: guard proof — injected non-mutex legacy name in installer/worship-deck.iss is caught', () => {
  const target = path.join(root, 'installer', 'worship-deck.iss');
  const original = fs.readFileSync(target, 'utf8');
  try {
    fs.writeFileSync(target, original + '\n; Injected: WorshipPresenter banner\n');
    const violations = scanLegacyPresenterNames();
    assert.ok(
      violations.some((v) => v.includes('installer/worship-deck.iss') && v.includes('WorshipPresenter')),
      'Injected WorshipPresenter in installer/worship-deck.iss must be detected'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-02: guard proof — missing --desktop in Start menu shortcut is caught', () => {
  const target = path.join(root, 'installer', 'worship-deck.iss');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace(
      'Name: "{group}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"; Parameters: "--desktop";',
      'Name: "{group}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}";'
    );
    assert.notEqual(mutated, original);
    fs.writeFileSync(target, mutated);
    const findings = scanInstallerDesktopParams();
    assert.ok(
      findings.some((f) => f.includes('Start menu shortcut in [Icons] must pass Parameters: "--desktop"')),
      'Missing --desktop in Start menu shortcut must be caught'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-02: guard proof — missing --desktop in Desktop icon is caught', () => {
  const target = path.join(root, 'installer', 'worship-deck.iss');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace(
      'Name: "{autodesktop}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}"; Parameters: "--desktop";',
      'Name: "{autodesktop}\\{#MyAppName}"; Filename: "{app}\\{#MyAppExeName}";'
    );
    assert.notEqual(mutated, original);
    fs.writeFileSync(target, mutated);
    const findings = scanInstallerDesktopParams();
    assert.ok(
      findings.some((f) => f.includes('Desktop icon in [Icons] must pass Parameters: "--desktop"')),
      'Missing --desktop in Desktop icon must be caught'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});

test('WSD-H-02: guard proof — missing --desktop in [Run] post-install launch is caught', () => {
  const target = path.join(root, 'installer', 'worship-deck.iss');
  const original = fs.readFileSync(target, 'utf8');
  try {
    const mutated = original.replace(
      'Filename: "{app}\\{#MyAppExeName}"; Parameters: "--desktop"; WorkingDir: "{app}";',
      'Filename: "{app}\\{#MyAppExeName}"; WorkingDir: "{app}";'
    );
    assert.notEqual(mutated, original);
    fs.writeFileSync(target, mutated);
    const findings = scanInstallerDesktopParams();
    assert.ok(
      findings.some((f) => f.includes('[Run] entry must pass Parameters: "--desktop"')),
      'Missing --desktop in [Run] entry must be caught'
    );
  } finally {
    fs.writeFileSync(target, original);
  }
});
