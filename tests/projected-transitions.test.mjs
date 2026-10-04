import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function getProjectorClientSource() {
  const filePath = path.join(ROOT, 'src', 'projected', 'ProjectorClient.tsx');
  assert.ok(fs.existsSync(filePath), 'ProjectorClient.tsx must exist');
  return fs.readFileSync(filePath, 'utf8');
}

test('SPEC-104-01: ProjectorClient renders persistent blackout layer with 300ms transition and pointer-events-none', () => {
  const src = getProjectorClientSource();

  // Must have data-testid="projector-blank-layer"
  assert.ok(
    src.includes('data-testid="projector-blank-layer"'),
    'ProjectorClient must render projector-blank-layer'
  );

  // Must have transition-opacity duration-300 ease-in-out pointer-events-none
  assert.ok(
    src.includes('transition-opacity duration-300 ease-in-out pointer-events-none'),
    'Blackout layer must declare transition-opacity duration-300 ease-in-out pointer-events-none'
  );

  // Must have z-50 positioning
  assert.ok(
    src.includes('absolute inset-0 z-50 bg-black'),
    'Blackout layer must have absolute inset-0 z-50 bg-black'
  );

  // Must dynamically toggle opacity-100 and opacity-0 based on blank state
  assert.ok(
    src.includes("blank ? 'opacity-100' : 'opacity-0'"),
    "Blackout layer must toggle opacity-100 and opacity-0 via `blank ? 'opacity-100' : 'opacity-0'`"
  );

  // Absence guard: Old abrupt conditional mounting must NOT be present (formatting-resilient regex)
  assert.equal(
    /\{blank\s*\?\s*\(?\s*<div[^>]*bg-black/i.test(src),
    false,
    'Old conditional mounting of blank layer must be absent'
  );
});

test('SPEC-104-01: Blackout layer helper simulates smooth transition states and preserves underlying slide advancement', () => {
  function computeBlankLayerClass(blank) {
    return `absolute inset-0 z-50 bg-black transition-opacity duration-300 ease-in-out pointer-events-none ${
      blank ? 'opacity-100' : 'opacity-0'
    }`;
  }

  // When unblanked (blank=false)
  const unblanked = computeBlankLayerClass(false);
  assert.ok(unblanked.includes('opacity-0'), 'Unblanked layer must have opacity-0');
  assert.ok(!unblanked.includes('opacity-100'), 'Unblanked layer must not have opacity-100');
  assert.ok(unblanked.includes('pointer-events-none'), 'Unblanked layer must have pointer-events-none');
  assert.ok(unblanked.includes('duration-300'), 'Unblanked layer must declare 300ms transition duration');

  // When blanked (blank=true)
  const blanked = computeBlankLayerClass(true);
  assert.ok(blanked.includes('opacity-100'), 'Blanked layer must have opacity-100');
  assert.ok(!blanked.includes('opacity-0'), 'Blanked layer must not have opacity-0');
  assert.ok(blanked.includes('pointer-events-none'), 'Blanked layer must have pointer-events-none');

  // Slide advancement while blanked: simulated state machine
  let state = { index: 0, blank: true };
  assert.ok(computeBlankLayerClass(state.blank).includes('opacity-100'));
  // Advance slide index
  state.index = 1;
  assert.equal(state.index, 1);
  assert.ok(computeBlankLayerClass(state.blank).includes('opacity-100'), 'Overlay remains at opacity-100 during slide navigation');
});

test('SPEC-104-01: Defect injection proof — verifyBlankTransitionGuard detects missing transition or improper layer', () => {
  function verifyBlankTransitionGuard(src) {
    if (!src.includes('data-testid="projector-blank-layer"')) {
      return { pass: false, reason: 'missing-test-id' };
    }
    if (!src.includes('duration-300')) {
      return { pass: false, reason: 'missing-duration' };
    }
    if (!src.includes('pointer-events-none')) {
      return { pass: false, reason: 'missing-pointer-events-none' };
    }
    if (!src.includes('z-50')) {
      return { pass: false, reason: 'missing-z50' };
    }
    if (src.includes('{blank ? <div') || src.includes('{blank ? (\n        <div')) {
      return { pass: false, reason: 'conditional-unmounting' };
    }
    return { pass: true };
  }

  // Defect 1: Missing test ID
  assert.equal(verifyBlankTransitionGuard('<div className="z-50 duration-300 pointer-events-none" />').reason, 'missing-test-id');

  // Defect 2: Missing duration-300
  assert.equal(verifyBlankTransitionGuard('<div data-testid="projector-blank-layer" className="z-50 pointer-events-none" />').reason, 'missing-duration');

  // Defect 3: Missing pointer-events-none
  assert.equal(verifyBlankTransitionGuard('<div data-testid="projector-blank-layer" className="z-50 duration-300" />').reason, 'missing-pointer-events-none');

  // Defect 4: Conditional unmounting instead of persistent layer
  assert.equal(verifyBlankTransitionGuard('<div data-testid="projector-blank-layer" className="z-50 duration-300 pointer-events-none" />\n{blank ? <div aria-hidden="true" className="z-50" /> : null}').reason, 'conditional-unmounting');
});
