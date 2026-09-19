/**
 * SPEC-47: Offline Desktop Application with Inno Setup and On-Demand Manual Sync
 * Smoke Test & Executable Absence Guard Suite
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

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

test('SPEC-47-02: internal/pptx/worker.go resolves bundled runtime/node.exe before falling back to PATH', () => {
  const workerGoPath = path.join(root, 'internal', 'pptx', 'worker.go');
  assert.ok(fs.existsSync(workerGoPath), 'internal/pptx/worker.go must exist');
  const workerSource = fs.readFileSync(workerGoPath, 'utf8');

  // Verify ResolveNodeBinary exists and looks into {root}/runtime/node.exe
  assert.match(workerSource, /func ResolveNodeBinary/);
  assert.match(workerSource, /filepath\.Join\(root,\s*"runtime",\s*"node\.exe"\)/);
  assert.match(workerSource, /filepath\.Join\(root,\s*"runtime",\s*"node"\)/);

  // Verify worker execution sets absolute root directory
  assert.match(workerSource, /absRoot.*filepath\.Abs/);
  assert.match(workerSource, /cmd\.Dir\s*=\s*absRoot/);
});

test('SPEC-47-02: Staging portable node helper prepares runtime and isolates workers', async () => {
  const stageScriptPath = path.join(root, 'scripts', 'stage-portable-node.mjs');
  assert.ok(fs.existsSync(stageScriptPath), 'scripts/stage-portable-node.mjs must exist');

  const { stagePortableNode, getDependencyClosure, PINNED_NODE_VERSION, PINNED_NODE_ARCH } = await import('../scripts/stage-portable-node.mjs');
  assert.strictEqual(PINNED_NODE_VERSION, 'v22.12.0');
  assert.strictEqual(PINNED_NODE_ARCH, 'win-x64');

  // Stage into isolated temp directory outside repository
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'wpw-staged-spec-'));
  try {
    const { runtimeDir, targetNodeExe, workersTarget, srcTarget, fullClosure } = await stagePortableNode(tmpOut);
    assert.ok(fs.existsSync(runtimeDir), 'runtime directory must be created');
    assert.ok(
      fs.existsSync(targetNodeExe) ||
        fs.existsSync(path.join(runtimeDir, 'runtime-manifest.json')),
      'node.exe or runtime-manifest.json must be present in staged runtime'
    );

    // Verify workers/pptx/draw.mjs and register.mjs are staged
    assert.ok(
      fs.existsSync(path.join(workersTarget, 'pptx', 'draw.mjs')),
      'workers/pptx/draw.mjs must be staged'
    );
    assert.ok(
      fs.existsSync(path.join(workersTarget, 'pptx', 'register.mjs')),
      'workers/pptx/register.mjs must be staged'
    );

    // Verify src/ dependency graph is staged for draw.mjs
    assert.ok(
      fs.existsSync(path.join(srcTarget, 'lib', 'pptx-draw.ts')),
      'src/lib/pptx-draw.ts must be staged for worker self-containment'
    );
    assert.ok(
      fs.existsSync(path.join(tmpOut, 'package.json')),
      'package.json must be staged in target directory'
    );

    // Verify complete dependency closure is staged
    assert.strictEqual(fullClosure.length, 19, 'full dependency closure must contain exactly 19 packages');
    const closureNames = fullClosure.map((e) => e.name);
    assert.ok(closureNames.includes('pptxgenjs'), 'closure must contain pptxgenjs');
    assert.ok(closureNames.includes('jszip'), 'closure must contain jszip');
    assert.ok(closureNames.includes('image-size'), 'closure must contain image-size');
    assert.ok(closureNames.includes('readable-stream'), 'closure must contain readable-stream');
    assert.ok(closureNames.includes('isarray'), 'closure must contain isarray');

    // Verify EVERY closure package manifest physically exists at its exact relative path in target node_modules
    for (const entry of fullClosure) {
      const manifestTarget = path.join(tmpOut, 'node_modules', entry.relPath, 'package.json');
      assert.ok(
        fs.existsSync(manifestTarget),
        `package.json must exist at staged location: node_modules/${entry.relPath}/package.json`
      );
    }

    // Explicitly verify the nested readable-stream/node_modules/isarray path
    const isarrayNestedPath = path.join(
      tmpOut,
      'node_modules',
      'readable-stream',
      'node_modules',
      'isarray',
      'package.json'
    );
    assert.ok(
      fs.existsSync(isarrayNestedPath),
      'readable-stream/node_modules/isarray/package.json must exist in isolated package'
    );
  } finally {
    fs.rmSync(tmpOut, { recursive: true, force: true });
  }

  // Defect injection 1: missing targetDir throws error
  await assert.rejects(
    async () => {
      await stagePortableNode('');
    },
    /targetDir is required/,
    'Defect proof 1: empty targetDir must throw an error'
  );

  // Defect injection 2: missing workers directory throws error
  const emptySourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wpw-empty-src-'));
  try {
    await assert.rejects(
      async () => {
        await stagePortableNode(path.join(emptySourceRoot, 'target'), {
          sourceRoot: emptySourceRoot,
          strict: false,
        });
      },
      /Required workers source directory does not exist/,
      'Defect proof 2: missing workers source directory must throw an error'
    );
  } finally {
    fs.rmSync(emptySourceRoot, { recursive: true, force: true });
  }

  // Defect injection 3: missing src directory throws error
  const sourceWithWorkersOnly = fs.mkdtempSync(path.join(os.tmpdir(), 'wpw-workers-only-'));
  try {
    fs.mkdirSync(path.join(sourceWithWorkersOnly, 'workers'));
    await assert.rejects(
      async () => {
        await stagePortableNode(path.join(sourceWithWorkersOnly, 'target'), {
          sourceRoot: sourceWithWorkersOnly,
          strict: false,
        });
      },
      /Required src source directory does not exist/,
      'Defect proof 3: missing src source directory must throw an error'
    );
  } finally {
    fs.rmSync(sourceWithWorkersOnly, { recursive: true, force: true });
  }

  // Defect injection 4: missing declared dependency manifest fails closed
  const dummyModules = fs.mkdtempSync(path.join(os.tmpdir(), 'wpw-dummy-mods-'));
  try {
    assert.throws(
      () => getDependencyClosure(['nonexistent-pkg'], dummyModules),
      /Required dependency manifest missing/,
      'Defect proof 4: missing dependency manifest must fail closed'
    );
  } finally {
    fs.rmSync(dummyModules, { recursive: true, force: true });
  }

  // Defect injection 5: malformed dependency package.json fails closed
  const corruptModules = fs.mkdtempSync(path.join(os.tmpdir(), 'wpw-corrupt-mods-'));
  try {
    const corruptPkgDir = path.join(corruptModules, 'bad-pkg');
    fs.mkdirSync(corruptPkgDir);
    fs.writeFileSync(path.join(corruptPkgDir, 'package.json'), '{ invalid json', 'utf8');
    assert.throws(
      () => getDependencyClosure(['bad-pkg'], corruptModules),
      /Invalid package\.json for dependency/,
      'Defect proof 5: malformed dependency package.json must fail closed'
    );
  } finally {
    fs.rmSync(corruptModules, { recursive: true, force: true });
  }

  // Defect injection 6: arbitrary multi-level nested dependency resolution
  const nestedFixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpw-nested-fixture-'));
  try {
    // Structure:
    // pkg-a/package.json -> dependencies: { "pkg-b": "^1.0.0" }
    // pkg-a/node_modules/pkg-b/package.json -> dependencies: { "pkg-c": "^1.0.0" }
    // pkg-a/node_modules/pkg-b/node_modules/pkg-c/package.json
    const pkgADir = path.join(nestedFixtureDir, 'pkg-a');
    const pkgBDir = path.join(pkgADir, 'node_modules', 'pkg-b');
    const pkgCDir = path.join(pkgBDir, 'node_modules', 'pkg-c');
    fs.mkdirSync(pkgCDir, { recursive: true });

    fs.writeFileSync(
      path.join(pkgADir, 'package.json'),
      JSON.stringify({ name: 'pkg-a', dependencies: { 'pkg-b': '^1.0.0' } })
    );
    fs.writeFileSync(
      path.join(pkgBDir, 'package.json'),
      JSON.stringify({ name: 'pkg-b', dependencies: { 'pkg-c': '^1.0.0' } })
    );
    fs.writeFileSync(
      path.join(pkgCDir, 'package.json'),
      JSON.stringify({ name: 'pkg-c', version: '1.0.0' })
    );

    const fixtureClosure = getDependencyClosure(['pkg-a'], nestedFixtureDir);
    assert.strictEqual(fixtureClosure.length, 3, 'closure must contain pkg-a, pkg-b, and pkg-c');

    const fixtureRelPaths = fixtureClosure.map((c) => c.relPath);
    assert.ok(fixtureRelPaths.includes('pkg-a'));
    assert.ok(fixtureRelPaths.some((p) => p.includes('pkg-a/node_modules/pkg-b') || p.includes('pkg-a\\node_modules\\pkg-b')));
    assert.ok(fixtureRelPaths.some((p) => p.includes('pkg-b/node_modules/pkg-c') || p.includes('pkg-b\\node_modules\\pkg-c')));
  } finally {
    fs.rmSync(nestedFixtureDir, { recursive: true, force: true });
  }
});

test('SPEC-47-02: Isolated runtime renders PPTX with PATH cleared of system Node', async () => {
  const { stagePortableNode } = await import('../scripts/stage-portable-node.mjs');
  // Stage to an external temporary directory outside the repo tree to prevent parent directory resolution
  const tmpOut = fs.mkdtempSync(path.join(os.tmpdir(), 'wpw-staged-node-'));

  try {
    const { targetNodeExe } = await stagePortableNode(tmpOut);
    if (!fs.existsSync(targetNodeExe)) {
      // Non-Windows environment without host node.exe fallback
      return;
    }

    const payload = JSON.stringify({
      serviceDate: '2026-09-19',
      transition: 'fade',
      plan: [
        {
          index: 0,
          kind: 'general',
          artifact: {
            runtimeVersion: 1,
            layout: {
              elements: [
                {
                  id: 'elem-1',
                  type: 'text',
                  content: 'Worship Service',
                  x: 10,
                  y: 10,
                  w: 80,
                  h: 20,
                  style: { fontSize: 32, bold: true, color: '#000000' },
                },
              ],
            },
          },
        },
      ],
    });

    // Execute the staged node.exe with PATH completely cleared of any system Node directory
    const env = {
      SystemRoot: process.env.SystemRoot || 'C:\\Windows',
      TEMP: process.env.TEMP || tmpOut,
      PATH: '', // Purposely cleared PATH proving zero global Node dependency
    };

    const res = spawnSync(
      targetNodeExe,
      ['--import', './workers/pptx/register.mjs', '--experimental-strip-types', './workers/pptx/draw.mjs'],
      {
        cwd: tmpOut,
        input: payload,
        env,
        maxBuffer: 20 * 1024 * 1024,
      }
    );

    assert.strictEqual(res.status, 0, `Worker failed: ${res.stderr?.toString()}`);
    assert.ok(res.stdout && res.stdout.length > 100, 'Worker must produce PPTX binary output');
    // Verify PK zip header bytes
    assert.strictEqual(res.stdout[0], 0x50, 'Byte 0 must be P');
    assert.strictEqual(res.stdout[1], 0x4b, 'Byte 1 must be K');
  } finally {
    if (fs.existsSync(tmpOut)) {
      fs.rmSync(tmpOut, { recursive: true, force: true });
    }
  }
});

export function scanInnoSetupDataPreservation(issSource) {
  const findings = [];
  // Ensure AppMutex includes the expected mutex
  if (!issSource.includes('Local\\WorshipPresenter.SingleInstance')) {
    findings.push('Missing Local\\WorshipPresenter.SingleInstance in AppMutex');
  }
  // Ensure CloseApplications is enabled
  if (!/CloseApplications\s*=\s*yes/i.test(issSource)) {
    findings.push('Inno Setup must configure CloseApplications=yes');
  }
  // Guard 1: Inno Setup [UninstallDelete] must never delete {localappdata} or {userappdata}
  const uninstallDeleteMatch = issSource.match(/\[UninstallDelete\]([\s\S]*?)(\[\w+\]|$)/);
  if (uninstallDeleteMatch) {
    const section = uninstallDeleteMatch[1];
    const uncommentedLines = section
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith(';'));
    for (const line of uncommentedLines) {
      if (/\{localappdata\}|\{userappdata\}/i.test(line)) {
        findings.push(`UninstallDelete directive violates data preservation: ${line}`);
      }
    }
  }
  // Guard 2: Inno Setup [Code] must never invoke destructive procedures on user data directory
  const codeMatch = issSource.match(/\[Code\]([\s\S]*$)/);
  if (codeMatch) {
    const codeSection = codeMatch[1];
    const destructiveCalls = [
      /\bDelTree\s*\([^)]*(?:DataDir|localappdata|userappdata|WorshipPresenter)/i,
      /\bRemoveDir\s*\([^)]*(?:DataDir|localappdata|userappdata|WorshipPresenter)/i,
      /\bDeleteFile\s*\([^)]*(?:DataDir|localappdata|userappdata|WorshipPresenter|data\.db)/i,
    ];
    for (const pattern of destructiveCalls) {
      if (pattern.test(codeSection)) {
        findings.push('Pascal script [Code] violates data preservation by invoking destructive deletion routines on user data directory');
      }
    }
  }
  return findings;
}

test('SPEC-47-03: Inno Setup script and desktop packaging pipeline integration', () => {
  const issPath = path.join(root, 'installer', 'worship-presenter.iss');
  assert.ok(fs.existsSync(issPath), 'installer/worship-presenter.iss must exist');
  const issSource = fs.readFileSync(issPath, 'utf8');

  // Verify setup metadata
  assert.match(issSource, /MyAppName "Worship Presenter Web"/);
  assert.match(issSource, /AppName=\{#MyAppName\}/);
  assert.match(issSource, /worship-presenter\.exe/);
  assert.match(issSource, /AppMutex=Local\\WorshipPresenter\.SingleInstance/);
  assert.match(issSource, /CloseApplications=yes/);

  // Verify build script exists and is wired
  const buildScriptPath = path.join(root, 'scripts', 'build-desktop.mjs');
  assert.ok(fs.existsSync(buildScriptPath), 'scripts/build-desktop.mjs must exist');
  const buildSource = fs.readFileSync(buildScriptPath, 'utf8');
  assert.match(buildSource, /spa:build/);
  assert.match(buildSource, /stagePortableNode/);
  assert.match(buildSource, /ISCC/);
  assert.match(buildSource, /requireInstaller/);
});

test('SPEC-47-03: Executable Absence Guard & Physical Real-File Defect Injection for Inno Setup Data Preservation', () => {
  const issPath = path.join(root, 'installer', 'worship-presenter.iss');
  const originalBytes = fs.readFileSync(issPath);
  const originalSource = originalBytes.toString('utf8');

  // Baseline: Real file on disk must pass with zero findings
  assert.deepEqual(scanInnoSetupDataPreservation(originalSource), []);

  try {
    // Physical defect injection 1: Accidental deletion of user localappdata in [UninstallDelete]
    const defectiveSource1 = originalSource.replace(
      '[UninstallDelete]',
      '[UninstallDelete]\nType: filesandordirs; Name: "{localappdata}\\WorshipPresenter"'
    );
    assert.notEqual(defectiveSource1, originalSource);
    fs.writeFileSync(issPath, defectiveSource1, 'utf8');

    const diskSource1 = fs.readFileSync(issPath, 'utf8');
    const defectFindings1 = scanInnoSetupDataPreservation(diskSource1);
    assert.ok(
      defectFindings1.some((f) => f.includes('violates data preservation')),
      'Defect proof 1: Scanner must detect deletion of user data in UninstallDelete'
    );

    // Physical defect injection 2: Missing CloseApplications=yes
    const defectiveSource2 = originalSource.replace(
      'CloseApplications=yes',
      'CloseApplications=no'
    );
    assert.notEqual(defectiveSource2, originalSource);
    fs.writeFileSync(issPath, defectiveSource2, 'utf8');

    const diskSource2 = fs.readFileSync(issPath, 'utf8');
    const defectFindings2 = scanInnoSetupDataPreservation(diskSource2);
    assert.ok(
      defectFindings2.some((f) => f.includes('CloseApplications=yes')),
      'Defect proof 2: Scanner must detect missing CloseApplications=yes'
    );

    // Physical defect injection 3: Missing/corrupted Local AppMutex
    const defectiveSource3 = originalSource.replace(
      'Local\\WorshipPresenter.SingleInstance',
      'SomeOtherApp.Mutex'
    );
    assert.notEqual(defectiveSource3, originalSource);
    fs.writeFileSync(issPath, defectiveSource3, 'utf8');

    const diskSource3 = fs.readFileSync(issPath, 'utf8');
    const defectFindings3 = scanInnoSetupDataPreservation(diskSource3);
    assert.ok(
      defectFindings3.some((f) => f.includes('Missing Local\\WorshipPresenter.SingleInstance')),
      'Defect proof 3: Scanner must detect missing Local AppMutex'
    );

    // Physical defect injection 4: Destructive Pascal Script in [Code] invoking DelTree
    const defectiveSource4 = originalSource.replace(
      'Log(\'Data preservation invariant: Preserving user data directory at \' + DataDir);',
      'DelTree(DataDir, True, True, True);'
    );
    assert.notEqual(defectiveSource4, originalSource);
    fs.writeFileSync(issPath, defectiveSource4, 'utf8');

    const diskSource4 = fs.readFileSync(issPath, 'utf8');
    const defectFindings4 = scanInnoSetupDataPreservation(diskSource4);
    assert.ok(
      defectFindings4.some((f) => f.includes('Pascal script [Code] violates data preservation')),
      'Defect proof 4: Scanner must detect destructive Pascal Script DelTree call'
    );

    // Physical defect injection 5: Destructive Pascal Script in [Code] invoking RemoveDir
    const defectiveSource5 = originalSource.replace(
      'Log(\'Data preservation invariant: Preserving user data directory at \' + DataDir);',
      'RemoveDir(DataDir);'
    );
    assert.notEqual(defectiveSource5, originalSource);
    fs.writeFileSync(issPath, defectiveSource5, 'utf8');

    const diskSource5 = fs.readFileSync(issPath, 'utf8');
    const defectFindings5 = scanInnoSetupDataPreservation(diskSource5);
    assert.ok(
      defectFindings5.some((f) => f.includes('Pascal script [Code] violates data preservation')),
      'Defect proof 5: Scanner must detect destructive Pascal Script RemoveDir call'
    );

    // Physical defect injection 6: Destructive Pascal Script in [Code] invoking DeleteFile
    const defectiveSource6 = originalSource.replace(
      'Log(\'Data preservation invariant: Preserving user data directory at \' + DataDir);',
      'DeleteFile(DataDir + \'\\data.db\');'
    );
    assert.notEqual(defectiveSource6, originalSource);
    fs.writeFileSync(issPath, defectiveSource6, 'utf8');

    const diskSource6 = fs.readFileSync(issPath, 'utf8');
    const defectFindings6 = scanInnoSetupDataPreservation(diskSource6);
    assert.ok(
      defectFindings6.some((f) => f.includes('Pascal script [Code] violates data preservation')),
      'Defect proof 6: Scanner must detect destructive Pascal Script DeleteFile call'
    );
  } finally {
    // Always restore pristine file on disk byte-for-byte
    fs.writeFileSync(issPath, originalBytes);
  }

  // Prove byte-for-byte restoration
  const restoredBytes = fs.readFileSync(issPath);
  assert.deepEqual(restoredBytes, originalBytes, 'installer/worship-presenter.iss must be restored byte-for-byte');
  const restoredSource = restoredBytes.toString('utf8');
  assert.deepEqual(scanInnoSetupDataPreservation(restoredSource), [], 'Restored file must pass cleanly');
});
