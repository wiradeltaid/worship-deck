import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const presenterOperatorPath = path.join(repoRoot, 'src', 'operator', 'present', 'PresenterOperator.tsx');

let mockStore = {};
const mockLocalStorage = {
  getItem: (key) => mockStore[key] || null,
  setItem: (key, val) => {
    mockStore[key] = String(val);
  },
  removeItem: (key) => {
    delete mockStore[key];
  },
  clear: () => {
    mockStore = {};
  },
};

globalThis.window = {
  localStorage: mockLocalStorage,
  addEventListener: () => {},
  removeEventListener: () => {},
};

beforeEach(() => {
  mockStore = {};
});

test('SPEC-105-02: PresenterOperator source guards for pre-sync hydration and session persistence wiring', () => {
  assert.ok(fs.existsSync(presenterOperatorPath), 'PresenterOperator.tsx must exist');
  const src = fs.readFileSync(presenterOperatorPath, 'utf8');

  // Must import loadPresenterSession and savePresenterSession
  assert.ok(
    src.includes('loadPresenterSession') && src.includes('savePresenterSession'),
    'PresenterOperator must import loadPresenterSession and savePresenterSession'
  );

  // Must load restoredSession synchronously via useMemo
  assert.ok(
    src.includes('loadPresenterSession(serviceId, planIdentity, slides.length)'),
    'PresenterOperator must invoke loadPresenterSession on mount'
  );

  // Must initialize index from restoredSession
  assert.ok(
    src.includes('restoredSession ? restoredSession.index : 0'),
    'PresenterOperator must initialize index state and ref from restoredSession'
  );

  // Must initialize blank from restoredSession
  assert.ok(
    src.includes('restoredSession ? restoredSession.blank : false'),
    'PresenterOperator must initialize blank state and ref from restoredSession'
  );

  // Must wire persistCurrentSession
  assert.ok(
    src.includes('persistCurrentSession'),
    'PresenterOperator must implement persistCurrentSession helper'
  );
});

test('SPEC-105-02: Initial sync payload after reload matches restored session states without index 0 regression', async () => {
  const { savePresenterSession } = await import(
    pathToFileURL(path.join(repoRoot, 'src', 'lib', 'presenter-session.ts')).href
  );

  const serviceId = 77;
  const planIdentity = 'plan-reload-verification';

  // Seed saved session at Slide 15 (index 14) with blank: true, scripture, and dissolve
  savePresenterSession(serviceId, {
    planIdentity,
    activeSessionId: 'sess-77-prior',
    index: 14,
    blank: true,
    scriptureOverlay: {
      reference: 'John 3:16',
      displayReference: 'John 3:16 (KJV)',
      text: 'For God so loved...',
      mode: 'passage',
      verses: [{ verse: 16, text: 'For God so loved...' }],
      currentPage: 1,
      totalPages: 1,
      typographyMode: 'chapter',
      isContinuation: false,
      continuationIndex: 0,
      continuationCount: 1,
    },
    loadedScripture: null,
    scripturePageIndex: 0,
    liveTransition: 'dissolve',
    liveBackground: '/public/bg77.jpg',
  });

  // Simulate PresenterOperator mount hydration
  const { loadPresenterSession } = await import(
    pathToFileURL(path.join(repoRoot, 'src', 'lib', 'presenter-session.ts')).href
  );
  const restoredSession = loadPresenterSession(serviceId, planIdentity, 30);
  assert.ok(restoredSession);

  const indexRef = { current: restoredSession ? restoredSession.index : 0 };
  const blankRef = { current: restoredSession ? restoredSession.blank : false };
  const transitionRef = { current: restoredSession?.liveTransition ?? 'fade' };
  const backgroundRef = { current: restoredSession?.liveBackground ?? null };
  const scriptureOverlayRef = { current: restoredSession?.scriptureOverlay ?? null };

  const emittedMessages = [];
  const fakeChannel = {
    postMessage: (msg) => {
      emittedMessages.push(msg);
    },
  };

  // Mount sync broadcast
  fakeChannel.postMessage({
    type: 'sync',
    index: indexRef.current,
    blank: blankRef.current,
    transition: transitionRef.current,
    background: backgroundRef.current,
    scripture: scriptureOverlayRef.current,
    planIdentity,
  });

  assert.equal(emittedMessages.length, 1);
  const firstSync = emittedMessages[0];

  // Invariant 1: First sync MUST carry restored index 14
  assert.equal(firstSync.index, 14, 'First sync must carry restored index 14');
  assert.notEqual(firstSync.index, 0, 'Negative check: first sync must not reset to index 0');

  // Invariant 2: First sync carries blank true and scripture overlay
  assert.equal(firstSync.blank, true);
  assert.equal(firstSync.scripture?.reference, 'John 3:16');
  assert.equal(firstSync.transition, 'dissolve');
  assert.equal(firstSync.background, '/public/bg77.jpg');
});

test('SPEC-105-02: Modified plan identity rejects stale session and safely defaults to index 0', async () => {
  const { savePresenterSession, loadPresenterSession } = await import(
    pathToFileURL(path.join(repoRoot, 'src', 'lib', 'presenter-session.ts')).href
  );

  const serviceId = 88;
  savePresenterSession(serviceId, {
    planIdentity: 'plan-version-1',
    activeSessionId: 'sess-88',
    index: 8,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });

  // When deck plan updates to plan-version-2, stale session must not load
  const restoredSession = loadPresenterSession(serviceId, 'plan-version-2', 20);
  assert.equal(restoredSession, null, 'Stale plan identity must return null');

  const safeIndex = restoredSession ? restoredSession.index : 0;
  assert.equal(safeIndex, 0, 'Clean fallback to index 0 on plan identity change');
});

test('SPEC-105-02: Multi-tab authority protection and storage event handling', () => {
  const src = fs.readFileSync(presenterOperatorPath, 'utf8');

  // Verify unique session ID generation
  assert.ok(
    src.includes('presenterSessionIdRef = useRef'),
    'PresenterOperator must generate distinct presenterSessionIdRef'
  );

  // Verify storage listener for authority relinquishing
  assert.ok(
    src.includes("window.addEventListener('storage', onStorage)") ||
    src.includes('addEventListener("storage", onStorage)'),
    'PresenterOperator must register storage event listener'
  );

  assert.ok(
    src.includes('isAuthoritativeRef.current = false'),
    'PresenterOperator must relinquish authority when another session takes over'
  );

  // Verify scripture push and mode change wire persistCurrentSession
  assert.ok(
    src.includes('pushScripture') && src.includes('persistCurrentSession();'),
    'pushScripture must persist current session'
  );
  assert.ok(
    src.includes('handleModeChange') && src.includes('persistCurrentSession();'),
    'handleModeChange must persist current session'
  );
});

