/**
 * SPEC-89: Native Desktop WebView2 Window, Subsystem Flags, and Seed Staging Contract Tests
 *
 * Enforces:
 * 1. Desktop compilation uses `-H=windowsgui` to suppress console window on Windows.
 * 2. Staging pipeline stages default seed files (default-song-set-layouts.json, default-registry.json, asset-map.json).
 * 3. Inno Setup packaging includes {app}\data\* and `--desktop` execution parameter.
 * 4. Cmd API initializes desktop logging, executable root resolution, and native window lifecycle.
 * 5. Real-file defect injection proofs for absence guards.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanDesktopBuildContract(buildScriptContent) {
  const findings = [];
  if (!buildScriptContent.includes('-H=windowsgui')) {
    findings.push('build-desktop.mjs must compile Go binary with -H=windowsgui to suppress console window');
  }
  for (const seed of ['default-song-set-layouts.json', 'default-registry.json', 'asset-map.json']) {
    if (!buildScriptContent.includes(seed)) {
      findings.push(`build-desktop.mjs must stage ${seed}`);
    }
  }
  return findings;
}

export function scanDesktopApiContract(apiMainContent) {
  const findings = [];
  if (!apiMainContent.includes('desktop.RunDesktopWindow')) {
    findings.push('main.go must invoke desktop.RunDesktopWindow in desktop mode');
  }
  if (!apiMainContent.includes('desktop.FocusExistingWindow')) {
    findings.push('main.go must invoke desktop.FocusExistingWindow on secondary instance launch');
  }
  if (!apiMainContent.includes('desktop.log')) {
    findings.push('main.go must initialize desktop.log multi-writer in desktop mode');
  }
  if (!apiMainContent.includes('os.Executable()')) {
    findings.push('main.go must resolve root relative to os.Executable() in desktop mode');
  }
  return findings;
}

test('SPEC-89-02: scripts/build-desktop.mjs enforces -H=windowsgui and default seed staging', () => {
  const scriptPath = path.join(root, 'scripts', 'build-desktop.mjs');
  const content = fs.readFileSync(scriptPath, 'utf8');
  const findings = scanDesktopBuildContract(content);
  assert.deepEqual(findings, [], `Build desktop contract findings:\n${findings.join('\n')}`);
});

test('SPEC-89-02: cmd/api/main.go satisfies desktop window lifecycle, logging, and root resolution', () => {
  const mainPath = path.join(root, 'cmd', 'api', 'main.go');
  const content = fs.readFileSync(mainPath, 'utf8');
  const findings = scanDesktopApiContract(content);
  assert.deepEqual(findings, [], `API main contract findings:\n${findings.join('\n')}`);
});

test('SPEC-89-02: installer/worship-deck.iss packages data directory and passes --desktop', () => {
  const issPath = path.join(root, 'installer', 'worship-deck.iss');
  const content = fs.readFileSync(issPath, 'utf8');
  assert.ok(
    content.includes('Source: "..\\dist-desktop\\data\\*"; DestDir: "{app}\\data"'),
    'Inno Setup must package data directory recursively into {app}\\data'
  );
  assert.ok(
    content.includes('Parameters: "--desktop"'),
    'Inno Setup shortcuts and run section must supply --desktop parameter'
  );
});

test('SPEC-89-02: Absence Guard 1 — Absence of bare console flags without -H=windowsgui in desktop packaging', () => {
  const scriptPath = path.join(root, 'scripts', 'build-desktop.mjs');
  const content = fs.readFileSync(scriptPath, 'utf8');
  assert.doesNotMatch(
    content,
    /ldflags=-s\s+-w["'](?!\s+-H=windowsgui)/,
    'build-desktop.mjs must not specify bare -ldflags=-s -w without -H=windowsgui'
  );
});

test('SPEC-89-02: Defect Injection Proof 1 — Removing -H=windowsgui triggers contract finding', () => {
  const scriptPath = path.join(root, 'scripts', 'build-desktop.mjs');
  const original = fs.readFileSync(scriptPath, 'utf8');
  const mutated = original.replace('-H=windowsgui', '');
  assert.notEqual(mutated, original);
  const findings = scanDesktopBuildContract(mutated);
  assert.ok(
    findings.some((f) => f.includes('-H=windowsgui')),
    'Removing -H=windowsgui must be caught by scanDesktopBuildContract'
  );
});

test('SPEC-89-02: Defect Injection Proof 2 — Omitting default-song-set-layouts.json triggers contract finding', () => {
  const scriptPath = path.join(root, 'scripts', 'build-desktop.mjs');
  const original = fs.readFileSync(scriptPath, 'utf8');
  const mutated = original.replace("'default-song-set-layouts.json',", '');
  assert.notEqual(mutated, original);
  const findings = scanDesktopBuildContract(mutated);
  assert.ok(
    findings.some((f) => f.includes('default-song-set-layouts.json')),
    'Omitting default-song-set-layouts.json must be caught by scanDesktopBuildContract'
  );
});

test('SPEC-89-03: Defect Injection Proof 3 — Removing desktop.RunDesktopWindow from main.go triggers contract finding', () => {
  const mainPath = path.join(root, 'cmd', 'api', 'main.go');
  const original = fs.readFileSync(mainPath, 'utf8');
  const mutated = original.replace('desktop.RunDesktopWindow', 'desktop.OpenBrowser');
  assert.notEqual(mutated, original);
  const findings = scanDesktopApiContract(mutated);
  assert.ok(
    findings.some((f) => f.includes('desktop.RunDesktopWindow')),
    'Bypassing desktop.RunDesktopWindow must be caught by scanDesktopApiContract'
  );
});
