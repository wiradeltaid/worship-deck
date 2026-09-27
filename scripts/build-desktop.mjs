#!/usr/bin/env node
/**
 * SPEC-47-03: Desktop Packaging & Inno Setup Build Pipeline
 *
 * Orchestrates:
 * 1. Vite SPA production build (spa/dist)
 * 2. Go desktop binary compilation (dist-desktop/worship-deck.exe)
 * 3. Portable Node.js & worker closure staging (dist-desktop/runtime, workers, src, node_modules)
 * 4. Inno Setup installer compilation (dist-installer/WorshipDeck-<version>-x64-setup.exe) if ISCC is installed
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { stagePortableNode } from './stage-portable-node.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const distDesktop = path.join(repoRoot, 'dist-desktop');

export function resolvePackageVersion(root = repoRoot) {
  const pkgPath = path.join(root, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`package.json not found at ${pkgPath}`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const version = String(pkg.version || '').trim();
  const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/;
  if (!version || !semverRegex.test(version)) {
    throw new Error(`Invalid or missing semver version in package.json: "${version}"`);
  }
  return version;
}

export function generateVersionInfoRc(version) {
  const match = String(version || '').match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    throw new Error(`Invalid semver version format: "${version}"`);
  }
  const [, major, minor, patch] = match;
  const numericVersion = `${major},${minor},${patch},0`;

  return `1 ICON "../../installer/worship-deck.ico"
1 VERSIONINFO
FILEVERSION ${numericVersion}
PRODUCTVERSION ${numericVersion}
FILEFLAGSMASK 0x3fL
FILEFLAGS 0x0L
FILEOS 0x40004L
FILETYPE 0x1L
FILESUBTYPE 0x0L
BEGIN
    BLOCK "StringFileInfo"
    BEGIN
        BLOCK "040904b0"
        BEGIN
            VALUE "CompanyName", "Wira Delta Indonesia"
            VALUE "FileDescription", "WorshipDeck"
            VALUE "FileVersion", "${version}"
            VALUE "InternalName", "worship-deck"
            VALUE "LegalCopyright", "Copyright (c) 2026 Wira Delta Indonesia"
            VALUE "OriginalFilename", "worship-deck.exe"
            VALUE "ProductName", "WorshipDeck"
            VALUE "ProductVersion", "${version}"
        END
    END
    BLOCK "VarFileInfo"
    BEGIN
        VALUE "Translation", 0x409, 1200
    END
END
`;
}

export function findWindres() {
  const candidates = [
    'windres.exe',
    'windres',
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages', 'BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe', 'mingw64', 'bin', 'windres.exe'),
    'C:\\mingw64\\bin\\windres.exe',
    'C:\\msys64\\mingw64\\bin\\windres.exe',
  ];

  for (const bin of candidates) {
    if (path.isAbsolute(bin) && fs.existsSync(bin)) {
      return bin;
    }
    if (!path.isAbsolute(bin)) {
      try {
        const cmd = process.platform === 'win32' ? 'where.exe' : 'which';
        const res = spawnSync(cmd, [bin], { stdio: 'ignore', shell: true });
        if (res.status === 0) return bin;
      } catch {
        // continue
      }
    }
  }
  return null;
}

export function compileVersionInfoSyso(root = repoRoot, options = {}) {
  const version = resolvePackageVersion(root);
  const apiDir = path.join(root, 'cmd', 'api');
  const rcPath = path.join(apiDir, 'worship-deck.rc');
  const sysoPath = path.join(apiDir, 'rsrc_windows_amd64.syso');

  // Purge any preexisting or stale syso file before regenerating
  if (fs.existsSync(sysoPath)) {
    fs.unlinkSync(sysoPath);
  }

  const rcContent = generateVersionInfoRc(version);
  fs.writeFileSync(rcPath, rcContent, 'utf8');

  const windresBin = findWindres();
  if (!windresBin) {
    if (options.strict || process.platform === 'win32') {
      throw new Error('[build-desktop] windres compiler not found. Desktop packaging requires windres to compile PE VersionInfo resource.');
    } else {
      console.warn('[build-desktop] windres not found (non-Windows platform), skipping .syso generation');
      return { rcPath, sysoPath: null, generated: false };
    }
  }

  const res = spawnSync(windresBin, ['-i', 'worship-deck.rc', '-O', 'coff', '-o', 'rsrc_windows_amd64.syso'], {
    cwd: apiDir,
    stdio: 'inherit',
    shell: false,
  });

  if (res.status !== 0) {
    throw new Error(`[build-desktop] windres failed with status ${res.status}`);
  }

  if (!fs.existsSync(sysoPath)) {
    throw new Error(`[build-desktop] Expected syso output not found at ${sysoPath}`);
  }

  console.log(`[build-desktop] Successfully compiled PE resource to ${sysoPath}`);
  return { rcPath, sysoPath, generated: true };
}

export function stageCorporaAndNotices(targetDir) {
  console.log('[build-desktop] Staging corpora, fonts, licenses, and notices...');

  // 1. Songbook corpus
  const songBookSrc = path.join(repoRoot, 'data', 'song-book');
  const songBookDest = path.join(targetDir, 'data', 'song-book');
  fs.mkdirSync(songBookDest, { recursive: true });
  fs.copyFileSync(path.join(songBookSrc, 'sdah.json'), path.join(songBookDest, 'sdah.json'));

  // 2. Bible translation corpus
  const bibleSrc = path.join(repoRoot, 'data', 'en', 'bible-translation');
  const bibleDest = path.join(targetDir, 'data', 'en', 'bible-translation');
  fs.mkdirSync(bibleDest, { recursive: true });
  fs.copyFileSync(path.join(bibleSrc, 'kjv.json'), path.join(bibleDest, 'kjv.json'));

  // 3. Bundled fonts
  const fontsSrc = path.join(repoRoot, 'data', 'fonts');
  const fontsDest = path.join(targetDir, 'data', 'fonts');
  fs.mkdirSync(fontsDest, { recursive: true });
  for (const f of fs.readdirSync(fontsSrc)) {
    if (f.endsWith('.ttf')) {
      fs.copyFileSync(path.join(fontsSrc, f), path.join(fontsDest, f));
    }
  }

  // 4. Default seed JSON configuration files (SPEC-89)
  const dataDest = path.join(targetDir, 'data');
  fs.mkdirSync(dataDest, { recursive: true });
  for (const seedFile of ['default-song-set-layouts.json', 'default-registry.json', 'asset-map.json']) {
    const src = path.join(repoRoot, 'data', seedFile);
    if (!fs.existsSync(src)) {
      throw new Error(`[build-desktop] Required default seed configuration file missing: ${src}`);
    }
    fs.copyFileSync(src, path.join(dataDest, seedFile));
  }

  // 5. Legal licenses, privacy policy & third-party notices
  for (const f of ['LICENSE', 'ATTRIBUTIONS.md', 'THIRD-PARTY-NOTICES', 'PRIVACY.md']) {
    const src = path.join(repoRoot, f);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(targetDir, f));
    }
  }
}

export async function buildDesktopPackage(options = {}) {
  const appVersion = resolvePackageVersion(repoRoot);
  console.log(`[build-desktop] Starting desktop packaging pipeline (version: ${appVersion})...`);
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
  compileVersionInfoSyso(repoRoot, { strict: process.platform === 'win32' });
  const exeName = 'worship-deck.exe';
  const exePath = path.join(distDesktop, exeName);
  const goRes = spawnSync(
    'go',
    ['build', '-trimpath', '-ldflags=-s -w -H=windowsgui', '-o', exePath, './cmd/api'],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
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

  // Post-compilation verification of PE VersionInfo stamping
  if (process.platform === 'win32' && fs.existsSync(exePath)) {
    const psScript = `(Get-Item -LiteralPath '${exePath.replace(/'/g, "''")}').VersionInfo | Select-Object CompanyName, ProductVersion | ConvertTo-Json`;
    const checkRes = spawnSync('powershell.exe', ['-NoProfile', '-Command', psScript], {
      encoding: 'utf8',
      shell: false,
    });
    if (checkRes.status === 0 && checkRes.stdout) {
      try {
        const info = JSON.parse(checkRes.stdout);
        if (info.CompanyName !== 'Wira Delta Indonesia') {
          throw new Error(`Stamped CompanyName mismatch: expected "Wira Delta Indonesia", got "${info.CompanyName}"`);
        }
        if (info.ProductVersion !== appVersion) {
          throw new Error(`Stamped ProductVersion mismatch: expected "${appVersion}", got "${info.ProductVersion}"`);
        }
        console.log(`[build-desktop] Verified PE VersionInfo: CompanyName="${info.CompanyName}", ProductVersion="${info.ProductVersion}"`);
      } catch (err) {
        throw new Error(`[build-desktop] Post-compilation PE VersionInfo validation failed: ${err.message}`);
      }
    }
  }

  // 3. Stage portable Node.js and worker dependencies (strict mode)
  console.log('[build-desktop] 3/4: Staging portable Node runtime & worker graph...');
  const stageResult = await stagePortableNode(distDesktop, { strict: true });
  if (!fs.existsSync(path.join(distDesktop, 'runtime', 'node.exe'))) {
    throw new Error('Desktop packaging requires runtime/node.exe to be present');
  }

  // WSD-H-09: Stage corpora, fonts, licenses, and notices
  stageCorporaAndNotices(distDesktop);

  // 4. Compile Inno Setup installer
  const requireInstaller = options.requireInstaller ?? (process.argv.includes('--installer') || process.env.REQUIRE_INSTALLER === '1');
  console.log(`[build-desktop] 4/4: Checking Inno Setup compiler (ISCC) (requireInstaller: ${requireInstaller})...`);
  const issFile = path.join(repoRoot, 'installer', 'worship-deck.iss');
  const isccPaths = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Inno Setup 6', 'ISCC.exe'),
    'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
    'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
    'ISCC.exe',
  ];

  let isccBin = isccPaths.find((p) => {
    if (p !== 'ISCC.exe' && fs.existsSync(p)) return true;
    if (p === 'ISCC.exe') {
      try {
        const res = spawnSync('where', ['ISCC.exe'], { stdio: 'ignore', shell: true });
        return res.status === 0;
      } catch {
        return false;
      }
    }
    return false;
  });

  if (isccBin) {
    console.log(`[build-desktop] Found Inno Setup compiler at ${isccBin}, compiling setup with MyAppVersion=${appVersion}...`);
    const innoRes = spawnSync(isccBin, ['/DMyAppVersion=' + appVersion, issFile], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
    });
    if (innoRes.status !== 0) {
      throw new Error(`Inno Setup compilation failed with exit code ${innoRes.status}`);
    }
    const outputSetup = path.join(repoRoot, 'dist-installer', `WorshipDeck-${appVersion}-x64-setup.exe`);
    if (!fs.existsSync(outputSetup)) {
      throw new Error(`Expected installer output not found at ${outputSetup}`);
    }
    console.log(`[build-desktop] Successfully compiled ${outputSetup}!`);
  } else if (requireInstaller) {
    throw new Error('Inno Setup compiler (ISCC.exe) is required for package:installer but was not found on PATH or Program Files');
  } else {
    console.log('[build-desktop] Note: ISCC.exe not found on system PATH. The desktop staging directory (dist-desktop) and installer script (installer/worship-deck.iss) are ready for packaging.');
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
