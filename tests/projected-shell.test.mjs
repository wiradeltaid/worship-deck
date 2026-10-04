import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (...parts) => pathToFileURL(path.join(repoRoot, ...parts)).href;
const { claimProjectedShell, resetProjectedShellForTest } = await import(
  source('src', 'lib', 'projected-shell.ts')
);
const { isInteractiveOrEditableElement, isValidNavMessage } = await import(
  source('src', 'lib', 'present-channel.ts')
);

afterEach(() => resetProjectedShellForTest());

function documentStub(label) {
  return {
    documentElement: {
      style: {
        overflow: `${label}-root-overflow`,
        scrollbarGutter: `${label}-gutter`,
        backgroundColor: `${label}-root-background`,
      },
    },
    body: {
      style: {
        overflow: `${label}-body-overflow`,
        scrollbarGutter: '',
        backgroundColor: `${label}-body-background`,
      },
    },
  };
}

function assertClaimed(doc) {
  assert.equal(doc.documentElement.style.overflow, 'hidden');
  assert.equal(doc.body.style.overflow, 'hidden');
  assert.equal(doc.documentElement.style.scrollbarGutter, 'auto');
  assert.equal(doc.documentElement.style.backgroundColor, '#000000');
  assert.equal(doc.body.style.backgroundColor, '#000000');
}

function assertRestored(doc, label) {
  assert.equal(doc.documentElement.style.overflow, `${label}-root-overflow`);
  assert.equal(doc.body.style.overflow, `${label}-body-overflow`);
  assert.equal(doc.documentElement.style.scrollbarGutter, `${label}-gutter`);
  assert.equal(doc.documentElement.style.backgroundColor, `${label}-root-background`);
  assert.equal(doc.body.style.backgroundColor, `${label}-body-background`);
}

test('Story 17.7: distinct documents keep independent nested claims and restores', () => {
  const first = documentStub('first');
  const second = documentStub('second');

  const releaseFirstOuter = claimProjectedShell(first);
  const releaseFirstInner = claimProjectedShell(first);
  const releaseSecond = claimProjectedShell(second);

  assertClaimed(first);
  assertClaimed(second);

  releaseFirstOuter();
  assertClaimed(first);
  assertClaimed(second);

  releaseSecond();
  assertRestored(second, 'second');
  assertClaimed(first);

  releaseFirstInner();
  assertRestored(first, 'first');
  assertRestored(second, 'second');
});

test('Story 17.7: reset restores every claimed document exactly once', () => {
  const first = documentStub('first');
  const second = documentStub('second');
  const staleFirst = claimProjectedShell(first);
  const staleSecond = claimProjectedShell(second);

  resetProjectedShellForTest();
  assertRestored(first, 'first');
  assertRestored(second, 'second');

  staleFirst();
  staleSecond();
  assertRestored(first, 'first');
  assertRestored(second, 'second');
});

test('SPEC-103-03: isInteractiveOrEditableElement suppresses navigation on all forms of interactive elements', () => {
  // Direct tags
  assert.equal(isInteractiveOrEditableElement({ tagName: 'BUTTON' }), true);
  assert.equal(isInteractiveOrEditableElement({ tagName: 'A' }), true);
  assert.equal(isInteractiveOrEditableElement({ tagName: 'INPUT' }), true);
  assert.equal(isInteractiveOrEditableElement({ tagName: 'TEXTAREA' }), true);
  assert.equal(isInteractiveOrEditableElement({ tagName: 'SELECT' }), true);
  assert.equal(isInteractiveOrEditableElement({ isContentEditable: true }), true);

  // Nested descendant within interactive parent (e.g. <span> inside <button>)
  const nestedInButton = {
    tagName: 'SPAN',
    closest: (selector) => (selector.includes('button') ? { tagName: 'BUTTON' } : null),
  };
  assert.equal(isInteractiveOrEditableElement(nestedInButton), true);

  const nestedInRoleLink = {
    tagName: 'I',
    closest: (selector) => (selector.includes('[role="link"]') ? { tagName: 'DIV' } : null),
  };
  assert.equal(isInteractiveOrEditableElement(nestedInRoleLink), true);

  // Explicit role="button" and a[href] checks
  const nestedInRoleButton = {
    tagName: 'SPAN',
    closest: (selector) => (selector.includes('[role="button"]') ? { tagName: 'DIV' } : null),
  };
  assert.equal(isInteractiveOrEditableElement(nestedInRoleButton), true);

  const nestedInHrefLink = {
    tagName: 'SPAN',
    closest: (selector) => (selector.includes('a[href]') ? { tagName: 'A' } : null),
  };
  assert.equal(isInteractiveOrEditableElement(nestedInHrefLink), true);

  // Non-interactive plain elements
  const plainDiv = { tagName: 'DIV', closest: () => null };
  assert.equal(isInteractiveOrEditableElement(plainDiv), false);
  assert.equal(isInteractiveOrEditableElement(null), false);
});

