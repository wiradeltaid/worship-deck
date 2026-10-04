import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runSheetPath = path.join(repoRoot, 'spa', 'src', 'pages', 'RunSheetPage.tsx');

function readRunSheetSource() {
  assert.ok(fs.existsSync(runSheetPath), 'RunSheetPage.tsx must exist');
  return fs.readFileSync(runSheetPath, 'utf8');
}

test('SPEC-105-03: RunSheetPage source guards for adaptive smart resume and split button', () => {
  const src = readRunSheetSource();

  // Must import peekPresenterSession and clearPresenterSession
  assert.ok(
    src.includes('peekPresenterSession') && src.includes('clearPresenterSession'),
    'RunSheetPage must import peekPresenterSession and clearPresenterSession'
  );

  // Must inspect session on mount and window focus
  assert.ok(
    src.includes('peekPresenterSession(svc.id, svc.plan_identity)'),
    'RunSheetPage must inspect session using peekPresenterSession'
  );
  assert.ok(
    src.includes("window.addEventListener('focus',") || src.includes('window.addEventListener("focus",'),
    'RunSheetPage must register focus listener to re-check active session'
  );

  // Must render conditional split button when sessionInfo.hasSession is true
  assert.ok(
    src.includes('sessionInfo.hasSession ?'),
    'RunSheetPage must branch on sessionInfo.hasSession'
  );

  // Must render "Resume (Slide {sessionInfo.slideNumber})"
  assert.ok(
    src.includes('Resume (Slide {sessionInfo.slideNumber})') ||
    src.includes('Resume (Slide') ||
    src.includes('{t(\'edit.actions.resume\')'),
    'RunSheetPage must render Resume with slide number'
  );

  // Must render "Start from Beginning (Slide 1)" and call clearPresenterSession
  assert.ok(
    src.includes('Start from Beginning (Slide 1)'),
    'RunSheetPage must render Start from Beginning (Slide 1) label'
  );
  assert.ok(
    src.includes('clearPresenterSession(svc.id)'),
    'Start from Beginning must call clearPresenterSession'
  );

  // Must clean up focus listener on unmount
  assert.ok(
    src.includes("removeEventListener('focus', check)") || src.includes('removeEventListener("focus", check)'),
    'RunSheetPage must remove focus listener on cleanup'
  );

  // URL Cleanliness Invariant: no ?reset=1 query parameter residue
  assert.ok(
    !src.includes('?reset=1'),
    'RunSheetPage must never append ?reset=1 query parameter'
  );
});

test('SPEC-105-03: peekPresenterSession correctly drives RunSheet decision logic', async () => {
  let mockStore = {};
  globalThis.window = {
    localStorage: {
      getItem: (k) => mockStore[k] || null,
      setItem: (k, v) => { mockStore[k] = String(v); },
      removeItem: (k) => { delete mockStore[k]; },
    },
  };

  const { peekPresenterSession, savePresenterSession, clearPresenterSession } = await import(
    new URL('../src/lib/presenter-session.ts', import.meta.url).href
  );

  const serviceId = 202;
  const currentPlan = 'plan-hash-abc';

  // Case 1: No session saved -> standard Present button
  let info = peekPresenterSession(serviceId, currentPlan);
  assert.equal(info.hasSession, false);
  assert.equal(info.slideNumber, 1);

  // Case 2: Active session at index 14 (Slide 15) -> Resume (Slide 15)
  savePresenterSession(serviceId, {
    planIdentity: currentPlan,
    activeSessionId: 'sess-active',
    index: 14,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });
  info = peekPresenterSession(serviceId, currentPlan);
  assert.equal(info.hasSession, true);
  assert.equal(info.slideNumber, 15, 'Slide number must be 1-based index 14 -> Slide 15');

  // Case 3: Plan identity mismatch -> fail-closed standard Present button
  info = peekPresenterSession(serviceId, 'different-plan-hash');
  assert.equal(info.hasSession, false);

  // Case 4: Clear session on "Start from Beginning" -> standard Present button
  clearPresenterSession(serviceId);
  info = peekPresenterSession(serviceId, currentPlan);
  assert.equal(info.hasSession, false);
});
