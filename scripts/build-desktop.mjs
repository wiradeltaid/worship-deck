#!/usr/bin/env node
/**
 * SPEC-47-03: Desktop Packaging & Inno Setup Build Pipeline
 *
 * Orchestrates:
 * 1. Vite SPA production build (spa/dist)
 * 2. Go desktop binary compilation (dist-desktop/worship-presenter.exe)
 * 3. Portable Node.js & worker closure staging (dist-desktop/runtime, workers, src, node_modules)
 * 4. Inno Setup installer compilation (dist-installer/WorshipPresenterSetup.exe) if ISCC is installed
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stagePortableNode } from './stage-portable-node.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDesktop = path.join(repoRoot, 'dist-desktop');

export async function buildDesktopPackage(options = {}) {
  console.log('[build-desktop] Starting desktop packaging pipeline...');
  fs.mkdirSync(distDesktop, { recursive: true });

  // 1. Build Vite React SPA
  console.log('[build-desktop] 1/4: Building Vite SPA...');
  const spaRes = spawnSync('npm', ['run', 'spa:build'], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: true,
  });
  if (spaRes.status !== 0) {
    throw new Error(`SPA build failed with exit code ${spaRes.status}`);
  }

  // 2. Compile Go desktop executable
  console.log('[build-desktop] 2/4: Compiling Go binary...');
  const exePath = path.join(distDesktop, 'worship-presenter.exe');
  const goRes = spawnSync(
    'go',
    ['build', '-trimpath', '-ldflags=-s -w', '-o', exePath, './cmd/api'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        GOOS: 'windows',
        GOARCH: 'amd64',
        CGO_ENABLED: '0',
      },
    }
  );
  if (goRes.status !== 0) {
    throw new Error(`Go compilation failed with exit code ${goRes.status}`);
  }

  // 3. Stage portable Node.js and worker dependencies (strict mode)
  console.log('[build-desktop] 3/4: Staging portable Node runtime & worker graph...');
  const stageResult = await stagePortableNode(distDesktop, { strict: true });
  if (!fs.existsSync(path.join(distDesktop, 'runtime', 'node.exe'))) {
    throw new Error('Desktop packaging requires runtime/node.exe to be present');
  }

  // 4. Compile Inno Setup installer
  const requireInstaller = options.requireInstaller ?? (process.argv.includes('--installer') || process.env.REQUIRE_INSTALLER === '1');
  console.log(`[build-desktop] 4/4: Checking Inno Setup compiler (ISCC) (requireInstaller: ${requireInstaller})...`);
  const issFile = path.join(repoRoot, 'installer', 'worship-presenter.iss');
  const isccPaths = [
    'ISCC.exe',
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
  ];

  let isccBin = isccPaths.find((p) => {
    try {
      const res = spawnSync(p, ['/?'], { stdio: 'ignore', shell: true });
      return res.status === 0;
    } catch {
      return false;
    }
  });

  if (isccBin) {
    console.log(`[build-desktop] Found Inno Setup compiler at ${isccBin}, compiling setup...`);
    const innoRes = spawnSync(isccBin, [issFile], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: true,
    });
    if (innoRes.status !== 0) {
      throw new Error(`Inno Setup compilation failed with exit code ${innoRes.status}`);
    }
    const outputSetup = path.join(repoRoot, 'dist-installer', 'WorshipPresenterSetup.exe');
    if (!fs.existsSync(outputSetup)) {
      throw new Error(`Expected installer output not found at ${outputSetup}`);
    }
    console.log(`[build-desktop] Successfully compiled ${outputSetup}!`);
  } else if (requireInstaller) {
    throw new Error('Inno Setup compiler (ISCC.exe) is required for package:installer but was not found on PATH or Program Files');
  } else {
    console.log('[build-desktop] Note: ISCC.exe not found on system PATH. The desktop staging directory (dist-desktop) and installer script (installer/worship-presenter.iss) are ready for packaging.');
  }

  return { distDesktop, exePath, stageResult, isccBin };
}

// CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const requireInstaller = process.argv.includes('--installer') || process.env.REQUIRE_INSTALLER === '1';
  buildDesktopPackage({ requireInstaller })
    .then(() => console.log('[build-desktop] Desktop packaging finished.'))
    .catch((err) => {
      console.error('[build-desktop] Failed:', err);
      process.exit(1);
    });
}
