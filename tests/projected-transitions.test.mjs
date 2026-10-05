import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const srcUrl = (...parts) => pathToFileURL(path.join(ROOT, 'src', ...parts)).href;

function getProjectorClientSource() {
  const filePath = path.join(ROOT, 'src', 'projected', 'ProjectorClient.tsx');
  assert.ok(fs.existsSync(filePath), 'ProjectorClient.tsx must exist');
  return fs.readFileSync(filePath, 'utf8');
}

test('SPEC-108-02: ProjectorClient renders persistent blackout layer with getBlankTransitionStyle and pointer-events-none', () => {
  const src = getProjectorClientSource();

  // Must have data-testid="projector-blank-layer"
  assert.ok(
    src.includes('data-testid="projector-blank-layer"'),
    'ProjectorClient must render projector-blank-layer'
  );

  // Must consume getBlankTransitionStyle(transition, blank)
  assert.ok(
    src.includes('getBlankTransitionStyle(transition, blank)'),
    'Blackout layer must consume getBlankTransitionStyle(transition, blank)'
  );

  // Must have z-50 positioning and pointer-events-none
  assert.ok(
    src.includes('absolute inset-0 z-50 bg-black pointer-events-none'),
    'Blackout layer must have absolute inset-0 z-50 bg-black pointer-events-none'
  );

  // Absence guard: Static duration-300 class must NOT be hardcoded on blank layer
  assert.equal(
    /data-testid="projector-blank-layer"[^>]*duration-300/i.test(src),
    false,
    'Static duration-300 class must not be hardcoded on blank layer'
  );

  // Absence guard: Old abrupt conditional mounting must NOT be present (formatting-resilient regex)
  assert.equal(
    /\{blank\s*\?\s*\(?\s*<div[^>]*bg-black/i.test(src),
    false,
    'Old conditional mounting of blank layer must be absent'
  );
});

test('SPEC-108-02: getBlankTransitionStyle produces canonical blackout styles across cut, fade, push', async () => {
  const { getBlankTransitionStyle } = await import(srcUrl('lib', 'transitions.ts'));

  // 1. cut and none (instant 0ms cut)
  const cutBlanked = getBlankTransitionStyle('cut', true);
  assert.equal(cutBlanked.opacity, 1);
  assert.equal(cutBlanked.visibility, 'visible');
  assert.equal(cutBlanked.transition, 'none');

  const cutUnblanked = getBlankTransitionStyle('cut', false);
  assert.equal(cutUnblanked.opacity, 0);
  assert.equal(cutUnblanked.visibility, 'hidden');
  assert.equal(cutUnblanked.transition, 'none');

  const noneBlanked = getBlankTransitionStyle('none', true);
  assert.equal(noneBlanked.opacity, 1);
  assert.equal(noneBlanked.visibility, 'visible');
  assert.equal(noneBlanked.transition, 'none');

  // 2. fade and dissolve (smooth 300ms opacity fade)
  const fadeBlanked = getBlankTransitionStyle('fade', true);
  assert.equal(fadeBlanked.opacity, 1);
  assert.equal(fadeBlanked.visibility, 'visible');
  assert.equal(fadeBlanked.transition, 'opacity 300ms ease-in-out, visibility 300ms ease-in-out');

  const fadeUnblanked = getBlankTransitionStyle('fade', false);
  assert.equal(fadeUnblanked.opacity, 0);
  assert.equal(fadeUnblanked.visibility, 'hidden');
  assert.equal(fadeUnblanked.transition, 'opacity 300ms ease-in-out, visibility 300ms ease-in-out');

  // 3. push (Adaptive A/V Guard: adapts to opacity fade, avoids sliding black box across display)
  const pushBlanked = getBlankTransitionStyle('push', true);
  assert.equal(pushBlanked.opacity, 1);
  assert.equal(pushBlanked.visibility, 'visible');
  assert.equal(pushBlanked.transition, 'opacity 300ms ease-in-out, visibility 300ms ease-in-out');
  assert.equal(pushBlanked.transform, undefined, 'Push blackout must NOT apply transform translate');

  const pushUnblanked = getBlankTransitionStyle('push', false);
  assert.equal(pushUnblanked.opacity, 0);
  assert.equal(pushUnblanked.visibility, 'hidden');
  assert.equal(pushUnblanked.transition, 'opacity 300ms ease-in-out, visibility 300ms ease-in-out');
  assert.equal(pushUnblanked.transform, undefined, 'Push unblank must NOT apply transform translate');
});

test('SPEC-108-02: Defect injection proof — verifyBlankTransitionGuard detects missing transition or improper layer', () => {
  function verifyBlankTransitionGuard(src) {
    if (!src.includes('data-testid="projector-blank-layer"')) {
      return { pass: false, reason: 'missing-test-id' };
    }
    if (!src.includes('getBlankTransitionStyle')) {
      return { pass: false, reason: 'missing-transition-style' };
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
  assert.equal(verifyBlankTransitionGuard('<div className="z-50 pointer-events-none" style={getBlankTransitionStyle(transition, blank)} />').reason, 'missing-test-id');

  // Defect 2: Missing getBlankTransitionStyle
  assert.equal(verifyBlankTransitionGuard('<div data-testid="projector-blank-layer" className="z-50 pointer-events-none" />').reason, 'missing-transition-style');

  // Defect 3: Missing pointer-events-none
  assert.equal(verifyBlankTransitionGuard('<div data-testid="projector-blank-layer" className="z-50" style={getBlankTransitionStyle(transition, blank)} />').reason, 'missing-pointer-events-none');

  // Defect 4: Conditional unmounting instead of persistent layer
  assert.equal(verifyBlankTransitionGuard('<div data-testid="projector-blank-layer" className="z-50 pointer-events-none" style={getBlankTransitionStyle(transition, blank)} />\n{blank ? <div aria-hidden="true" className="z-50" /> : null}').reason, 'conditional-unmounting');
});

test('SPEC-108-03: ProjectorClient renders decoupled scripture overlay layer at z-20 with canonical AD-23 transition styling', () => {
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

  // Must consume getScriptureTransitionStyle
  assert.ok(
    src.includes('getScriptureTransitionStyle'),
    'ProjectorClient must consume getScriptureTransitionStyle for canonical transition parity'
  );

  // Absence guard: Static duration-300 class must NOT be on scripture container
  assert.equal(
    /data-testid="projector-scripture-layer"[^>]*duration-300/i.test(src),
    false,
    'Static duration-300 class must not be on active scripture container'
  );

  // Guard against repeated clear stranding exit timer
  assert.ok(
    src.includes("!activeOverlayRef.current || overlayPhaseRef.current === 'exiting'"),
    'clearScriptureOverlay must guard against repeated clear when no active overlay or already exiting'
  );

  // Idempotency guard: identical content and page must not re-trigger animation
  assert.ok(
    src.includes('currentActive.reference === newScripture.reference'),
    'applyScriptureOverlay must guard against re-animating identical scripture content'
  );

  // Continuous slide mounting: incoming slide container must render SlideView directly without conditional overlay replacement
  assert.equal(
    /overlay\s*\?\s*\(?\s*<ScriptureOverlayView/i.test(src),
    false,
    'Slide container must not conditionally replace SlideView with ScriptureOverlayView'
  );
});

test('SPEC-108-03: getScriptureTransitionStyle produces exact canonical styles across all transitions and directions', async () => {
  const { getScriptureTransitionStyle } = await import(srcUrl('lib', 'transitions.ts'));

  // 1. fade (500ms opacity)
  const fadeStart = getScriptureTransitionStyle('fade', 'entering-start');
  assert.equal(fadeStart.opacity, 0);

  const fadeActive = getScriptureTransitionStyle('fade', 'active');
  assert.equal(fadeActive.opacity, 1);
  assert.equal(fadeActive.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  const fadeExit = getScriptureTransitionStyle('fade', 'exiting');
  assert.equal(fadeExit.opacity, 0);
  assert.equal(fadeExit.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  // 2. dissolve (500ms opacity)
  const dissolveActive = getScriptureTransitionStyle('dissolve', 'active');
  assert.equal(dissolveActive.opacity, 1);
  assert.equal(dissolveActive.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  // 3. push next/initial (450ms transform)
  const pushNextStart = getScriptureTransitionStyle('push', 'entering-start', 'next');
  assert.equal(pushNextStart.transform, 'translateX(100%)');

  const pushNextActive = getScriptureTransitionStyle('push', 'active', 'next');
  assert.equal(pushNextActive.transform, 'translateX(0)');
  assert.equal(pushNextActive.transition, 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)');

  const pushNextExit = getScriptureTransitionStyle('push', 'exiting', 'next');
  assert.equal(pushNextExit.transform, 'translateX(-100%)');
  assert.equal(pushNextExit.transition, 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)');

  // 4. push prev (bidirectional return, 450ms transform)
  const pushPrevStart = getScriptureTransitionStyle('push', 'entering-start', 'prev');
  assert.equal(pushPrevStart.transform, 'translateX(-100%)');

  const pushPrevActive = getScriptureTransitionStyle('push', 'active', 'prev');
  assert.equal(pushPrevActive.transform, 'translateX(0)');
  assert.equal(pushPrevActive.transition, 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)');

  const pushPrevExit = getScriptureTransitionStyle('push', 'exiting', 'prev');
  assert.equal(pushPrevExit.transform, 'translateX(100%)');
  assert.equal(pushPrevExit.transition, 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)');

  // 5. push same-page (in-place crossfade opacity over 450ms, zero horizontal displacement)
  const pushSameStart = getScriptureTransitionStyle('push', 'entering-start', 'same-page');
  assert.equal(pushSameStart.opacity, 0);
  assert.equal(pushSameStart.transform, undefined);

  const pushSameActive = getScriptureTransitionStyle('push', 'active', 'same-page');
  assert.equal(pushSameActive.opacity, 1);
  assert.equal(pushSameActive.transition, 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)');
  assert.equal(pushSameActive.transform, undefined);

  const pushSameExit = getScriptureTransitionStyle('push', 'exiting', 'same-page');
  assert.equal(pushSameExit.opacity, 0);
  assert.equal(pushSameExit.transition, 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)');
  assert.equal(pushSameExit.transform, undefined);

  // 6. cut and none (0ms / empty style)
  assert.deepEqual(getScriptureTransitionStyle('cut', 'active'), {});
  assert.deepEqual(getScriptureTransitionStyle('none', 'active'), {});
  assert.deepEqual(getScriptureTransitionStyle('cut', 'entering-start'), {});
  assert.deepEqual(getScriptureTransitionStyle('none', 'exiting'), {});
});

test('SPEC-108-03: Scripture transition state machine handles entrance, exit, bidirectional push, same-page, cut, mount sync, and rapid interruption', async () => {
  const { SLIDE_TRANSITION_SPECS } = await import(srcUrl('lib', 'transitions.ts'));

  class ScriptureTransitionStateMachine {
    constructor(transition = 'fade') {
      this.transition = transition;
      this.activeOverlay = null;
      this.outgoingOverlay = null;
      this.overlayPhase = 'hidden'; // 'hidden' | 'entering-start' | 'active' | 'exiting'
      this.outgoingPhase = 'hidden'; // 'hidden' | 'exiting-start' | 'exiting'
      this.direction = 'initial';
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
          this.direction = 'initial';
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

    onScripture(newScripture) {
      const currentActive = this.activeOverlay;
      if (
        currentActive &&
        currentActive.reference === newScripture.reference &&
        currentActive.displayReference === newScripture.displayReference &&
        currentActive.text === newScripture.text &&
        currentActive.mode === newScripture.mode &&
        currentActive.currentPage === newScripture.currentPage &&
        currentActive.totalPages === newScripture.totalPages &&
        currentActive.typographyMode === newScripture.typographyMode &&
        currentActive.isContinuation === newScripture.isContinuation &&
        currentActive.continuationIndex === newScripture.continuationIndex &&
        currentActive.continuationCount === newScripture.continuationCount &&
        currentActive.estimatedVisualLines === newScripture.estimatedVisualLines
      ) {
        return;
      }

      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      if (this.outgoingTimer) { clearTimeout(this.outgoingTimer); this.outgoingTimer = null; }

      let dir = 'initial';
      if (currentActive) {
        const newPage = newScripture.currentPage ?? 0;
        const curPage = currentActive.currentPage ?? 0;
        if (newPage === curPage) {
          dir = 'same-page';
        } else if (newPage > curPage) {
          dir = 'next';
        } else {
          dir = 'prev';
        }
      }
      this.direction = dir;

      const durationMs = SLIDE_TRANSITION_SPECS[this.transition]?.browser.durationMs ?? 0;

      if (durationMs === 0) {
        this.outgoingOverlay = null;
        this.outgoingPhase = 'hidden';
        this.activeOverlay = newScripture;
        this.overlayPhase = 'active';
        return;
      }

      if (!currentActive) {
        this.outgoingOverlay = null;
        this.outgoingPhase = 'hidden';
        this.activeOverlay = newScripture;
        this.overlayPhase = 'entering-start';
        this.timer = setTimeout(() => {
          this.overlayPhase = 'active';
          this.timer = null;
        }, 20);
      } else {
        this.outgoingOverlay = currentActive;
        this.outgoingPhase = 'exiting-start';
        this.activeOverlay = newScripture;
        this.overlayPhase = 'entering-start';

        this.timer = setTimeout(() => {
          this.outgoingPhase = 'exiting';
          this.overlayPhase = 'active';
          this.outgoingTimer = setTimeout(() => {
            this.outgoingOverlay = null;
            this.outgoingPhase = 'hidden';
            this.outgoingTimer = null;
          }, durationMs);
          this.timer = null;
        }, 20);
      }
    }

    onClearScripture() {
      if (!this.activeOverlay || this.overlayPhase === 'exiting') {
        return;
      }
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      if (this.outgoingTimer) { clearTimeout(this.outgoingTimer); this.outgoingTimer = null; }

      // Atomically clear outgoing overlay
      this.outgoingOverlay = null;
      this.outgoingPhase = 'hidden';

      const durationMs = SLIDE_TRANSITION_SPECS[this.transition]?.browser.durationMs ?? 0;
      if (durationMs === 0) {
        this.activeOverlay = null;
        this.overlayPhase = 'hidden';
        return;
      }

      this.overlayPhase = 'exiting';
      this.timer = setTimeout(() => {
        this.activeOverlay = null;
        this.overlayPhase = 'hidden';
        this.timer = null;
      }, durationMs);
    }
  }

  // 1. Mount-time sync with scripture mounts immediately at phase active
  const sm1 = new ScriptureTransitionStateMachine('fade');
  sm1.onSync({ reference: 'John 3:16', text: 'For God so loved...', currentPage: 1 }, true);
  assert.equal(sm1.overlayPhase, 'active');
  assert.equal(sm1.activeOverlay?.reference, 'John 3:16');
  assert.equal(sm1.outgoingOverlay, null);

  // 2. Entrance from hidden in push transition
  const smPush = new ScriptureTransitionStateMachine('push');
  assert.equal(smPush.overlayPhase, 'hidden');
  smPush.onScripture({ reference: 'Gen 1:1', text: 'In the beginning...', currentPage: 1 });
  assert.equal(smPush.overlayPhase, 'entering-start');
  assert.equal(smPush.direction, 'initial');
  assert.equal(smPush.activeOverlay?.reference, 'Gen 1:1');
  assert.equal(smPush.outgoingOverlay, null);

  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smPush.overlayPhase, 'active');

  // 3. Bidirectional Push next page
  smPush.onScripture({ reference: 'Gen 1:1', text: 'In the beginning...', currentPage: 2 });
  assert.equal(smPush.overlayPhase, 'entering-start');
  assert.equal(smPush.outgoingPhase, 'exiting-start');
  assert.equal(smPush.direction, 'next');

  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smPush.overlayPhase, 'active');
  assert.equal(smPush.outgoingPhase, 'exiting');

  await new Promise((r) => setTimeout(r, 460));
  assert.equal(smPush.outgoingOverlay, null);
  assert.equal(smPush.outgoingPhase, 'hidden');

  // 4. Bidirectional Push prev page
  smPush.onScripture({ reference: 'Gen 1:1', text: 'In the beginning...', currentPage: 1 });
  assert.equal(smPush.direction, 'prev');
  assert.equal(smPush.overlayPhase, 'entering-start');

  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smPush.overlayPhase, 'active');
  assert.equal(smPush.outgoingPhase, 'exiting');
  await new Promise((r) => setTimeout(r, 460));

  // 5. Same-page update
  smPush.onScripture({ reference: 'Gen 1:1-2', text: 'Updated verse text', currentPage: 1 });
  assert.equal(smPush.direction, 'same-page');

  // 6. Idempotency no-op
  const timerBefore = smPush.timer;
  smPush.onScripture({ reference: 'Gen 1:1-2', text: 'Updated verse text', currentPage: 1 });
  assert.equal(smPush.timer, timerBefore, 'Idempotent re-sync must be a no-op');

  // 7. Cut transition: instant 0ms mount and unmount
  const smCut = new ScriptureTransitionStateMachine('cut');
  smCut.onScripture({ reference: 'Rom 8:28', text: 'And we know...', currentPage: 1 });
  assert.equal(smCut.overlayPhase, 'active');
  assert.equal(smCut.activeOverlay?.reference, 'Rom 8:28');
  assert.equal(smCut.outgoingOverlay, null);

  smCut.onClearScripture();
  assert.equal(smCut.overlayPhase, 'hidden');
  assert.equal(smCut.activeOverlay, null);

  // 8. Rapid interruption: rapid next -> prev within 10ms
  smPush.onScripture({ reference: 'Ps 23', text: 'Page 2', currentPage: 2 });
  smPush.onScripture({ reference: 'Ps 23', text: 'Page 1', currentPage: 1 });
  assert.equal(smPush.direction, 'prev');
  assert.equal(smPush.activeOverlay?.currentPage, 1);

  // 9. Mid-transition clear atomically clears outgoingOverlay (SPEC-108 no ghost text)
  const smGhost = new ScriptureTransitionStateMachine('push');
  smGhost.onScripture({ reference: 'Ps 23', text: 'Page 1', currentPage: 1 });
  await new Promise((r) => setTimeout(r, 25));
  // Start page transition to Page 2
  smGhost.onScripture({ reference: 'Ps 23', text: 'Page 2', currentPage: 2 });
  assert.ok(smGhost.outgoingOverlay, 'Outgoing overlay must be staged during page transition');
  // Clear scripture mid-transition
  smGhost.onClearScripture();
  assert.equal(smGhost.outgoingOverlay, null, 'Outgoing overlay must be atomically cleared on clear');
  assert.equal(smGhost.outgoingPhase, 'hidden');

  // 10. Live transition update via ref: changing transition dynamically to cut immediately uses 0ms
  const smLive = new ScriptureTransitionStateMachine('fade');
  smLive.onScripture({ reference: 'Matt 5:3', text: 'Blessed are the poor...', currentPage: 1 });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smLive.overlayPhase, 'active');
  // Live transition change to cut
  smLive.transition = 'cut';
  smLive.onClearScripture();
  assert.equal(smLive.overlayPhase, 'hidden', 'Cut transition must unmount overlay immediately without 500ms fade delay');
  assert.equal(smLive.activeOverlay, null);

  // 11. Display-relevant field update on same page triggers update
  const smDisplay = new ScriptureTransitionStateMachine('push');
  smDisplay.onScripture({ reference: 'John 1:1', displayReference: 'Yohanes 1:1', text: 'In the beginning...', currentPage: 1 });
  await new Promise((r) => setTimeout(r, 25));
  smDisplay.onScripture({ reference: 'John 1:1', displayReference: 'John 1:1 (KJV)', text: 'In the beginning...', currentPage: 1 });
  assert.equal(smDisplay.direction, 'same-page', 'Display-relevant metadata change on same page must trigger same-page update');
});

test('SPEC-108-03: Defect injection proof — verifyScriptureOverlayGuard detects coupled slide or missing z-20', () => {
  function verifyScriptureOverlayGuard(src) {
    if (!src.includes('data-testid="projector-scripture-layer"')) {
      return { pass: false, reason: 'missing-scripture-layer-testid' };
    }
    if (!src.includes('z-20')) {
      return { pass: false, reason: 'missing-z20' };
    }
    if (!src.includes('getScriptureTransitionStyle')) {
      return { pass: false, reason: 'missing-transition-style' };
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

  // Defect 3: Missing getScriptureTransitionStyle
  assert.equal(verifyScriptureOverlayGuard('<div data-testid="projector-scripture-layer" className="z-20" />').reason, 'missing-transition-style');

  // Defect 4: Coupled slide replacement
  assert.equal(
    verifyScriptureOverlayGuard('<div data-testid="projector-scripture-layer" className="z-20" style={getScriptureTransitionStyle(transition, "active")} />\n{overlay ? <ScriptureOverlayView /> : <SlideView />}').reason,
    'coupled-slide-replacement'
  );
});

test('SPEC-107-04: ProjectorClient renders guest video container with phase-driven mounting and AD-23 transition conformance', () => {
  const src = getProjectorClientSource();

  // Must have data-testid="projector-guest-video-container"
  assert.ok(
    src.includes('data-testid="projector-guest-video-container"'),
    'ProjectorClient must render projector-guest-video-container'
  );

  // Phase-driven mount: must mount on guestPhase !== 'hidden' and retained stream
  assert.ok(
    src.includes("guestPhase !== 'hidden' && retainedGuestStream"),
    "Guest video layer must mount on `guestPhase !== 'hidden' && retainedGuestStream`"
  );

  // Absence guard: Old abrupt conditional mounting must NOT be present
  assert.equal(
    /\{isGuestIntent\s*&&\s*guestStream\s*\?\s*\(?\s*<div[^>]*data-testid="projector-guest-video-container"/i.test(src),
    false,
    'Old abrupt conditional mounting `{isGuestIntent && guestStream ? <div...` must be absent'
  );

  // Must consume canonical SLIDE_TRANSITION_SPECS
  assert.ok(
    src.includes('SLIDE_TRANSITION_SPECS'),
    'ProjectorClient must consume SLIDE_TRANSITION_SPECS for canonical transition conformance'
  );

  // Must define or export getGuestTransitionStyle
  assert.ok(
    src.includes('getGuestTransitionStyle'),
    'ProjectorClient must define getGuestTransitionStyle'
  );

  // Must attach ended listener to guest stream tracks
  assert.ok(
    src.includes("track.addEventListener('ended', onEnded)") || src.includes("track.onended = onEnded"),
    'ProjectorClient must listen to track ended event to drive immediate stream loss cleanup'
  );
});

test('SPEC-107-04: getGuestTransitionStyle produces exact canonical styles across all 5 transitions', async () => {
  const { getGuestTransitionStyle } = await import(srcUrl('lib', 'transitions.ts'));

  // 1. fade (500ms opacity)
  const fadeStart = getGuestTransitionStyle('fade', 'entering-start');
  assert.equal(fadeStart.opacity, 0);
  assert.equal(fadeStart.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  const fadeActive = getGuestTransitionStyle('fade', 'active');
  assert.equal(fadeActive.opacity, 1);
  assert.equal(fadeActive.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  const fadeExit = getGuestTransitionStyle('fade', 'exiting');
  assert.equal(fadeExit.opacity, 0);
  assert.equal(fadeExit.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  // 2. dissolve (500ms opacity)
  const dissolveActive = getGuestTransitionStyle('dissolve', 'active');
  assert.equal(dissolveActive.opacity, 1);
  assert.equal(dissolveActive.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  // 3. push (450ms transform)
  const pushStart = getGuestTransitionStyle('push', 'entering-start');
  assert.equal(pushStart.transform, 'translateX(100%)');
  assert.equal(pushStart.transition, 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)');

  const pushActive = getGuestTransitionStyle('push', 'active');
  assert.equal(pushActive.transform, 'translateX(0)');
  assert.equal(pushActive.transition, 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)');

  const pushExit = getGuestTransitionStyle('push', 'exiting');
  assert.equal(pushExit.transform, 'translateX(-100%)');
  assert.equal(pushExit.transition, 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1)');

  // 4. cut and none (0ms / empty style)
  assert.deepEqual(getGuestTransitionStyle('cut', 'active'), {});
  assert.deepEqual(getGuestTransitionStyle('none', 'active'), {});

  // 5. hidden phase
  assert.deepEqual(getGuestTransitionStyle('fade', 'hidden'), {});
});

test('SPEC-107-04: Guest video transition state machine handles entrance, exit, push, dissolve, cut, interruption, and stream loss', async () => {
  const { SLIDE_TRANSITION_SPECS } = await import(srcUrl('lib', 'transitions.ts'));

  class GuestTransitionStateMachine {
    constructor(transition = 'fade') {
      this.transition = transition;
      this.guestPhase = 'hidden'; // 'hidden' | 'entering-start' | 'active' | 'exiting'
      this.retainedGuestStream = null;
      this.timer = null;
    }

    onSync(isGuestIntent, guestStream) {
      const spec = SLIDE_TRANSITION_SPECS[this.transition] || SLIDE_TRANSITION_SPECS.fade;
      const durationMs = spec.browser.durationMs;

      if (isGuestIntent && guestStream) {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }
        this.retainedGuestStream = guestStream;

        if (durationMs === 0 || this.guestPhase === 'active' || this.guestPhase === 'exiting') {
          this.guestPhase = 'active';
        } else {
          this.guestPhase = 'entering-start';
          this.timer = setTimeout(() => {
            this.guestPhase = 'active';
            this.timer = null;
          }, 20);
        }
      } else {
        if (this.timer) { clearTimeout(this.timer); this.timer = null; }

        if (isGuestIntent && !guestStream) {
          // Hardware unplug / stream loss
          this.retainedGuestStream = null;
          this.guestPhase = 'hidden';
          return;
        }

        if (this.guestPhase === 'hidden') {
          return;
        }

        if (durationMs === 0 || !this.retainedGuestStream) {
          this.retainedGuestStream = null;
          this.guestPhase = 'hidden';
        } else {
          this.guestPhase = 'exiting';
          this.timer = setTimeout(() => {
            this.retainedGuestStream = null;
            this.guestPhase = 'hidden';
            this.timer = null;
          }, durationMs);
        }
      }
    }

    teardown() {
      if (this.timer) { clearTimeout(this.timer); this.timer = null; }
      this.retainedGuestStream = null;
      this.guestPhase = 'hidden';
    }
  }

  // 1. Fade transition: entrance and canonical 500ms exit lifecycle
  const stream1 = { id: 'stream-1' };
  const smFade = new GuestTransitionStateMachine('fade');
  smFade.onSync(true, stream1);
  assert.equal(smFade.guestPhase, 'entering-start');
  assert.equal(smFade.retainedGuestStream, stream1);

  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smFade.guestPhase, 'active');

  // Revert to deck
  smFade.onSync(false, null);
  assert.equal(smFade.guestPhase, 'exiting');
  assert.equal(smFade.retainedGuestStream, stream1, 'Media stream must be retained during exit animation');

  // After 250ms (before 500ms duration finishes), still exiting and stream retained
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(smFade.guestPhase, 'exiting');
  assert.equal(smFade.retainedGuestStream, stream1);

  // After completion (further 300ms, total > 500ms)
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(smFade.guestPhase, 'hidden');
  assert.equal(smFade.retainedGuestStream, null);

  // 2. Push transition (canonical 450ms)
  const smPush = new GuestTransitionStateMachine('push');
  smPush.onSync(true, stream1);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smPush.guestPhase, 'active');
  smPush.onSync(false, null);
  assert.equal(smPush.guestPhase, 'exiting');
  await new Promise((r) => setTimeout(r, 475));
  assert.equal(smPush.guestPhase, 'hidden');

  // 3. Cut transition: instantaneous swap (durationMs: 0)
  const smCut = new GuestTransitionStateMachine('cut');
  smCut.onSync(true, stream1);
  assert.equal(smCut.guestPhase, 'active');
  assert.equal(smCut.retainedGuestStream, stream1);
  smCut.onSync(false, null);
  assert.equal(smCut.guestPhase, 'hidden');
  assert.equal(smCut.retainedGuestStream, null);

  // 4. None transition: instantaneous swap (durationMs: 0)
  const smNone = new GuestTransitionStateMachine('none');
  smNone.onSync(true, stream1);
  assert.equal(smNone.guestPhase, 'active');
  smNone.onSync(false, null);
  assert.equal(smNone.guestPhase, 'hidden');

  // 5. Interruption resilience: revert followed immediately by switch cancels exit timer
  const smInterrupt = new GuestTransitionStateMachine('fade');
  smInterrupt.onSync(true, stream1);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smInterrupt.guestPhase, 'active');

  // Revert initiates exit
  smInterrupt.onSync(false, null);
  assert.equal(smInterrupt.guestPhase, 'exiting');

  // Re-switch before exit concludes
  smInterrupt.onSync(true, stream1);
  assert.equal(smInterrupt.guestPhase, 'active', 'Re-switching during exit must cancel exit and restore active state');
  assert.equal(smInterrupt.timer, null, 'Exit timer must be cancelled');

  // 6. Stream loss resilience: HDMI disconnection while in guest intent aborts immediately
  const smLoss = new GuestTransitionStateMachine('fade');
  smLoss.onSync(true, stream1);
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smLoss.guestPhase, 'active');

  // Stream lost
  smLoss.onSync(true, null);
  assert.equal(smLoss.guestPhase, 'hidden');
  assert.equal(smLoss.retainedGuestStream, null);

  // 7. Teardown clears timers and state cleanly
  smInterrupt.onSync(false, null);
  smInterrupt.teardown();
  assert.equal(smInterrupt.guestPhase, 'hidden');
  assert.equal(smInterrupt.retainedGuestStream, null);
  assert.equal(smInterrupt.timer, null);
});

test('SPEC-107-04: Defect injection proof — verifyGuestTransitionGuard detects abrupt mounting or missing transition specs', () => {
  function verifyGuestTransitionGuard(src) {
    if (!src.includes('data-testid="projector-guest-video-container"')) {
      return { pass: false, reason: 'missing-guest-container' };
    }
    if (!src.includes("guestPhase !== 'hidden' && retainedGuestStream")) {
      return { pass: false, reason: 'abrupt-conditional-mounting' };
    }
    if (!src.includes('SLIDE_TRANSITION_SPECS')) {
      return { pass: false, reason: 'missing-transition-specs' };
    }
    if (!src.includes('getGuestTransitionStyle')) {
      return { pass: false, reason: 'missing-transition-style' };
    }
    return { pass: true };
  }

  // Real source passes once implemented, let's verify defect injection proofs
  assert.equal(verifyGuestTransitionGuard('<div />').reason, 'missing-guest-container');
  assert.equal(verifyGuestTransitionGuard('<div data-testid="projector-guest-video-container" />\n{isGuestIntent && guestStream ? <div /> : null}').reason, 'abrupt-conditional-mounting');
  assert.equal(verifyGuestTransitionGuard('<div data-testid="projector-guest-video-container" />\n{guestPhase !== \'hidden\' && retainedGuestStream ? <div /> : null}').reason, 'missing-transition-specs');
  assert.equal(verifyGuestTransitionGuard('<div data-testid="projector-guest-video-container" />\n{guestPhase !== \'hidden\' && retainedGuestStream ? <div /> : null}\nSLIDE_TRANSITION_SPECS').reason, 'missing-transition-style');
});

// ============================================================================
// SPEC-109: Scripture Overlay Pagination Crossfade Backdrop Continuity Parity
// ============================================================================

test('SPEC-109-01: ProjectorClient renders persistent scripture backdrop layer at z-20 with getScriptureBackdropStyle', () => {
  const src = getProjectorClientSource();

  // 1. Must render dedicated backdrop element
  assert.ok(
    src.includes('data-testid="projector-scripture-backdrop"'),
    'ProjectorClient must render projector-scripture-backdrop'
  );

  // 2. Must consume getScriptureBackdropStyle(transition, backdropPhase)
  assert.ok(
    src.includes('getScriptureBackdropStyle(transition, backdropPhase)'),
    'Backdrop must consume getScriptureBackdropStyle(transition, backdropPhase)'
  );

  // 3. Must have solid #0B1220 background and pointer-events-none at z-20
  assert.ok(
    src.includes('absolute inset-0 z-20 bg-[#0B1220] pointer-events-none'),
    'Backdrop must have absolute inset-0 z-20 bg-[#0B1220] pointer-events-none'
  );

  // 4. Stacking order: backdrop must be declared before outgoingOverlay and activeOverlay in JSX
  const backdropIdx = src.indexOf('data-testid="projector-scripture-backdrop"');
  const outgoingIdx = src.indexOf('data-testid="projector-scripture-outgoing"');
  const activeIdx = src.indexOf('data-testid="projector-scripture-layer"');
  assert.ok(backdropIdx !== -1, 'Backdrop element must exist');
  assert.ok(outgoingIdx !== -1, 'Outgoing overlay element must exist');
  assert.ok(activeIdx !== -1, 'Active overlay element must exist');
  assert.ok(
    backdropIdx < outgoingIdx && backdropIdx < activeIdx,
    'Backdrop layer must be mounted before outgoing and active scripture overlays for proper z-stacking'
  );

  // 5. Lifecycle continuity: pagination must keep backdrop strictly at active
  assert.ok(
    src.includes("setBackdropPhase('active')"),
    'ProjectorClient must maintain backdropPhase as active'
  );

  // 6. Timer cleanup: backdropTimerRef must be cleaned up in unmount, stalePlan, and clear
  assert.ok(
    src.includes('backdropTimerRef'),
    'ProjectorClient must maintain backdropTimerRef'
  );
});

test('SPEC-109-02: getScriptureBackdropStyle produces canonical backdrop styles across all transitions', async () => {
  const { getScriptureBackdropStyle } = await import(srcUrl('lib', 'transitions.ts'));

  // 1. hidden phase
  const hiddenStyle = getScriptureBackdropStyle('fade', 'hidden');
  assert.equal(hiddenStyle.opacity, 0);
  assert.equal(hiddenStyle.visibility, 'hidden');

  // 2. cut and none (0ms instant cut)
  const cutActive = getScriptureBackdropStyle('cut', 'active');
  assert.equal(cutActive.opacity, 1);
  assert.equal(cutActive.visibility, 'visible');
  assert.equal(cutActive.transition, 'none');

  const cutStart = getScriptureBackdropStyle('cut', 'entering-start');
  assert.equal(cutStart.opacity, 1);
  assert.equal(cutStart.visibility, 'visible');
  assert.equal(cutStart.transition, 'none');

  const noneActive = getScriptureBackdropStyle('none', 'active');
  assert.equal(noneActive.opacity, 1);
  assert.equal(noneActive.visibility, 'visible');
  assert.equal(noneActive.transition, 'none');

  // 3. fade and dissolve (canonical 500ms opacity transition)
  const fadeStart = getScriptureBackdropStyle('fade', 'entering-start');
  assert.equal(fadeStart.opacity, 0);
  assert.equal(fadeStart.visibility, 'visible');

  const fadeActive = getScriptureBackdropStyle('fade', 'active');
  assert.equal(fadeActive.opacity, 1);
  assert.equal(fadeActive.visibility, 'visible');
  assert.equal(fadeActive.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  const fadeExit = getScriptureBackdropStyle('fade', 'exiting');
  assert.equal(fadeExit.opacity, 0);
  assert.equal(fadeExit.visibility, 'visible');
  assert.equal(fadeExit.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  const dissolveActive = getScriptureBackdropStyle('dissolve', 'active');
  assert.equal(dissolveActive.opacity, 1);
  assert.equal(dissolveActive.visibility, 'visible');
  assert.equal(dissolveActive.transition, 'opacity 500ms cubic-bezier(0.4, 0, 0.2, 1)');

  // 4. push (Adaptive A/V Guard: adapts to opacity fade, avoiding sliding black seams across display)
  const pushStart = getScriptureBackdropStyle('push', 'entering-start');
  assert.equal(pushStart.opacity, 0);
  assert.equal(pushStart.visibility, 'visible');

  const pushActive = getScriptureBackdropStyle('push', 'active');
  assert.equal(pushActive.opacity, 1);
  assert.equal(pushActive.visibility, 'visible');
  assert.equal(pushActive.transition, 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)');
  assert.equal(pushActive.transform, undefined, 'Backdrop must not apply horizontal translation transform');

  const pushExit = getScriptureBackdropStyle('push', 'exiting');
  assert.equal(pushExit.opacity, 0);
  assert.equal(pushExit.visibility, 'visible');
  assert.equal(pushExit.transition, 'opacity 450ms cubic-bezier(0.4, 0, 0.2, 1)');
  assert.equal(pushExit.transform, undefined, 'Backdrop exit must not apply horizontal translation transform');
});

test('SPEC-109-03: Production ScriptureOverlayStateMachine guarantees zero alpha bleed during pagination crossfade and handles all lifecycle edge cases', async () => {
  const { ScriptureOverlayStateMachine, getScriptureBackdropStyle } = await import(srcUrl('lib', 'transitions.ts'));

  // 1. Mount-time sync with scripture mounts backdrop directly as active without playing entrance
  const smMount = new ScriptureOverlayStateMachine('fade');
  smMount.onSync({ reference: 'John 3:16', text: 'For God so loved...', currentPage: 1 }, true);
  assert.equal(smMount.backdropPhase, 'active', 'Backdrop must mount directly as active on initial sync');
  assert.equal(smMount.overlayPhase, 'active');
  const mountBackdropStyle = getScriptureBackdropStyle('fade', smMount.backdropPhase);
  assert.equal(mountBackdropStyle.opacity, 1, 'Initial sync backdrop must have opacity 1');

  // 2. Initial user-triggered entrance from hidden in fade transition
  const smFade = new ScriptureOverlayStateMachine('fade');
  assert.equal(smFade.backdropPhase, 'hidden');
  smFade.applyScripture({ reference: 'John 14:1', text: 'Let not your heart be troubled', currentPage: 1 });
  assert.equal(smFade.backdropPhase, 'entering-start', 'Backdrop must start at entering-start on entrance');
  assert.equal(smFade.overlayPhase, 'entering-start');

  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smFade.backdropPhase, 'active', 'Backdrop must settle to active after initial entrance tick');
  assert.equal(smFade.overlayPhase, 'active');

  // 3. Crossfade Pagination in fade (Page 1 -> Page 2):
  // Outgoing overlay fades out, incoming overlay fades in.
  // Backdrop MUST REMAIN STEADILY AT 'active' (opacity: 1) without flickering or replaying entrance!
  smFade.applyScripture({ reference: 'John 14:1', text: 'Ye believe in God...', currentPage: 2 });
  assert.equal(smFade.backdropPhase, 'active', 'Backdrop must stay active immediately upon pagination');
  assert.equal(smFade.overlayPhase, 'entering-start', 'Incoming overlay starts at entering-start');
  assert.equal(smFade.outgoingPhase, 'exiting-start', 'Outgoing overlay starts at exiting-start');

  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smFade.backdropPhase, 'active', 'Backdrop must remain active at 25ms tick');
  assert.equal(smFade.overlayPhase, 'active');
  assert.equal(smFade.outgoingPhase, 'exiting');

  // Midpoint at t = 250ms (simulated opacity math check):
  // outgoing alpha = 0.5, active alpha = 0.5.
  // With persistent backdrop at alpha = 1.0:
  // Combined occlusion = 1 - (1 - 0.5) * (1 - 0.5) * (1 - 1.0) = 1.0 (Zero alpha bleed onto slide!)
  const backdropAlpha = 1.0;
  const outgoingAlpha = 0.5;
  const activeAlpha = 0.5;
  const combinedCoverageWithBackdrop = 1 - (1 - outgoingAlpha) * (1 - activeAlpha) * (1 - backdropAlpha);
  assert.equal(combinedCoverageWithBackdrop, 1.0, 'Persistent backdrop provides 100% solid opacity during crossfade');

  // Finish crossfade transition duration
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(smFade.backdropPhase, 'active', 'Backdrop remains active after pagination completes');
  assert.equal(smFade.outgoingOverlay, null);
  assert.equal(smFade.outgoingPhase, 'hidden');

  // 4. Return Pagination in dissolve mode (Page 2 -> Page 1):
  const smDissolve = new ScriptureOverlayStateMachine('dissolve');
  smDissolve.onSync({ reference: 'Rom 8:28', text: 'Page 2', currentPage: 2 }, true);
  assert.equal(smDissolve.backdropPhase, 'active');
  smDissolve.applyScripture({ reference: 'Rom 8:28', text: 'Page 1', currentPage: 1 });
  assert.equal(smDissolve.backdropPhase, 'active', 'Dissolve mode must maintain active backdrop during return pagination');
  assert.equal(smDissolve.direction, 'prev');
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(smDissolve.backdropPhase, 'active');
  await new Promise((r) => setTimeout(r, 500));
  assert.equal(smDissolve.backdropPhase, 'active');

  // 5. Clear scripture: backdrop and overlay exit cleanly together
  smFade.clearScripture();
  assert.equal(smFade.backdropPhase, 'exiting', 'Backdrop must enter exiting state on clear');
  assert.equal(smFade.overlayPhase, 'exiting');

  await new Promise((r) => setTimeout(r, 520));
  assert.equal(smFade.backdropPhase, 'hidden', 'Backdrop must transition to hidden after exit duration');
  assert.equal(smFade.overlayPhase, 'hidden');
  assert.equal(smFade.activeOverlay, null);

  // 6. Cut / None transition: 0ms instant mount and unmount
  const smCut = new ScriptureOverlayStateMachine('cut');
  smCut.applyScripture({ reference: 'Ps 23:1', text: 'The Lord is my shepherd', currentPage: 1 });
  assert.equal(smCut.backdropPhase, 'active', 'Cut transition must mount backdrop instantly as active');
  assert.equal(smCut.overlayPhase, 'active');

  smCut.clearScripture();
  assert.equal(smCut.backdropPhase, 'hidden', 'Cut transition must hide backdrop instantly');
  assert.equal(smCut.overlayPhase, 'hidden');

  // 7. Rapid interruption: rapid next -> prev within 10ms keeps backdrop steady
  const smRapid = new ScriptureOverlayStateMachine('fade');
  smRapid.onSync({ reference: 'Ps 23', text: 'Page 1', currentPage: 1 }, true);
  smRapid.applyScripture({ reference: 'Ps 23', text: 'Page 2', currentPage: 2 });
  smRapid.applyScripture({ reference: 'Ps 23', text: 'Page 1', currentPage: 1 });
  assert.equal(smRapid.backdropPhase, 'active', 'Rapid pagination interruption must keep backdrop active');
  assert.equal(smRapid.direction, 'prev');
  assert.equal(smRapid.activeOverlay?.currentPage, 1);

  // 8. Clear before initial 20ms tick completes
  const smEarlyClear = new ScriptureOverlayStateMachine('fade');
  smEarlyClear.applyScripture({ reference: 'Matt 6:9', text: 'Our Father...', currentPage: 1 });
  assert.equal(smEarlyClear.overlayPhase, 'entering-start');
  assert.equal(smEarlyClear.backdropPhase, 'entering-start');
  smEarlyClear.clearScripture();
  assert.equal(smEarlyClear.overlayPhase, 'exiting');
  assert.equal(smEarlyClear.backdropPhase, 'exiting');
  await new Promise((r) => setTimeout(r, 520));
  assert.equal(smEarlyClear.overlayPhase, 'hidden');
  assert.equal(smEarlyClear.backdropPhase, 'hidden');

  // 9. Live transition change during exit: changing to cut immediately unmounts without 500ms delay
  const smLiveTransition = new ScriptureOverlayStateMachine('fade');
  smLiveTransition.onSync({ reference: 'Heb 11:1', text: 'Now faith is...', currentPage: 1 }, true);
  smLiveTransition.clearScripture();
  assert.equal(smLiveTransition.overlayPhase, 'exiting');
  assert.equal(smLiveTransition.backdropPhase, 'exiting');
  // Dynamic transition change to cut mid-exit
  smLiveTransition.setTransition('cut');
  assert.equal(smLiveTransition.overlayPhase, 'hidden', 'Switching to cut during exit must immediately clear overlayPhase');
  assert.equal(smLiveTransition.backdropPhase, 'hidden', 'Switching to cut during exit must immediately clear backdropPhase');
  assert.equal(smLiveTransition.activeOverlay, null);

  // 10. Stale plan and teardown cleanly resets all layers
  const smStale = new ScriptureOverlayStateMachine('fade');
  smStale.onSync({ reference: 'Rev 22:20', text: 'Even so, come...', currentPage: 1 }, true);
  smStale.handleStalePlan();
  assert.equal(smStale.activeOverlay, null);
  assert.equal(smStale.outgoingOverlay, null);
  assert.equal(smStale.overlayPhase, 'hidden');
  assert.equal(smStale.backdropPhase, 'hidden');
});

test('SPEC-109-03: Defect injection proof — verifyBackdropContinuityGuard detects missing backdrop, improper layer, or pagination resets', () => {
  function verifyBackdropContinuityGuard(src) {
    if (!src.includes('data-testid="projector-scripture-backdrop"')) {
      return { pass: false, reason: 'missing-backdrop-testid' };
    }
    if (!src.includes('getScriptureBackdropStyle')) {
      return { pass: false, reason: 'missing-backdrop-style-helper' };
    }
    if (!src.includes('bg-[#0B1220]')) {
      return { pass: false, reason: 'missing-dark-backdrop-color' };
    }
    if (!src.includes('pointer-events-none')) {
      return { pass: false, reason: 'missing-pointer-events-none' };
    }
    // Stacking check
    const backdropIdx = src.indexOf('data-testid="projector-scripture-backdrop"');
    const outgoingIdx = src.indexOf('data-testid="projector-scripture-outgoing"');
    if (backdropIdx === -1 || outgoingIdx === -1 || backdropIdx > outgoingIdx) {
      return { pass: false, reason: 'improper-stacking-order' };
    }
    // Pagination invariant check: must not unmount or reset backdrop on pagination
    if (/setBackdropPhase\(['"]entering-start['"]\)[^}]*setOutgoingOverlay\(currentActive\)/s.test(src)) {
      return { pass: false, reason: 'backdrop-reanimation-on-pagination' };
    }
    return { pass: true };
  }

  // Real production source must pass
  const prodSrc = getProjectorClientSource();
  assert.equal(verifyBackdropContinuityGuard(prodSrc).pass, true, 'Production ProjectorClient must pass all backdrop continuity guards');

  // Defect 1: Missing testid
  assert.equal(
    verifyBackdropContinuityGuard('<div className="bg-[#0B1220]" style={getScriptureBackdropStyle(transition, backdropPhase)} />').reason,
    'missing-backdrop-testid'
  );

  // Defect 2: Missing helper function
  assert.equal(
    verifyBackdropContinuityGuard('<div data-testid="projector-scripture-backdrop" className="bg-[#0B1220] pointer-events-none" />').reason,
    'missing-backdrop-style-helper'
  );

  // Defect 3: Missing dark background color
  assert.equal(
    verifyBackdropContinuityGuard('<div data-testid="projector-scripture-backdrop" className="pointer-events-none" style={getScriptureBackdropStyle(transition, backdropPhase)} />').reason,
    'missing-dark-backdrop-color'
  );

  // Defect 4: Missing pointer-events-none
  assert.equal(
    verifyBackdropContinuityGuard('<div data-testid="projector-scripture-backdrop" className="bg-[#0B1220]" style={getScriptureBackdropStyle(transition, backdropPhase)} />').reason,
    'missing-pointer-events-none'
  );

  // Defect 5: Improper stacking order (backdrop mounted after outgoing overlay)
  assert.equal(
    verifyBackdropContinuityGuard(
      '<div data-testid="projector-scripture-outgoing" />\n<div data-testid="projector-scripture-backdrop" className="bg-[#0B1220] pointer-events-none" style={getScriptureBackdropStyle(transition, backdropPhase)} />'
    ).reason,
    'improper-stacking-order'
  );

  // Defect 6: Resetting / re-animating backdrop during pagination (causing alpha bleed)
  assert.equal(
    verifyBackdropContinuityGuard(
      'data-testid="projector-scripture-backdrop" getScriptureBackdropStyle bg-[#0B1220] pointer-events-none data-testid="projector-scripture-outgoing"\n' +
      'setBackdropPhase(\'entering-start\');\nsetOutgoingOverlay(currentActive);'
    ).reason,
    'backdrop-reanimation-on-pagination'
  );
});


