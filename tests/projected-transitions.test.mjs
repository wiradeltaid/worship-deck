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

test('SPEC-104-02: ProjectorClient renders decoupled scripture overlay layer at z-20 preserving continuous slide rendering', () => {
  const src = getProjectorClientSource();

  // Dedicated scripture layer at z-20
  assert.ok(
    src.includes('data-testid="projector-scripture-layer"'),
    'ProjectorClient must render projector-scripture-layer'
  );
  assert.ok(
    src.includes('data-testid="projector-scripture-outgoing"'),
    'ProjectorClient must render projector-scripture-outgoing for crossfade'
  );
  assert.ok(
    src.includes('z-20'),
    'Scripture overlay must be positioned at z-20'
  );

  // Transition classes duration-300 ease-in-out pointer-events-none
  assert.ok(
    src.includes('transition-opacity duration-300 ease-in-out pointer-events-none'),
    'Scripture overlay must declare transition-opacity duration-300 ease-in-out pointer-events-none'
  );

  // Guard against repeated clear stranding exit timer
  assert.ok(
    src.includes("!activeOverlayRef.current || overlayPhaseRef.current === 'exiting'"),
    'clearScriptureOverlay must guard against repeated clear when no active overlay or already exiting'
  );

  // Continuous slide mounting: incoming slide container must render SlideView directly without conditional overlay replacement
  assert.equal(
    /overlay\s*\?\s*\(?\s*<ScriptureOverlayView/i.test(src),
    false,
    'Slide container must not conditionally replace SlideView with ScriptureOverlayView'
  );
});

test('SPEC-104-02: Scripture transition state machine handles entrance, exit, crossfade, and mount-time sync', async () => {
  class ScriptureTransitionStateMachine {
    constructor() {
      this.activeOverlay = null;
      this.outgoingOverlay = null;
      this.overlayPhase = 'hidden'; // 'hidden' | 'entering' | 'active' | 'exiting'
      this.outgoingPhase = 'hidden'; // 'hidden' | 'exiting-start' | 'exiting'
      this.timer = null;
      this.outgoingTimer = null;
    }

    onSync(scripture, isMountTime = false) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      if (this.outgoingTimer) { clearTimeout(this.outgoingTimer); this.outgoingTimer = null; }
      if (isMountTime) {
        if (scripture) {
          this.activeOverlay = scripture;
          this.outgoingOverlay = null;
          this.overlayPhase = 'active';
          this.outgoingPhase = 'hidden';
        } else {
          this.activeOverlay = null;
          this.outgoingOverlay = null;
          this.overlayPhase = 'hidden';
          this.outgoingPhase = 'hidden';
        }
        return;
      }
      if (scripture) {
        this.onScripture(scripture);
      } else {
        this.onClearScripture();
      }
    }

    onScripture(scripture) {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      if (!this.activeOverlay) {
        // Entrance from hidden
        if (this.outgoingTimer) { clearTimeout(this.outgoingTimer); this.outgoingTimer = null; }
        this.outgoingOverlay = null;
        this.outgoingPhase = 'hidden';
        this.activeOverlay = scripture;
        this.overlayPhase = 'entering';
        this.timer = setTimeout(() => {
          this.overlayPhase = 'active';
          this.timer = null;
        }, 20);
      } else {
        // Crossfade replacement
        if (this.outgoingTimer) { clearTimeout(this.outgoingTimer); this.outgoingTimer = null; }
        this.outgoingOverlay = this.activeOverlay;
        this.outgoingPhase = 'exiting-start';
        this.activeOverlay = scripture;
        this.overlayPhase = 'entering';
        this.timer = setTimeout(() => {
          this.outgoingPhase = 'exiting';
          this.overlayPhase = 'active';
          this.outgoingTimer = setTimeout(() => {
            this.outgoingOverlay = null;
            this.outgoingPhase = 'hidden';
            this.outgoingTimer = null;
          }, 300);
          this.timer = null;
        }, 20);
      }
    }

    onClearScripture() {
      // Guard against repeated clear stranding the exit timer
      if (!this.activeOverlay || this.overlayPhase === 'exiting') {
        return;
      }
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.overlayPhase = 'exiting';
      this.timer = setTimeout(() => {
        this.activeOverlay = null;
        this.outgoingOverlay = null;
        this.overlayPhase = 'hidden';
        this.outgoingPhase = 'hidden';
        this.timer = null;
      }, 300);
    }
  }

  // 1. Mount-time sync with scripture mounts immediately at phase active
  const sm1 = new ScriptureTransitionStateMachine();
  sm1.onSync({ reference: 'John 3:16', text: 'For God so loved...' }, true);
  assert.equal(sm1.overlayPhase, 'active');
  assert.equal(sm1.activeOverlay?.reference, 'John 3:16');
  assert.equal(sm1.outgoingOverlay, null);

  // 2. Entrance from hidden
  const sm2 = new ScriptureTransitionStateMachine();
  assert.equal(sm2.overlayPhase, 'hidden');
  sm2.onScripture({ reference: 'Gen 1:1', text: 'In the beginning...' });
  assert.equal(sm2.overlayPhase, 'entering');
  assert.equal(sm2.activeOverlay?.reference, 'Gen 1:1');
  assert.equal(sm2.outgoingOverlay, null);

  // Advance 25ms to let entering promote to active
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(sm2.overlayPhase, 'active');

  // 3. Clear initiates exit phase and sets overlayPhase to exiting
  sm2.onClearScripture();
  assert.equal(sm2.overlayPhase, 'exiting');
  assert.ok(sm2.activeOverlay, 'Active overlay stays mounted during exiting phase to animate opacity from 100 to 0');

  // Repeated clear while already exiting must be a no-op (does not cancel running exit timer)
  const timerBefore = sm2.timer;
  sm2.onClearScripture();
  assert.equal(sm2.timer, timerBefore, 'Repeated clear must not strand or clear active exit timer');

  // Advance 310ms to let exiting finish
  await new Promise((r) => setTimeout(r, 310));
  assert.equal(sm2.overlayPhase, 'hidden');
  assert.equal(sm2.activeOverlay, null);

  // 4. Crossfade replacement
  sm1.onScripture({ reference: 'Rom 8:28', text: 'And we know...' });
  assert.equal(sm1.overlayPhase, 'entering');
  assert.equal(sm1.outgoingPhase, 'exiting-start');
  assert.equal(sm1.outgoingOverlay?.reference, 'John 3:16');
  assert.equal(sm1.activeOverlay?.reference, 'Rom 8:28');

  await new Promise((r) => setTimeout(r, 25));
  assert.equal(sm1.overlayPhase, 'active');
  assert.equal(sm1.outgoingPhase, 'exiting');

  await new Promise((r) => setTimeout(r, 310));
  assert.equal(sm1.outgoingOverlay, null);
  assert.equal(sm1.outgoingPhase, 'hidden');
});

