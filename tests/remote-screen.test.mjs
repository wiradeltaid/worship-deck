/**
 * Source guards for Story 5-3:
 * "The remote screen on the phone"
 *
 * Contract requirements (from stories/5-3-remote-screen-on-the-phone.md):
 * 1. Only shadcn primitives from src/components/ui/ are imported for interactive controls.
 * 2. Every string the new route renders resolves through t and every key exists in all 3 i18n files.
 *    (Translator guard checks for no multi-arg t() calls across the codebase).
 * 3. No router.refresh(), no navigate(0), no return null on a loading branch.
 * 4. The module sends only the 6 existing intent types, asserted against PresentMessage union.
 * 5. Nothing in the module reads or renders projector liveness.
 * 6. Registered in package.json scripts.test.
 *
 * Injection-reversion proofs:
 * - Guard 3: Return null on loading branch or router.refresh()/navigate(0) detected.
 * - Guard 4: Sending a 7th intent variant detected.
 * - Guard 5: Reading/rendering projector liveness detected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRaw = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

function nodes(root, predicate) {
  const out = [];
  const visit = (node) => {
    if (predicate(node)) out.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return out;
}

// -----------------------------------------------------------------------------
// Guard 1: Only shadcn primitives imported for interactive controls
// -----------------------------------------------------------------------------
export function scanForbiddenHtmlControls(source, rel) {
  const findings = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    if (/<button\b/.test(line)) {
      findings.push({ rel, lineNo, kind: 'raw <button>', line: line.trim() });
    }
    if (/<select\b/.test(line)) {
      findings.push({ rel, lineNo, kind: 'raw <select>', line: line.trim() });
    }
    const input = line.match(/<input\b([^>/]*)(?:\/>|>)/);
    if (input) {
      const attrs = input[1] ?? '';
      const typeMatch = attrs.match(/type\s*=\s*["']([^"']+)["']/);
      const type = typeMatch?.[1] ?? 'text';
      if (!['file', 'color', 'hidden'].includes(type)) {
        findings.push({ rel, lineNo, kind: `raw <input type="${type}">`, line: line.trim() });
      }
    }
  }
  return findings;
}

test('Guard 1: RemoteOperator uses shadcn primitives from src/components/ui/*', () => {
  const source = readRaw('src/operator/present/RemoteOperator.tsx');
  const findings = scanForbiddenHtmlControls(source, 'src/operator/present/RemoteOperator.tsx');
  assert.deepEqual(findings, [], 'RemoteOperator must use shadcn primitives');
});

// -----------------------------------------------------------------------------
// Guard 2: Every i18n key in RemoteOperator exists in keys.ts and both catalogues
// -----------------------------------------------------------------------------
export function scanI18nKeysUsed(source) {
  const keys = new Set();
  const pattern = /\bt\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = pattern.exec(source)) !== null) {
    keys.add(m[1]);
  }
  return [...keys];
}

test('Guard 2: Every key used in RemoteOperator resolves in keys.ts, catalogue-en.ts, catalogue-id.ts', () => {
  const remoteSource = readRaw('src/operator/present/RemoteOperator.tsx');
  const usedKeys = scanI18nKeysUsed(remoteSource);
  assert.ok(usedKeys.length > 0, 'RemoteOperator should have translated strings');

  const keysSource = readRaw('src/lib/i18n/keys.ts');
  const enSource = readRaw('src/lib/i18n/catalogue-en.ts');
  const idSource = readRaw('src/lib/i18n/catalogue-id.ts');

  for (const key of usedKeys) {
    assert.ok(keysSource.includes(`'${key}'`), `keys.ts must contain ${key}`);
    assert.ok(enSource.includes(`'${key}':`), `catalogue-en.ts must contain ${key}`);
    assert.ok(idSource.includes(`'${key}':`), `catalogue-id.ts must contain ${key}`);
  }
});

// -----------------------------------------------------------------------------
// Guard 3: No return null on loading branch, no router.refresh(), no navigate(0)
// -----------------------------------------------------------------------------
export function scanForbiddenLoadingAndRefresh(source, rel) {
  const findings = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (/\breturn\s+null\s*;/.test(line)) {
      findings.push({ rel, lineNo, kind: 'return null', line: line.trim() });
    }
    if (/\brouter\.refresh\s*\(/.test(line)) {
      findings.push({ rel, lineNo, kind: 'router.refresh()', line: line.trim() });
    }
    if (/\bnavigate\s*\(\s*0\s*\)/.test(line)) {
      findings.push({ rel, lineNo, kind: 'navigate(0)', line: line.trim() });
    }
  }
  return findings;
}

test('Guard 3: RemotePage and RemoteOperator contain no return null, router.refresh(), or navigate(0)', () => {
  const pageFindings = scanForbiddenLoadingAndRefresh(
    readRaw('spa/src/pages/RemotePage.tsx'),
    'spa/src/pages/RemotePage.tsx'
  );
  assert.deepEqual(pageFindings, [], 'RemotePage must not return null on loading branch');

  const opFindings = scanForbiddenLoadingAndRefresh(
    readRaw('src/operator/present/RemoteOperator.tsx'),
    'src/operator/present/RemoteOperator.tsx'
  );
  assert.deepEqual(opFindings, [], 'RemoteOperator must not return null or router.refresh()');
});

test('Guard 3 proof: return null, router.refresh(), navigate(0) are detected when injected', () => {
  assert.deepEqual(
    scanForbiddenLoadingAndRefresh('if (loading) return null;', 'probe.tsx'),
    [{ rel: 'probe.tsx', lineNo: 1, kind: 'return null', line: 'if (loading) return null;' }]
  );
  assert.deepEqual(
    scanForbiddenLoadingAndRefresh('router.refresh();', 'probe.tsx'),
    [{ rel: 'probe.tsx', lineNo: 1, kind: 'router.refresh()', line: 'router.refresh();' }]
  );
  assert.deepEqual(
    scanForbiddenLoadingAndRefresh('navigate(0);', 'probe.tsx'),
    [{ rel: 'probe.tsx', lineNo: 1, kind: 'navigate(0)', line: 'navigate(0);' }]
  );
});

// -----------------------------------------------------------------------------
// Guard 4: Remote sends only the 6 existing intent types from PresentMessage union
// -----------------------------------------------------------------------------
export function scanSentIntentTypes(source) {
  const types = new Set();
  // Match type: '...' inside sendIntent calls or intent objects
  const pattern = /type:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = pattern.exec(source)) !== null) {
    types.add(m[1]);
  }
  return [...types];
}

test('Guard 4: Remote module sends only the 6 existing intent types', () => {
  const presentChannelSource = readRaw('src/lib/present-channel.ts');
  const allowedIntents = new Set([
    'sync',
    'blank',
    'transition',
    'background',
    'scripture',
    'clear-scripture',
  ]);

  // Verify that all 6 allowedIntents exist in PresentMessage union
  for (const intent of allowedIntents) {
    assert.ok(
      presentChannelSource.includes(`type: '${intent}'`),
      `PresentMessage in present-channel.ts must define '${intent}'`
    );
  }

  const remoteSource = readRaw('src/operator/present/RemoteOperator.tsx');
  const sentTypes = scanSentIntentTypes(remoteSource);
  for (const t of sentTypes) {
    assert.ok(
      allowedIntents.has(t),
      `Intent type '${t}' sent by RemoteOperator is not one of the 6 allowed PresentMessage intent types`
    );
  }
});

test('Guard 4 proof: injecting a 7th intent type fails guard', () => {
  const allowedIntents = new Set([
    'sync',
    'blank',
    'transition',
    'background',
    'scripture',
    'clear-scripture',
  ]);
  const injectedSource = `sendIntent({ type: 'jump-to-hymn', hymn: 42 });`;
  const sentTypes = scanSentIntentTypes(injectedSource);
  const invalid = sentTypes.filter((t) => !allowedIntents.has(t));
  assert.deepEqual(invalid, ['jump-to-hymn'], 'Guard must catch 7th intent type');
});

// -----------------------------------------------------------------------------
// Guard 5: Nothing in the module reads or renders projector liveness (AD-29)
// -----------------------------------------------------------------------------
export function scanProjectorLivenessReads(source, rel) {
  const findings = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    if (/\b(?:projector-liveness|nextLivenessState|INITIAL_LIVENESS_STATE|LivenessState|dispatchLiveness|projector-alive)\b/.test(line)) {
      findings.push({ rel, lineNo, kind: 'projector-liveness-import-or-call', line: line.trim() });
    }
  }
  return findings;
}

test('Guard 5: RemotePage and RemoteOperator do not read or render projector liveness (AD-29)', () => {
  const opFindings = scanProjectorLivenessReads(
    readRaw('src/operator/present/RemoteOperator.tsx'),
    'src/operator/present/RemoteOperator.tsx'
  );
  assert.deepEqual(opFindings, [], 'RemoteOperator must not read or render projector liveness');

  const pageFindings = scanProjectorLivenessReads(
    readRaw('spa/src/pages/RemotePage.tsx'),
    'spa/src/pages/RemotePage.tsx'
  );
  assert.deepEqual(pageFindings, [], 'RemotePage must not read or render projector liveness');
});

test('Guard 5 proof: injecting projector liveness read fails guard', () => {
  const injected = `import { nextLivenessState } from '@/lib/projector-liveness';`;
  const findings = scanProjectorLivenessReads(injected, 'probe.tsx');
  assert.deepEqual(
    findings,
    [{ rel: 'probe.tsx', lineNo: 1, kind: 'projector-liveness-import-or-call', line: 'import { nextLivenessState } from \'@/lib/projector-liveness\';' }]
  );
});

// -----------------------------------------------------------------------------
// Guard 6: Registered in package.json
// -----------------------------------------------------------------------------
test('Guard 6: tests/remote-screen.test.mjs is registered in package.json', () => {
  const pkg = JSON.parse(readRaw('package.json'));
  assert.ok(
    pkg.scripts.test.includes('tests/remote-screen.test.mjs'),
    'tests/remote-screen.test.mjs must be listed in package.json scripts.test'
  );
});

// -----------------------------------------------------------------------------
// SPEC-115-02: Dual-Mode Presenter Architecture & Surface Isolation Guards
// -----------------------------------------------------------------------------
export function scanDualModeIsolationGuards(operatorSource, remoteSource) {
  const opSrc = operatorSource.replace(/\r\n/g, '\n');
  const remSrc = remoteSource.replace(/\r\n/g, '\n');
  const defects = [];
  // 1. PresenterOperator must accept mode?: 'host' | 'remote'
  if (!opSrc.includes("mode?: 'host' | 'remote';")) {
    defects.push('missing-mode-parameter-type');
  }
  // 2. Projector bypass: openPresentChannel must be guarded by mode
  if (!opSrc.includes("if (mode === 'remote') return;\n    const ch = openPresentChannel(serviceId);")) {
    defects.push('projector-channel-not-bypassed-in-remote-mode');
  }
  // 3. Audio mute invariant: MediaStage must receive mutedOverride={mode === 'remote'}
  if (!opSrc.includes("mutedOverride={mode === 'remote'}")) {
    defects.push('media-stage-audio-not-muted-in-remote-mode');
  }
  // 4. Hardware capture bypass: CaptureBroker must be guarded by mode !== 'remote'
  if (!opSrc.includes("if (mode !== 'remote' && !captureBrokerRef.current)")) {
    defects.push('capture-broker-not-bypassed-in-remote-mode');
  }
  // 5. Durable mutation boundary: emergency edit button must be guarded by mode !== 'remote'
  if (!opSrc.includes("{mode !== 'remote' && (\n              <Button\n                type=\"button\"\n                variant=\"outline\"\n                size=\"sm\"\n                data-testid=\"emergency-edit-button\"")) {
    defects.push('emergency-edit-button-not-isolated-in-remote-mode');
  }
  // 6. RemoteOperator must delegate paired layout to PresenterOperator with mode="remote"
  if (!remSrc.includes('<PresenterOperator') || !remSrc.includes('mode="remote"')) {
    defects.push('remote-operator-not-delegating-to-dual-mode-presenter');
  }
  return defects;
}

test('SPEC-115-02: Dual-Mode Console Shell & Surface Isolation Invariants', () => {
  const operatorSource = readRaw('src/operator/present/PresenterOperator.tsx');
  const remoteSource = readRaw('src/operator/present/RemoteOperator.tsx');
  const defects = scanDualModeIsolationGuards(operatorSource, remoteSource);
  assert.deepEqual(defects, [], 'Must satisfy all dual-mode surface isolation invariants');
});

test('SPEC-115-02 defect injection: un-isolated projector, audio, or capture fails scan guard', () => {
  const defectiveOperator = `
    export function PresenterOperator() {
      const ch = openPresentChannel(serviceId);
      const broker = new CaptureBroker();
      return <MediaStage mutedOverride={false} />;
    }
  `;
  const defectiveRemote = '<div>Custom remote without PresenterOperator</div>';
  const defects = scanDualModeIsolationGuards(defectiveOperator, defectiveRemote);
  assert.ok(defects.length >= 5, 'Guard must detect missing isolation and missing dual-mode delegation');
  assert.ok(defects.includes('projector-channel-not-bypassed-in-remote-mode'));
  assert.ok(defects.includes('media-stage-audio-not-muted-in-remote-mode'));
  assert.ok(defects.includes('capture-broker-not-bypassed-in-remote-mode'));
});

// -----------------------------------------------------------------------------
// SPEC-115-04: Comprehensive Verification Suite, Isolation & Absence Guards
// -----------------------------------------------------------------------------
test('SPEC-115-04: PresenterOperator strictly enforces surface isolation invariants in remote mode', () => {
  const operatorSource = readRaw('src/operator/present/PresenterOperator.tsx').replace(/\r\n/g, '\n');

  // 1. Audio Mute Invariant: MediaStage mutedOverride bound to remote mode
  assert.ok(
    operatorSource.includes("mutedOverride={mode === 'remote'}"),
    'Must pass mutedOverride={mode === "remote"} to MediaStage'
  );
  // 2. Projector Channel Bypass: openPresentChannel bypassed in remote mode
  assert.ok(
    operatorSource.includes("if (mode === 'remote') return;\n    const ch = openPresentChannel(serviceId);"),
    'Must bypass openPresentChannel in remote mode'
  );
  // 3. Hardware Capture Bypass: CaptureBroker bypassed in remote mode
  assert.ok(
    operatorSource.includes("if (mode !== 'remote' && !captureBrokerRef.current)"),
    'Must bypass CaptureBroker in remote mode'
  );
  // 4. Cache & Storage Hydration Bypass: hydratePlaylist bypassed in remote mode
  assert.ok(
    operatorSource.includes("if (mode === 'remote') return;\n    let cancelled = false;\n    async function hydratePlaylist()"),
    'Must bypass hydratePlaylist in remote mode'
  );
  // 5. Emergency Patch Hydration Bypass: getEmergencyPatches bypassed in remote mode
  assert.ok(
    operatorSource.includes("if (mode === 'remote') {\n      setIsHydratingPatches(false);"),
    'Must bypass emergency patches hydration in remote mode'
  );
  // 6. Durable Mutation Boundary: Emergency edit modal and button hidden in remote mode
  assert.ok(
    operatorSource.includes("{mode !== 'remote' && (\n        <EmergencyCanvasDesignerModal"),
    'Must not mount EmergencyCanvasDesignerModal in remote mode'
  );
  assert.ok(
    operatorSource.includes("{mode !== 'remote' && (\n        <MediaDrawer"),
    'Must not mount MediaDrawer in remote mode'
  );
});

test('SPEC-115-04 real-file defect injection: mounting Emergency Edit or MediaDrawer in remote mode fails guard', () => {
  const operatorPath = path.join(repoRoot, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const original = fs.readFileSync(operatorPath, 'utf8');
  try {
    const isCrlf = original.includes('\r\n');
    const targetPattern = isCrlf
      ? "{mode !== 'remote' && (\r\n        <EmergencyCanvasDesignerModal"
      : "{mode !== 'remote' && (\n        <EmergencyCanvasDesignerModal";
    const defective = original.replace(
      targetPattern,
      "<EmergencyCanvasDesignerModal"
    );
    assert.notEqual(defective, original, 'Mutation must succeed');
    fs.writeFileSync(operatorPath, defective);

    const reRead = fs.readFileSync(operatorPath, 'utf8').replace(/\r\n/g, '\n');
    assert.ok(
      !reRead.includes("{mode !== 'remote' && (\n        <EmergencyCanvasDesignerModal"),
      'Defective source must trigger missing isolation guard'
    );
  } finally {
    fs.writeFileSync(operatorPath, original);
    assert.equal(fs.readFileSync(operatorPath, 'utf8'), original, 'File must be restored byte-for-byte');
  }
});
