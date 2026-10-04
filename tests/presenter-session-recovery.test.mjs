import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = pathToFileURL(path.join(repoRoot, 'src', 'lib', 'presenter-session.ts')).href;

// Mock localStorage for Node.js test environment
let mockStore = {};
let mockStorageThrows = false;

const mockLocalStorage = {
  getItem: (key) => {
    if (mockStorageThrows) throw new Error('SecurityError: Access denied');
    return mockStore[key] || null;
  },
  setItem: (key, val) => {
    if (mockStorageThrows) throw new Error('QuotaExceededError: Storage quota exceeded');
    mockStore[key] = String(val);
  },
  removeItem: (key) => {
    if (mockStorageThrows) throw new Error('SecurityError: Access denied');
    delete mockStore[key];
  },
  clear: () => {
    mockStore = {};
  },
};

globalThis.window = {
  localStorage: mockLocalStorage,
};

beforeEach(() => {
  mockStore = {};
  mockStorageThrows = false;
});

test('SPEC-105-01: Valid session save and load round-trip', async () => {
  const { loadPresenterSession, savePresenterSession, getPresenterStorageKey } =
    await import(modulePath);

  const serviceId = 42;
  const planIdentity = 'sha256-plan-valid-123';
  const planLength = 10;

  const session = {
    planIdentity,
    activeSessionId: 'sess-abc-123',
    index: 4,
    blank: true,
    scriptureOverlay: {
      reference: 'John 3:16',
      displayReference: 'John 3:16 (KJV)',
      text: 'For God so loved the world...',
      mode: 'passage',
      verses: [{ verse: 16, text: 'For God so loved...' }],
      currentPage: 1,
      totalPages: 1,
      typographyMode: 'chapter',
      isContinuation: false,
    },
    loadedScripture: {
      reference: 'John 3:16',
      verses: [{ verse: 16, text: 'For God so loved...' }],
      typographyMode: 'chapter',
    },
    scripturePageIndex: 0,
    liveTransition: 'dissolve',
    liveBackground: '/public/bg.jpg',
  };

  savePresenterSession(serviceId, session);

  const loaded = loadPresenterSession(serviceId, planIdentity, planLength);
  assert.ok(loaded, 'Loaded session must exist');
  assert.equal(loaded.version, 1);
  assert.equal(loaded.planIdentity, planIdentity);
  assert.equal(loaded.index, 4);
  assert.equal(loaded.blank, true);
  assert.equal(loaded.scriptureOverlay?.reference, 'John 3:16');
  assert.equal(loaded.liveTransition, 'dissolve');
  assert.equal(loaded.liveBackground, '/public/bg.jpg');
});

test('SPEC-105-01: Expiration after 8 hours rejects and evicts cache', async () => {
  const { loadPresenterSession, getPresenterStorageKey, PRESENTER_SESSION_MAX_AGE_MS } =
    await import(modulePath);

  const serviceId = 99;
  const planIdentity = 'sha256-plan-exp-test';
  const key = getPresenterStorageKey(serviceId);

  // Stored 8 hours and 1 second ago
  const expiredTime = Date.now() - (PRESENTER_SESSION_MAX_AGE_MS + 1000);
  mockStore[key] = JSON.stringify({
    version: 1,
    planIdentity,
    updatedAt: expiredTime,
    activeSessionId: 'sess-expired',
    index: 3,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });

  const loaded = loadPresenterSession(serviceId, planIdentity, 10);
  assert.equal(loaded, null, 'Expired session must return null');
  assert.equal(mockStore[key], undefined, 'Expired cache entry must be evicted');
});

test('SPEC-105-01: Future timestamp corruption rejection (updatedAt > now + 60s)', async () => {
  const { loadPresenterSession, getPresenterStorageKey } = await import(modulePath);

  const serviceId = 101;
  const planIdentity = 'sha256-plan-clock-skew';
  const key = getPresenterStorageKey(serviceId);

  // Stored with timestamp 2 minutes in the future
  const futureTime = Date.now() + 120000;
  mockStore[key] = JSON.stringify({
    version: 1,
    planIdentity,
    updatedAt: futureTime,
    activeSessionId: 'sess-future',
    index: 2,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });

  const loaded = loadPresenterSession(serviceId, planIdentity, 10);
  assert.equal(loaded, null, 'Future corrupt timestamp must return null');
  assert.equal(mockStore[key], undefined, 'Corrupt future cache entry must be evicted');
});

test('SPEC-105-01: Plan identity mismatch fail-closed', async () => {
  const { loadPresenterSession, getPresenterStorageKey } = await import(modulePath);

  const serviceId = 55;
  const key = getPresenterStorageKey(serviceId);

  mockStore[key] = JSON.stringify({
    version: 1,
    planIdentity: 'sha256-old-modified-plan',
    updatedAt: Date.now(),
    activeSessionId: 'sess-mismatch',
    index: 5,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });

  const loaded = loadPresenterSession(serviceId, 'sha256-new-modified-plan', 10);
  assert.equal(loaded, null, 'Mismatched plan identity must return null');
  assert.equal(mockStore[key], undefined, 'Stale plan cache entry must be evicted');
});