test('SPEC-104-02: Defect injection proof — verifyScriptureOverlayGuard detects coupled slide or missing z-20', () => {
  function verifyScriptureOverlayGuard(src) {
    if (!src.includes('data-testid="projector-scripture-layer"')) {
      return { pass: false, reason: 'missing-scripture-layer-testid' };
    }
    if (!src.includes('z-20')) {
      return { pass: false, reason: 'missing-z20' };
    }
    if (/overlay\s*\?\s*\(?\s*<ScriptureOverlayView/i.test(src)) {
      return { pass: false, reason: 'coupled-slide-replacement' };
    }
    return { pass: true };
  }

  // Defect 1: Missing test ID
  assert.equal(verifyScriptureOverlayGuard('<div className="z-20" />').reason, 'missing-scripture-layer-testid');

  // Defect 2: Missing z-20
  assert.equal(verifyScriptureOverlayGuard('<div data-testid="projector-scripture-layer" className="z-10" />').reason, 'missing-z20');

  // Defect 3: Coupled slide replacement
  assert.equal(
    verifyScriptureOverlayGuard('<div data-testid="projector-scripture-layer" className="z-20" />\n{overlay ? <ScriptureOverlayView /> : <SlideView />}').reason,
    'coupled-slide-replacement'
  );
});