test('SPEC-103-03: Projector keydown dispatcher emits nav-next and nav-prev with modifier and target guards', () => {
  const dispatched = [];
  const channel = {
    postMessage: (m) => dispatched.push(m),
  };

  function createKeydownHandler(serviceId, planIdentity, ch) {
    return (e) => {
      if (e.key === 'F11') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (isInteractiveOrEditableElement(e.target)) {
        return;
      }

      if (e.key === ' ' || e.key === 'Spacebar' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        ch?.postMessage({
          type: 'nav-next',
          serviceId: String(serviceId),
          planIdentity,
        });
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        ch?.postMessage({
          type: 'nav-prev',
          serviceId: String(serviceId),
          planIdentity,
        });
      }
    };
  }

  const handler = createKeydownHandler(10, 'plan-uuid-1', channel);

  // 1. Next slide keys: Space, ArrowRight, PageDown
  let prevented = false;
  handler({ key: ' ', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(dispatched[0], { type: 'nav-next', serviceId: '10', planIdentity: 'plan-uuid-1' });

  prevented = false;
  handler({ key: 'ArrowRight', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(dispatched[1], { type: 'nav-next', serviceId: '10', planIdentity: 'plan-uuid-1' });

  prevented = false;
  handler({ key: 'PageDown', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(dispatched[2], { type: 'nav-next', serviceId: '10', planIdentity: 'plan-uuid-1' });

  // 2. Previous slide keys: ArrowLeft, PageUp
  prevented = false;
  handler({ key: 'ArrowLeft', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(dispatched[3], { type: 'nav-prev', serviceId: '10', planIdentity: 'plan-uuid-1' });

  prevented = false;
  handler({ key: 'PageUp', preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(dispatched[4], { type: 'nav-prev', serviceId: '10', planIdentity: 'plan-uuid-1' });

  assert.equal(dispatched.length, 5);

  // 3. Modifier chords are ignored and not prevented
  prevented = false;
  handler({ key: ' ', ctrlKey: true, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(dispatched.length, 5);

  prevented = false;
  handler({ key: 'ArrowRight', altKey: true, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(dispatched.length, 5);

  // 4. Interactive elements (INPUT, TEXTAREA, SELECT, BUTTON, contentEditable, closest descendant) are ignored
  prevented = false;
  handler({ key: ' ', target: { tagName: 'INPUT' }, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);

  prevented = false;
  handler({ key: 'ArrowLeft', target: { tagName: 'BUTTON' }, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);

  prevented = false;
  handler({ key: 'ArrowLeft', target: { tagName: 'SELECT' }, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);

  prevented = false;
  handler({
    key: 'PageDown',
    target: { tagName: 'SPAN', closest: () => ({ tagName: 'BUTTON' }) },
    preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, false);

  prevented = false;
  handler({ key: 'PageDown', target: { isContentEditable: true }, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(dispatched.length, 5);
});

function validateProjectorNavGuards(projectorSrc, presenterSrc, channelSrc) {
  // Channel guards for isInteractiveOrEditableElement selector coverage
  if (!/button,\s*a\[href\].*?\[role="button"\].*?\[role="link"\]/.test(channelSrc)) {
    throw new Error('Channel Guard Violation: isInteractiveOrEditableElement must cover button, a[href], role=button, and role=link');
  }

  // ProjectorClient guards
  if (!/window\.addEventListener\(['"]keydown['"]/.test(projectorSrc)) {
    throw new Error('Projector Guard Violation: Missing window keydown listener');
  }
  if (!/e\.ctrlKey\s*\|\|\s*e\.metaKey\s*\|\|\s*e\.altKey/.test(projectorSrc)) {
    throw new Error('Projector Guard Violation: Missing modifier keys suppression');
  }
  if (!/isInteractiveOrEditableElement\(e\.target\)/.test(projectorSrc)) {
    throw new Error('Projector Guard Violation: Missing isInteractiveOrEditableElement check');
  }
  if (!/type:\s*['"]nav-next['"]/.test(projectorSrc) || !/type:\s*['"]nav-prev['"]/.test(projectorSrc)) {
    throw new Error('Projector Guard Violation: Missing nav-next or nav-prev dispatch');
  }
  const syncPlanIdentityRef = /const planIdentityRef = useRef\(planIdentity\);[\s\r\n]*planIdentityRef\.current = planIdentity;/.test(projectorSrc);
  if (!syncPlanIdentityRef) {
    throw new Error('Projector Guard Violation: Missing synchronous planIdentityRef assignment in render');
  }

  // PresenterOperator guards scoped to navBlock
  const navBlockMatch = presenterSrc.match(/if\s*\(isValidNavMessage\(msg\)\)[\s\S]*?return;\s*\}/);
  if (!navBlockMatch) {
    throw new Error('Presenter Guard Violation: Missing isValidNavMessage handling block');
  }
  const navBlock = navBlockMatch[0];
  if (!/msg\.serviceId\s*===\s*String\(serviceId\)/.test(navBlock)) {
    throw new Error('Presenter Guard Violation: Missing serviceId validation on navigation');
  }
  if (!/msg\.planIdentity\s*===\s*planIdentityRef\.current/.test(navBlock)) {
    throw new Error('Presenter Guard Violation: Missing planIdentityRef.current check on navigation');
  }
  if (!/findNextVisibleIndex\(/.test(navBlock)) {
    throw new Error('Presenter Guard Violation: Missing findNextVisibleIndex call');
  }
  const syncManualRef = /const manualNavigateRef = useRef\(manualNavigate\);[\s\r\n]*manualNavigateRef\.current = manualNavigate;/.test(presenterSrc);
  if (!syncManualRef) {
    throw new Error('Presenter Guard Violation: Missing synchronous manualNavigateRef assignment in render');
  }
}

test('SPEC-103-03: structural scan verifies ProjectorClient keydown listener and PresenterOperator navigation handler', () => {
  const projectorPath = path.join(repoRoot, 'src', 'projected', 'ProjectorClient.tsx');
  const presenterPath = path.join(repoRoot, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const channelPath = path.join(repoRoot, 'src', 'lib', 'present-channel.ts');
  const projectorSrc = fs.readFileSync(projectorPath, 'utf8');
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  const channelSrc = fs.readFileSync(channelPath, 'utf8');

  assert.doesNotThrow(() => validateProjectorNavGuards(projectorSrc, presenterSrc, channelSrc));
});

test('SPEC-103-03: defect injection proof: removing modifier or planIdentity checks triggers guard finding', () => {
  const projectorPath = path.join(repoRoot, 'src', 'projected', 'ProjectorClient.tsx');
  const presenterPath = path.join(repoRoot, 'src', 'operator', 'present', 'PresenterOperator.tsx');
  const channelPath = path.join(repoRoot, 'src', 'lib', 'present-channel.ts');
  const projectorSrc = fs.readFileSync(projectorPath, 'utf8');
  const presenterSrc = fs.readFileSync(presenterPath, 'utf8');
  const channelSrc = fs.readFileSync(channelPath, 'utf8');

  // Real code passes
  assert.doesNotThrow(() => validateProjectorNavGuards(projectorSrc, presenterSrc, channelSrc));

  // Injected defect 1: remove modifier check from ProjectorClient
  const defectiveProjectorModifiers = projectorSrc.replace(/if\s*\(\s*e\.ctrlKey[\s\S]*?return;\s*\}/, '');
  assert.throws(
    () => validateProjectorNavGuards(defectiveProjectorModifiers, presenterSrc, channelSrc),
    /Projector Guard Violation: Missing modifier keys suppression/
  );

  // Injected defect 2: remove isInteractiveOrEditableElement check from ProjectorClient
  const defectiveProjectorTarget = projectorSrc.replace(/if\s*\(\s*isInteractiveOrEditableElement\(e\.target\)\s*\)[\s\S]*?return;\s*\}/, '');
  assert.throws(
    () => validateProjectorNavGuards(defectiveProjectorTarget, presenterSrc, channelSrc),
    /Projector Guard Violation: Missing isInteractiveOrEditableElement check/
  );

  // Injected defect 3: remove planIdentity check from PresenterOperator
  const defectivePresenterIdentity = presenterSrc.replace('msg.planIdentity === planIdentityRef.current', 'true');
  assert.throws(
    () => validateProjectorNavGuards(projectorSrc, defectivePresenterIdentity, channelSrc),
    /Presenter Guard Violation: Missing planIdentityRef.current check on navigation/
  );

  // Injected defect 4: remove isValidNavMessage check from PresenterOperator
  const defectivePresenterValidator = presenterSrc.replace('if (isValidNavMessage(msg))', 'if (msg.type === "nav-next")');
  assert.throws(
    () => validateProjectorNavGuards(projectorSrc, defectivePresenterValidator, channelSrc),
    /Presenter Guard Violation: Missing isValidNavMessage handling block/
  );

  // Injected defect 5: remove synchronous manualNavigateRef render assignment
  const defectivePresenterRef = presenterSrc.replace(
    /manualNavigateRef\.current = manualNavigate;[\s\r\n]*useEffect/,
    'useEffect'
  );
  assert.throws(
    () => validateProjectorNavGuards(projectorSrc, defectivePresenterRef, channelSrc),
    /Presenter Guard Violation: Missing synchronous manualNavigateRef assignment in render/
  );

  // Injected defect 6: remove synchronous planIdentityRef render assignment while keeping useEffect
  const defectiveProjectorRef = projectorSrc.replace(
    /planIdentityRef\.current = planIdentity;[\s\r\n]*useEffect/,
    'useEffect'
  );
  assert.throws(
    () => validateProjectorNavGuards(defectiveProjectorRef, presenterSrc, channelSrc),
    /Projector Guard Violation: Missing synchronous planIdentityRef assignment in render/
  );
});