test('SPEC-105-01: Index clamping for non-integer, negative, and out-of-range values', async () => {
  const { loadPresenterSession, getPresenterStorageKey } = await import(modulePath);

  const serviceId = 77;
  const planIdentity = 'sha256-clamp-plan';
  const key = getPresenterStorageKey(serviceId);

  // Test negative index
  mockStore[key] = JSON.stringify({
    version: 1,
    planIdentity,
    updatedAt: Date.now(),
    activeSessionId: 'sess-neg',
    index: -5,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });
  let loaded = loadPresenterSession(serviceId, planIdentity, 10);
  assert.equal(loaded?.index, 0, 'Negative index must clamp to 0');

  // Test out-of-range index
  mockStore[key] = JSON.stringify({
    version: 1,
    planIdentity,
    updatedAt: Date.now(),
    activeSessionId: 'sess-overflow',
    index: 99,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });
  loaded = loadPresenterSession(serviceId, planIdentity, 10);
  assert.equal(loaded?.index, 9, 'Index above plan length must clamp to planLength - 1');

  // Test float index
  mockStore[key] = JSON.stringify({
    version: 1,
    planIdentity,
    updatedAt: Date.now(),
    activeSessionId: 'sess-float',
    index: 3.8,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });
  loaded = loadPresenterSession(serviceId, planIdentity, 10);
  assert.equal(loaded?.index, 3, 'Floating index must floor to integer');
});

test('SPEC-105-01: Malformed JSON and missing field handling without throwing', async () => {
  const { loadPresenterSession, getPresenterStorageKey } = await import(modulePath);

  const serviceId = 88;
  const planIdentity = 'sha256-malformed-plan';
  const key = getPresenterStorageKey(serviceId);

  // Corrupt JSON string
  mockStore[key] = '{ invalid json ::: broken';
  assert.doesNotThrow(() => {
    const loaded = loadPresenterSession(serviceId, planIdentity, 10);
    assert.equal(loaded, null);
  });

  // Missing version
  mockStore[key] = JSON.stringify({ planIdentity, updatedAt: Date.now(), index: 2 });
  assert.doesNotThrow(() => {
    const loaded = loadPresenterSession(serviceId, planIdentity, 10);
    assert.equal(loaded, null);
  });
});

test('SPEC-105-01: peekPresenterSession fail-closed and active detection', async () => {
  const { peekPresenterSession, savePresenterSession, clearPresenterSession } =
    await import(modulePath);

  const serviceId = 12;
  const planIdentity = 'sha256-peek-test';

  // 1. Empty storage -> no active session
  let peek = peekPresenterSession(serviceId, planIdentity);
  assert.equal(peek.hasSession, false);
  assert.equal(peek.slideNumber, 1);

  // 2. Active session on Slide 3 (index 2)
  savePresenterSession(serviceId, {
    planIdentity,
    activeSessionId: 'sess-active',
    index: 2,
    blank: false,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });

  peek = peekPresenterSession(serviceId, planIdentity);
  assert.equal(peek.hasSession, true);
  assert.equal(peek.slideNumber, 3, 'Slide number must be human 1-based (index 2 -> Slide 3)');

  // 3. Active session on Slide 1 but blank is true
  savePresenterSession(serviceId, {
    planIdentity,
    activeSessionId: 'sess-blank',
    index: 0,
    blank: true,
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });

  peek = peekPresenterSession(serviceId, planIdentity);
  assert.equal(peek.hasSession, true);
  assert.equal(peek.isBlank, true);

  // 4. Malformed scripture overlay ({}) in peekPresenterSession reports hasScripture: false
  savePresenterSession(serviceId, {
    planIdentity,
    activeSessionId: 'sess-malformed-overlay',
    index: 0,
    blank: false,
    scriptureOverlay: {},
    loadedScripture: null,
    scripturePageIndex: 0,
  });
  peek = peekPresenterSession(serviceId, planIdentity);
  assert.equal(peek.hasSession, false);
  assert.equal(peek.hasScripture, false);

  // 5. Mismatched plan identity -> fail closed
  peek = peekPresenterSession(serviceId, 'sha256-other-deck');
  assert.equal(peek.hasSession, false);
  assert.equal(peek.slideNumber, 1);

  // 6. Cleared session -> no active session
  clearPresenterSession(serviceId);
  peek = peekPresenterSession(serviceId, planIdentity);
  assert.equal(peek.hasSession, false);
});

test('SPEC-105-01: Non-boolean blank value is sanitized to false', async () => {
  const { loadPresenterSession, getPresenterStorageKey } = await import(modulePath);

  const serviceId = 33;
  const planIdentity = 'sha256-blank-sanitize';
  const key = getPresenterStorageKey(serviceId);

  mockStore[key] = JSON.stringify({
    version: 1,
    planIdentity,
    updatedAt: Date.now(),
    activeSessionId: 'sess-corrupt-blank',
    index: 0,
    blank: 'false', // String "false" would be truthy with Boolean("false")
    scriptureOverlay: null,
    loadedScripture: null,
    scripturePageIndex: 0,
  });

  const loaded = loadPresenterSession(serviceId, planIdentity, 10);
  assert.equal(loaded?.blank, false, 'Non-boolean blank must be sanitized to false');
});

test('SPEC-105-01: Storage error simulation without crashing', async () => {
  const { loadPresenterSession, savePresenterSession, clearPresenterSession, peekPresenterSession } =
    await import(modulePath);

  mockStorageThrows = true;

  assert.doesNotThrow(() => {
    savePresenterSession(1, {
      planIdentity: 'plan',
      activeSessionId: 'id',
      index: 1,
      blank: false,
      scriptureOverlay: null,
      loadedScripture: null,
      scripturePageIndex: 0,
    });
  }, 'savePresenterSession must swallow storage exceptions');

  assert.doesNotThrow(() => {
    const loaded = loadPresenterSession(1, 'plan', 5);
    assert.equal(loaded, null);
  }, 'loadPresenterSession must swallow storage exceptions and return null');

  assert.doesNotThrow(() => {
    clearPresenterSession(1);
  }, 'clearPresenterSession must swallow storage exceptions');

  assert.doesNotThrow(() => {
    const peek = peekPresenterSession(1, 'plan');
    assert.equal(peek.hasSession, false);
  }, 'peekPresenterSession must swallow storage exceptions');
});
