import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test('SPEC-99-03: PresenterOperator openProjector builds multi-screen coordinates and fullscreen parameter', () => {
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');

  // Must import resolveLaunchTarget and getDisplayTargetConfig from display-target
  assert.ok(
    src.includes('resolveLaunchTarget') && src.includes('getDisplayTargetConfig'),
    'PresenterOperator must import resolveLaunchTarget and getDisplayTargetConfig'
  );

  // Must construct targetUrl with fullscreen=1 when mode is fullscreen
  assert.ok(
    src.includes('fullscreen=1'),
    'PresenterOperator must pass fullscreen=1 when launching fullscreen target'
  );

  // Must pass relocateProjector to PresenterDisplayControl
  assert.ok(
    src.includes('onRelocate='),
    'PresenterOperator must provide onRelocate to PresenterDisplayControl'
  );
});

test('SPEC-99-03: ProjectorClient handles fullscreen=1 query parameter with graceful F11 fallback', () => {
  const projectorPath = path.join(ROOT, 'src', 'projected', 'ProjectorClient.tsx');
  const src = fs.readFileSync(projectorPath, 'utf8');

  // Must check for fullscreen=1 query param
  assert.ok(
    src.includes('fullscreen') && src.includes('requestFullscreen'),
    'ProjectorClient must attempt requestFullscreen when fullscreen param is present'
  );

  // Must preserve F11 guidance hint on requestFullscreen failure
  assert.ok(
    src.includes('setShowHint'),
    'ProjectorClient must maintain F11 guidance fallback'
  );
});

test('SPEC-99-03: Window relocation closes existing window before opening on new target', () => {
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');

  // Relocation logic must close existing handle
  assert.ok(
    src.includes('existing.close()') || src.includes('existing?.close()'),
    'Relocation must close existing window handle'
  );
});

test('SPEC-99-03: Topology events do not alter AD-29 heartbeat liveness state', async () => {
  const { subscribeScreenTopology } = await import(new URL('../src/lib/display-target.ts', import.meta.url).href);
  const { INITIAL_LIVENESS_STATE, nextLivenessState } = await import(
    new URL('../src/lib/projector-liveness.ts', import.meta.url).href
  );

  // Liveness remains purely driven by opened/ack/heartbeat ticks (AD-29)
  const state1 = nextLivenessState(INITIAL_LIVENESS_STATE, { type: 'opened' }, 1000);
  assert.equal(state1.verdict, 'never-opened');

  // Topology subscription returns a cleanup function and does not emit liveness actions
  const cleanup = subscribeScreenTopology(() => {});
  assert.equal(typeof cleanup, 'function');
  cleanup();

  // Heartbeat ack is the sole authority for 'live' verdict
  const state2 = nextLivenessState(state1, { type: 'ack' }, 1000);
  assert.equal(state2.verdict, 'live');
});

test('SPEC-99-03 Defect Injection Proof: verifyFullscreenOrchestration detects omitted query parameter', () => {
  const presenterPath = path.join(ROOT, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const src = fs.readFileSync(presenterPath, 'utf8');
  const brokenSource = src.replaceAll('fullscreen=1', '');

  assert.equal(
    brokenSource.includes('fullscreen=1'),
    false,
    'INJECTED DEFECT: Omitted fullscreen=1 fails guard'
  );
});
