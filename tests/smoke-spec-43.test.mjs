/**
 * SPEC-43: Presenter Header, Remote Pairing, Scripture Scaling, Song Set Rows,
 * Text Rotation & Announcement Placeholders
 * Smoke Test & Absence Guard Suite
 *
 * SPEC-43-01 Verification:
 * - Go API generates strictly 6-digit zero-padded pairing codes (%06d, never %0604d)
 * - Run-Sheet button in PresenterOperator uses variant="outline" matching adjacent controls
 * - Presenter header features dedicated Remote Pairing trigger with status indicator and Dialog
 * - Remote pairing dialog displays pairing code, connection status, mobile URL, and actions
 * - Absence guards with executable defect-injection proofs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const remoteGoPath = path.join(root, 'internal', 'httpapi', 'remote.go');
assert.ok(fs.existsSync(remoteGoPath), 'remote.go must exist');
const remoteGoSource = fs.readFileSync(remoteGoPath, 'utf8');

const presenterPath = path.join(
  root,
  'src',
  'operator',
  'present',
  'PresenterOperator.tsx'
);
assert.ok(fs.existsSync(presenterPath), 'PresenterOperator.tsx must exist');
const presenterSource = fs.readFileSync(presenterPath, 'utf8');

// Absence guard helper for remote.go code generation
function scanRemoteCodeFormat(source) {
  const findings = [];
  if (source.includes('%0604d')) {
    findings.push('Found obsolete %0604d format in remote.go');
  }
  if (!source.includes('fmt.Sprintf("%06d", n%1000000)')) {
    findings.push('Missing exact %06d 6-digit code formatting in remote.go');
  }
  return findings;
}

// Absence guard helper for Run-Sheet button variant in PresenterOperator
function scanRunSheetButtonVariant(source) {
  const findings = [];
  // Match the Button immediately preceding Run-Sheet
  const m = source.match(/<Button\b([\s\S]*?)>\s*Run-Sheet\s*<\/Button>/);
  if (!m) {
    findings.push('Run-Sheet button not found');
  } else {
    const btnTag = m[1];
    const variantMatches = [...btnTag.matchAll(/variant="([^"]*)"/g)];
    const variant =
      variantMatches.length > 0
        ? variantMatches[variantMatches.length - 1][1]
        : '';
    if (variant === 'ghost') {
      findings.push('Run-Sheet button uses obsolete ghost variant');
    }
    if (variant !== 'outline') {
      findings.push(
        `Run-Sheet button uses unexpected variant "${variant}" (expected "outline")`
      );
    }
  }
  return findings;
}

test('SPEC-43-01: 1. remote.go formats pairing code strictly with %06d and zero-padding', () => {
  const findings = scanRemoteCodeFormat(remoteGoSource);
  assert.deepEqual(
    findings,
    [],
    'remote.go must not contain %0604d and must format with %06d'
  );
});

test('SPEC-43-01: 2. Defect injection proof for remote.go code format guard', () => {
  const defectiveSource = remoteGoSource.replace(
    'fmt.Sprintf("%06d", n%1000000)',
    'fmt.Sprintf("%0604d", n%1000000)'
  );
  const findings = scanRemoteCodeFormat(defectiveSource);
  assert.ok(
    findings.some((f) => f.includes('%0604d')),
    'scanRemoteCodeFormat must report defect when %0604d is present'
  );
});

test('SPEC-43-01: 3. Run-Sheet button in PresenterOperator uses variant="outline"', () => {
  const findings = scanRunSheetButtonVariant(presenterSource);
  assert.deepEqual(
    findings,
    [],
    'Run-Sheet button must use outline variant'
  );
});

test('SPEC-43-01: 4. Defect injection proof for Run-Sheet button variant guard', () => {
  const defectiveSource = presenterSource.replace(
    /variant="outline"(\s+nativeButton=\{false\}\s+render=\{<Link href=\{\`\/services\/\$\{serviceId\}\`\} \/>\}\s*>\s*Run-Sheet\s*<\/Button>)/,
    'variant="ghost"$1'
  );
  const findings = scanRunSheetButtonVariant(defectiveSource);
  assert.ok(
    findings.some((f) => f.includes('ghost')),
    'scanRunSheetButtonVariant must report defect when ghost variant is present'
  );
});

test('SPEC-43-01: 5. PresenterOperator includes dedicated Remote Pairing trigger and dialog', () => {
  assert.ok(
    presenterSource.includes('Mobile Remote Pairing'),
    'PresenterOperator must include Mobile Remote Pairing Dialog title'
  );
  assert.ok(
    presenterSource.includes('remoteDialogOpen'),
    'PresenterOperator must maintain remoteDialogOpen state'
  );
  assert.ok(
    presenterSource.includes('remoteSessionRef'),
    'PresenterOperator must retain remoteSessionRef for dialog controls'
  );
  assert.ok(
    presenterSource.includes('Regenerate Code'),
    'PresenterOperator dialog must provide Regenerate Code action'
  );
  assert.ok(
    presenterSource.includes('Disconnect'),
    'PresenterOperator dialog must provide Disconnect action'
  );
  assert.ok(
    presenterSource.includes('Presenter Ready · Awaiting Mobile'),
    'PresenterOperator dialog must display informative ready status copy'
  );
  assert.ok(
    presenterSource.includes('disconnect()'),
    'PresenterOperator Disconnect action must invoke session disconnect()'
  );
});

test('SPEC-43-01: 6. PresenterRemoteSession disconnect() issues DELETE /pair and resets state to idle', async () => {
  const { PresenterRemoteSession } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'presenter-remote-client.ts')).href
  );

  const fetchCalls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    fetchCalls.push({ url, method: opts?.method });
    return {
      ok: true,
      json: async () => ({ code: '123456', expiresIn: 60 }),
    };
  };

  const states = [];
  const session = new PresenterRemoteSession({
    serviceId: 42,
    getPlanIdentity: () => 'plan-test',
    handlers: {
      setIndexAndSync: () => {},
      setBlankAndSync: () => {},
      setTransitionAndSync: () => {},
      setBackgroundAndSync: () => {},
      broadcast: () => {},
    },
    onStateChange: (st) => states.push(st),
  });

  try {
    await session.disconnect();
    assert.ok(
      fetchCalls.some(
        (c) =>
          c.url === '/api/present/42/remote/pair' && c.method === 'DELETE'
      ),
      'disconnect() must send DELETE /api/present/:id/remote/pair to server'
    );
    assert.ok(
      states.includes('idle'),
      'disconnect() must transition session state to idle'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SPEC-43-01: 7. PresenterRemoteSession serializes lifecycle requests and aborts on stop', async () => {
  const { PresenterRemoteSession } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'presenter-remote-client.ts')).href
  );

  const calls = [];
  const signals = [];
  const codesEmitted = [];
  const originalFetch = globalThis.fetch;

  let resolveFirst;
  let resolveSecond;

  globalThis.fetch = (url, opts) => {
    signals.push(opts?.signal);
    calls.push({ url, method: opts?.method });
    if (calls.length === 1) {
      return new Promise((resolve) => {
        resolveFirst = () =>
          resolve({
            ok: true,
            json: async () => ({ code: '000001', expiresIn: 60 }),
          });
      });
    }
    return new Promise((resolve) => {
      resolveSecond = () =>
        resolve({
          ok: true,
          json: async () => ({ code: '999999', expiresIn: 60 }),
        });
    });
  };

  const session = new PresenterRemoteSession({
    serviceId: 99,
    getPlanIdentity: () => 'plan-test',
    handlers: {
      setIndexAndSync: () => {},
      setBlankAndSync: () => {},
      setTransitionAndSync: () => {},
      setBackgroundAndSync: () => {},
      broadcast: () => {},
    },
    onCode: (code) => codesEmitted.push(code),
  });

  try {
    const p1 = session.start();
    const p2 = session.start();

    // Microtask flush for queued execution
    await Promise.resolve();

    // Due to request queue serialization, second fetch is only dispatched after first completes
    assert.equal(calls.length, 1, 'Second fetch must not start until first resolves');
    assert.ok(signals[0] instanceof AbortSignal, 'Fetch must receive an AbortSignal');

    resolveFirst();
    await p1;

    // Now second fetch is dispatched in strict FIFO order
    assert.equal(calls.length, 2, 'Second fetch dispatched sequentially');
    resolveSecond();
    await p2;

    assert.deepEqual(codesEmitted, ['000001', '999999']);

    // Stop aborts active controller
    const activeSignal = signals[1];
    session.stop();
    assert.equal(activeSignal.aborted, true, 'Calling stop() must abort the active AbortSignal');
  } finally {
    globalThis.fetch = originalFetch;
    session.stop();
  }
});

test('SPEC-43-01: 8. PresenterRemoteSession stop() aborts in-flight fetch and prevents queued start execution', async () => {
  const { PresenterRemoteSession } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'presenter-remote-client.ts')).href
  );

  let capturedSignal;
  let fetchStarted = false;
  const originalFetch = globalThis.fetch;
  const states = [];
  const codes = [];

  globalThis.fetch = (url, opts) => {
    fetchStarted = true;
    capturedSignal = opts?.signal;
    return new Promise((_, reject) => {
      opts?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted', 'AbortError'));
      });
    });
  };

  const session = new PresenterRemoteSession({
    serviceId: 101,
    getPlanIdentity: () => 'plan-test',
    handlers: {
      setIndexAndSync: () => {},
      setBlankAndSync: () => {},
      setTransitionAndSync: () => {},
      setBackgroundAndSync: () => {},
      broadcast: () => {},
    },
    onCode: (c) => codes.push(c),
    onStateChange: (st) => states.push(st),
  });

  try {
    // 1. Start session
    const pStart = session.start();
    await Promise.resolve(); // flush queue microtask
    assert.equal(fetchStarted, true, 'Fetch must have initiated');
    assert.equal(capturedSignal.aborted, false, 'Signal must not be aborted initially');

    // 2. Stop session while fetch is pending
    session.stop();
    assert.equal(capturedSignal.aborted, true, 'Signal must be aborted immediately upon stop()');

    // 3. Await start promise - must complete cleanly without throwing or entering error state
    await pStart;
    assert.equal(codes.length, 0, 'No code must be emitted after stop()');
    assert.ok(!states.includes('error'), 'Aborted fetch must not transition to error state');
    assert.equal(states[states.length - 1], 'idle', 'Final state must be idle');

    // 4. Queued start followed immediately by stop must not execute fetch
    fetchStarted = false;
    const pQueued = session.start();
    session.stop(); // Stop called before microtask runs
    await pQueued;
    assert.equal(fetchStarted, false, 'Start invoked before stop must be discarded by stopEpoch');
  } finally {
    globalThis.fetch = originalFetch;
    session.stop();
  }
});

test('SPEC-43-01: 9. PresenterRemoteSession disconnect() followed by start() requests and emits fresh code', async () => {
  const { PresenterRemoteSession } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'presenter-remote-client.ts')).href
  );

  const fetchCalls = [];
  const codesEmitted = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url, opts) => {
    fetchCalls.push({ url, method: opts?.method });
    if (opts?.method === 'DELETE') {
      return { ok: true, status: 204 };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ code: '888888', expiresIn: 60 }),
    };
  };

  const session = new PresenterRemoteSession({
    serviceId: 77,
    getPlanIdentity: () => 'plan-test',
    handlers: {
      setIndexAndSync: () => {},
      setBlankAndSync: () => {},
      setTransitionAndSync: () => {},
      setBackgroundAndSync: () => {},
      broadcast: () => {},
    },
    onCode: (c) => codesEmitted.push(c),
  });

  try {
    // 1. Initial disconnect
    await session.disconnect();
    assert.ok(
      fetchCalls.some(
        (c) => c.url === '/api/present/77/remote/pair' && c.method === 'DELETE'
      ),
      'Must have called DELETE /pair'
    );

    // 2. Start called after disconnect must proceed cleanly and emit fresh code
    await session.start();
    assert.ok(
      fetchCalls.some(
        (c) => c.url === '/api/present/77/remote/pair' && c.method === 'POST'
      ),
      'Must issue POST /pair on start() following disconnect()'
    );
    assert.deepEqual(
      codesEmitted,
      ['888888'],
      'Must emit fresh pairing code after disconnect and re-start'
    );
  } finally {
    globalThis.fetch = originalFetch;
    session.stop();
  }
});
