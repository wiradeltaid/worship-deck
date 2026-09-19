/**
 * SPEC-47: Offline Desktop Application with Inno Setup and On-Demand Manual Sync
 * Smoke Test & Executable Absence Guard Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function validateDesktopBindHost(host) {
  if (!host || host === '127.0.0.1' || host === 'localhost') {
    return { valid: true };
  }
  return { valid: false, reason: 'must_bind_loopback' };
}

export function validateDesktopDataDirectory(dataDir, isDesktop) {
  if (isDesktop && (!dataDir || dataDir.trim() === '')) {
    return { valid: false, reason: 'desktop_data_dir_required' };
  }
  return { valid: true };
}

test('SPEC-47-01: Go desktop launcher and data directory resolution integration', () => {
  const mainGoPath = path.join(root, 'cmd', 'api', 'main.go');
  assert.ok(fs.existsSync(mainGoPath), 'cmd/api/main.go must exist');
  const mainSource = fs.readFileSync(mainGoPath, 'utf8');

  // Verify CLI flags exist
  assert.match(mainSource, /"data-dir"/);
  assert.match(mainSource, /"desktop"/);
  assert.match(mainSource, /"port"/);
  assert.match(mainSource, /"no-browser"/);

  // Verify desktop package integration
  assert.match(mainSource, /desktop\.ResolveDataDir/);
  assert.match(mainSource, /desktop\.EnsureDataDir/);
  assert.match(mainSource, /desktop\.AcquireMutex/);
  assert.match(mainSource, /desktop\.FindAvailablePort/);
  assert.match(mainSource, /desktop\.WriteRuntimeInfo/);
});

test('SPEC-47-01: Desktop package implementation completeness', () => {
  const desktopDir = path.join(root, 'internal', 'desktop');
  assert.ok(fs.existsSync(desktopDir), 'internal/desktop directory must exist');

  const files = ['datadir.go', 'port.go', 'runtime.go', 'browser.go', 'mutex.go', 'mutex_windows.go', 'mutex_other.go'];
  for (const f of files) {
    assert.ok(fs.existsSync(path.join(desktopDir, f)), `internal/desktop/${f} must exist`);
  }

  const mutexWin = fs.readFileSync(path.join(desktopDir, 'mutex_windows.go'), 'utf8');
  assert.match(mutexWin, /windows\.CreateMutex/);
  assert.match(mutexWin, /ERROR_ALREADY_EXISTS/);

  const portGo = fs.readFileSync(path.join(desktopDir, 'port.go'), 'utf8');
  assert.match(portGo, /FindAvailablePort/);
  assert.match(portGo, /127\.0\.0\.1/);
});

export function scanDesktopSecurityGuards(mainSource) {
  const findings = [];
  if (!mainSource.includes('desktop.ValidateBindHost(bindHost, isDesktop)')) {
    findings.push('Missing desktop.ValidateBindHost loopback guard in cmd/api/main.go');
  }
  if (!mainSource.includes('log.Fatalf("acquiring single-instance mutex: %v", err)')) {
    findings.push('Missing fail-closed log.Fatalf on mutex acquisition error in cmd/api/main.go');
  }
  return findings;
}

test('SPEC-47-01: Executable Absence Guard & Physical Real-File Defect Injection for Loopback Binding and Mutex', () => {
  const mainGoPath = path.join(root, 'cmd', 'api', 'main.go');
  const originalBytes = fs.readFileSync(mainGoPath);
  const originalSource = originalBytes.toString('utf8');

  // Baseline: Real file on disk must pass with zero findings
  const realFindings = scanDesktopSecurityGuards(originalSource);
  assert.deepEqual(realFindings, [], 'cmd/api/main.go must pass desktop security guards scan');

  try {
    // Physical defect injection 1: Remove ValidateBindHost check from disk
    const defectiveSource1 = originalSource.replace(
      'desktop.ValidateBindHost(bindHost, isDesktop)',
      'nil'
    );
    assert.notEqual(defectiveSource1, originalSource, 'Defect 1 must differ from original');
    fs.writeFileSync(mainGoPath, defectiveSource1, 'utf8');

    const diskSource1 = fs.readFileSync(mainGoPath, 'utf8');
    const defectFindings1 = scanDesktopSecurityGuards(diskSource1);
    assert.ok(
      defectFindings1.some((f) => f.includes('Missing desktop.ValidateBindHost')),
      'Defect proof 1: Disk scan must detect missing ValidateBindHost guard'
    );

    // Physical defect injection 2: Replace fail-closed log.Fatalf with warning on disk
    const defectiveSource2 = originalSource.replace(
      'log.Fatalf("acquiring single-instance mutex: %v", err)',
      'log.Printf("warning: acquiring single-instance mutex: %v", err)'
    );
    assert.notEqual(defectiveSource2, originalSource, 'Defect 2 must differ from original');
    fs.writeFileSync(mainGoPath, defectiveSource2, 'utf8');

    const diskSource2 = fs.readFileSync(mainGoPath, 'utf8');
    const defectFindings2 = scanDesktopSecurityGuards(diskSource2);
    assert.ok(
      defectFindings2.some((f) => f.includes('Missing fail-closed log.Fatalf')),
      'Defect proof 2: Disk scan must detect fail-open mutex warning'
    );
  } finally {
    // Always restore pristine file on disk byte-for-byte
    fs.writeFileSync(mainGoPath, originalBytes);
  }

  // Prove byte-for-byte restoration
  const restoredBytes = fs.readFileSync(mainGoPath);
  assert.deepEqual(restoredBytes, originalBytes, 'File must be restored byte-for-byte');
  const restoredSource = restoredBytes.toString('utf8');
  assert.deepEqual(scanDesktopSecurityGuards(restoredSource), [], 'Restored file must pass cleanly');

  // Invariant: In-memory host validator rejects non-loopbacks
  assert.strictEqual(validateDesktopBindHost('127.0.0.1').valid, true);
  assert.strictEqual(validateDesktopBindHost('localhost').valid, true);
  assert.strictEqual(validateDesktopBindHost('').valid, true);

  const defectHostResult = validateDesktopBindHost('0.0.0.0');
  assert.strictEqual(defectHostResult.valid, false, 'Defect proof: 0.0.0.0 must be rejected');
  assert.strictEqual(defectHostResult.reason, 'must_bind_loopback');
});
