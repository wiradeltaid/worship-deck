/**
 * SPEC-90-03: Desktop Packaging, Per-Monitor DPI Awareness, and Bounded Zero-Telemetry Absence Guard
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolvePackageVersion } from '../scripts/build-desktop.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Dynamically constructed strings to avoid self-matching in static scans
export const PROHIBITED_UPDATE_API = '/api/' + 'v1/' + 'update';
export const PROHIBITED_LATEST_JSON = 'latest' + '.json';
export const PROHIBITED_GITHUB_RELEASES = 'api.' + 'github.com/repos/' + 'wiradeltaid/worship-deck/releases';
export const PROHIBITED_TELEMETRY_SDK_PATTERNS = [
  '@sentry/' + 'browser',
  'google-' + 'analytics',
  'mixpanel-' + 'browser',
  'segment-' + 'analytics',
  'datadog-' + 'rum',
];

export function getScanFiles(dir = repoRoot) {
  const targetDirs = ['cmd', 'internal', 'src', 'spa', 'scripts', 'installer'];
  const files = [];

  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const item of fs.readdirSync(current)) {
      if (item === 'node_modules' || item === 'dist' || item === 'dist-desktop') continue;
      const full = path.join(current, item);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else if (/\.(go|ts|tsx|js|mjs|iss)$/.test(item)) {
        files.push(full);
      }
    }
  }

  for (const sub of targetDirs) {
    walk(path.join(dir, sub));
  }
  return files;
}

export function scanZeroTelemetryInvariants(filePaths, prohibitedList = null) {
  const list = prohibitedList || [
    PROHIBITED_UPDATE_API,
    PROHIBITED_LATEST_JSON,
    PROHIBITED_GITHUB_RELEASES,
    ...PROHIBITED_TELEMETRY_SDK_PATTERNS,
  ];

  const violations = [];

  for (const filePath of filePaths) {
    if (filePath.endsWith('desktop-about-contract.test.mjs')) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const pattern of list) {
      if (content.includes(pattern)) {
        violations.push({
          file: path.relative(repoRoot, filePath),
          pattern,
        });
      }
    }
  }

  if (violations.length > 0) {
    const details = violations.map((v) => `${v.file}: contains prohibited telemetry/update token "${v.pattern}"`).join('\n');
    throw new Error(`Zero-telemetry absence guard failed:\n${details}`);
  }
}

test('SPEC-90-03: Desktop packaging artifacts and legal notices integrity', (t) => {
  const distDir = path.join(repoRoot, 'dist-desktop');
  if (!fs.existsSync(distDir)) {
    t.skip('dist-desktop directory does not exist yet; run npm run prepare:desktop first');
    return;
  }

  // Legal files staged in {app}
  for (const notice of ['LICENSE', 'ATTRIBUTIONS.md', 'THIRD-PARTY-NOTICES', 'PRIVACY.md']) {
    const noticePath = path.join(distDir, notice);
    assert.ok(fs.existsSync(noticePath), `Expected staged legal notice file at ${noticePath}`);
    const stat = fs.statSync(noticePath);
    assert.ok(stat.size > 0, `Staged notice ${notice} must not be empty`);
  }

  // worship-deck.exe exists
  const exePath = path.join(distDir, 'worship-deck.exe');
  assert.ok(fs.existsSync(exePath), 'dist-desktop/worship-deck.exe must exist');

  if (process.platform === 'win32') {
    const psScript = `(Get-Item -LiteralPath '${exePath.replace(/'/g, "''")}').VersionInfo | Select-Object CompanyName, FileDescription, FileVersion, ProductVersion, LegalCopyright, ProductName | ConvertTo-Json`;
    const res = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8',
      shell: false,
    });
    assert.equal(res.status, 0, `PowerShell inspection failed: ${res.stderr}`);
    const info = JSON.parse(res.stdout);
    const expectedVersion = resolvePackageVersion(repoRoot);

    assert.equal(info.CompanyName, 'Wira Delta Indonesia', 'PE CompanyName must be "Wira Delta Indonesia"');
    assert.equal(info.FileVersion, expectedVersion, 'PE FileVersion must match package.json');
    assert.equal(info.ProductVersion, expectedVersion, 'PE ProductVersion must match package.json');
  }
});

test('SPEC-90-03: Per-Monitor V2 DPI awareness is declared in internal/desktop/window_windows.go', () => {
  const winSourcePath = path.join(repoRoot, 'internal', 'desktop', 'window_windows.go');
  const content = fs.readFileSync(winSourcePath, 'utf8');

  assert.ok(
    content.includes('SetProcessDpiAwarenessContext'),
    'window_windows.go must declare SetProcessDpiAwarenessContext procedure'
  );
  assert.ok(
    content.includes('DpiAwarenessContextPerMonitorAwareV2'),
    'window_windows.go must declare DpiAwarenessContextPerMonitorAwareV2 constant'
  );
  assert.ok(
    content.includes('procSetProcessDpiAwarenessContext.Call'),
    'window_windows.go must call SetProcessDpiAwarenessContext before WebView2 initialization'
  );
});

test('SPEC-90-03: Zero-telemetry absence guard across production codebase', () => {
  const scanFiles = getScanFiles(repoRoot);
  assert.ok(scanFiles.length > 20, `Expected scan of production files, found ${scanFiles.length}`);

  // Must complete without error
  scanZeroTelemetryInvariants(scanFiles);
});

test('SPEC-90-03 guard proof: scanZeroTelemetryInvariants detects injected telemetry or update tokens', () => {
  const tmpFile = path.join(repoRoot, 'src', 'lib', '_mock_telemetry_defect.ts');

  // Defect 1: Injected update endpoint
  fs.writeFileSync(tmpFile, `export const updateUrl = "${PROHIBITED_UPDATE_API}";\n`, 'utf8');
  try {
    assert.throws(
      () => scanZeroTelemetryInvariants([tmpFile]),
      /prohibited telemetry\/update token "\/api\/v1\/update"/
    );
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }

  // Defect 2: Injected Sentry SDK reference
  fs.writeFileSync(tmpFile, `import * as Sentry from "${PROHIBITED_TELEMETRY_SDK_PATTERNS[0]}";\n`, 'utf8');
  try {
    assert.throws(
      () => scanZeroTelemetryInvariants([tmpFile]),
      /prohibited telemetry\/update token "@sentry\/browser"/
    );
  } finally {
    fs.rmSync(tmpFile, { force: true });
  }
});
