#!/usr/bin/env node
/**
 * Staging helper for SPEC-47-02: Bundled Portable Node.js runtime for Inno Setup installer.
 * Prepares the portable Node.js runtime, production node_modules closure, and complete worker asset graph under {targetDir}/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = path.resolve(__dirname, '..');

export const PINNED_NODE_VERSION = 'v22.12.0';
export const PINNED_NODE_ARCH = 'win-x64';

/**
 * Recursively resolves the complete dependency closure for a set of packages,
 * resolving nested dependencies at arbitrary depth and recording their exact
 * relative path within node_modules.
 */
export function getDependencyClosure(packageNames, nodeModulesDir) {
  const baseDir = path.resolve(nodeModulesDir);
  const closureMap = new Map();

  function resolve(pkgName, parentDir) {
    let cur = parentDir;
    let foundDir = null;

    // Walk up directory tree from parentDir to baseDir checking for local node_modules
    while (cur && cur.length >= baseDir.length) {
      const candidate = path.join(cur, 'node_modules', pkgName);
      if (fs.existsSync(path.join(candidate, 'package.json'))) {
        foundDir = candidate;
        break;
      }
      const parent = path.dirname(cur);
      if (parent === cur) break;
      cur = parent;
    }

    // Check baseDir/pkgName
    if (!foundDir) {
      const rootCandidate = path.join(baseDir, pkgName);
      if (fs.existsSync(path.join(rootCandidate, 'package.json'))) {
        foundDir = rootCandidate;
      }
    }

    if (!foundDir) {
      throw new Error(`Required dependency manifest missing for "${pkgName}" requested from ${parentDir}`);
    }

    const relPath = path.relative(baseDir, foundDir).replace(/\\/g, '/');
    if (closureMap.has(relPath)) return;

    const manifestPath = path.join(foundDir, 'package.json');
    let data;
    try {
      data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      throw new Error(`Invalid package.json for dependency "${pkgName}" at ${manifestPath}: ${err.message}`);
    }

    closureMap.set(relPath, {
      name: pkgName,
      relPath,
      absPath: foundDir,
      manifestPath,
    });

    if (data.dependencies) {
      for (const dep of Object.keys(data.dependencies)) {
        resolve(dep, foundDir);
      }
    }
  }

  for (const p of packageNames) {
    resolve(p, baseDir);
  }

  return Array.from(closureMap.values());
}

export async function stagePortableNode(targetDir, options = {}) {
  if (!targetDir) {
    throw new Error('targetDir is required for staging portable node');
  }

  const sourceRoot = options.sourceRoot || defaultRepoRoot;
  const isStrict = options.strict !== false; // Strict by default

  const runtimeDir = path.join(targetDir, 'runtime');
  fs.mkdirSync(runtimeDir, { recursive: true });

  const targetNodeExe = path.join(runtimeDir, 'node.exe');

  // 1. Stage Node.js executable
  let stagedBinary = false;
  const customNodeExe = process.env.PORTABLE_NODE_EXE;
  if (customNodeExe && fs.existsSync(customNodeExe)) {
    console.log(`[stage-node] Using explicit portable node executable from ${customNodeExe}...`);
    fs.copyFileSync(customNodeExe, targetNodeExe);
    stagedBinary = true;
  } else if (process.platform === 'win32' && process.arch === 'x64' && fs.existsSync(process.execPath)) {
    console.log(`[stage-node] Copying Windows x64 node executable from ${process.execPath}...`);
    fs.copyFileSync(process.execPath, targetNodeExe);
    stagedBinary = true;
  } else if (process.platform === 'win32' && fs.existsSync(process.execPath)) {
    console.log(`[stage-node] Copying host node executable from ${process.execPath}...`);
    fs.copyFileSync(process.execPath, targetNodeExe);
    stagedBinary = true;
  }

  if (!stagedBinary) {
    if (isStrict) {
      throw new Error(`Cannot stage portable Node.js for ${PINNED_NODE_ARCH}: host platform is ${process.platform}/${process.arch} and PORTABLE_NODE_EXE not set`);
    }
    console.log(`[stage-node] Creating portable node runtime manifest at ${runtimeDir}...`);
    const manifest = {
      pinned_version: PINNED_NODE_VERSION,
      arch: PINNED_NODE_ARCH,
      url: `https://nodejs.org/dist/${PINNED_NODE_VERSION}/win-x64/node.exe`,
      staged_at: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(runtimeDir, 'runtime-manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
  }

  // 2. Stage workers directory into target (fail-closed if missing)
  const sourceWorkers = path.join(sourceRoot, 'workers');
  if (!fs.existsSync(sourceWorkers)) {
    throw new Error(`Required workers source directory does not exist at ${sourceWorkers}`);
  }
  const workersTarget = path.join(targetDir, 'workers');
  fs.cpSync(sourceWorkers, workersTarget, { recursive: true });
  console.log(`[stage-node] Staged workers directory to ${workersTarget}`);

  // 3. Stage src/ directory into target so workers/pptx/draw.mjs can resolve ../../src/lib/pptx-draw.ts
  const sourceSrc = path.join(sourceRoot, 'src');
  if (!fs.existsSync(sourceSrc)) {
    throw new Error(`Required src source directory does not exist at ${sourceSrc}`);
  }
  const srcTarget = path.join(targetDir, 'src');
  fs.cpSync(sourceSrc, srcTarget, { recursive: true });
  console.log(`[stage-node] Staged src directory to ${srcTarget}`);

  // 4. Stage package.json into target for module resolutions
  const sourcePackageJson = path.join(sourceRoot, 'package.json');
  if (!fs.existsSync(sourcePackageJson)) {
    throw new Error(`Required package.json does not exist at ${sourcePackageJson}`);
  }
  fs.copyFileSync(sourcePackageJson, path.join(targetDir, 'package.json'));

  // 5. Stage complete production PPTX worker dependency closure into target node_modules
  const sourceNodeModules = path.join(sourceRoot, 'node_modules');
  const targetNodeModules = path.join(targetDir, 'node_modules');
  fs.mkdirSync(targetNodeModules, { recursive: true });

  const rootPackages = ['pptxgenjs', 'jszip'];
  const fullClosure = getDependencyClosure(rootPackages, sourceNodeModules);
  for (const entry of fullClosure) {
    const destDir = path.join(targetNodeModules, entry.relPath);
    fs.mkdirSync(path.dirname(destDir), { recursive: true });
    fs.cpSync(entry.absPath, destDir, { recursive: true });
  }
  console.log(`[stage-node] Staged complete dependency closure (${fullClosure.length} packages) to ${targetNodeModules}`);

  return { runtimeDir, targetNodeExe, workersTarget, srcTarget, targetNodeModules, fullClosure };
}

// CLI execution
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const outDir = process.argv[2] || path.join(defaultRepoRoot, 'dist-desktop');
  stagePortableNode(outDir, { strict: true })
    .then(({ runtimeDir }) => {
      console.log(`[stage-node] Portable Node.js runtime staged successfully in ${runtimeDir}`);
    })
    .catch((err) => {
      console.error('[stage-node] Error staging runtime:', err);
      process.exit(1);
    });
}
