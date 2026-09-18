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

// Absence guard helper for presenter height clamping
function scanPresenterHeightClamping(source) {
  const findings = [];
  // Match outer div of PresenterOperator return
  const returnMatch = source.match(/return\s*\(\s*<div\s+className="([^"]*)"/);
  if (!returnMatch) {
    findings.push('Presenter root container not found');
  } else {
    const classes = returnMatch[1];
    if (classes.includes('lg:h-dvh')) {
      findings.push('Presenter root container contains obsolete lg:h-dvh clamping');
    }
    if (classes.includes('lg:overflow-hidden')) {
      findings.push('Presenter root container contains obsolete lg:overflow-hidden clamping');
    }
    if (!classes.includes('overflow-y-auto')) {
      findings.push('Presenter root container missing overflow-y-auto');
    }
    if (!classes.includes('min-h-dvh')) {
      findings.push('Presenter root container missing min-h-dvh');
    }
    if (!classes.includes('flex-col')) {
      findings.push('Presenter root container missing flex-col');
    }
  }
  return findings;
}

// Structural scanner for panel scrollers and min-height containment
function scanPresenterPanelContainment(source) {
  const findings = [];

  // 1. Slides section
  const slidesMatch = source.match(
    /<section[\s\S]*?min-h-\[16rem\][\s\S]*?<h2[^>]*>\s*Slides\s*<\/h2>[\s\S]*?<div[^>]*className="([^"]*)"/
  );
  if (!slidesMatch) {
    findings.push('Slides section with min-h-[16rem] floor not found');
  } else {
    const scrollerClasses = slidesMatch[1];
    if (!scrollerClasses.includes('overflow-y-auto')) {
      findings.push('Slides panel scroller missing overflow-y-auto');
    }
    if (!scrollerClasses.includes('max-lg:max-h-[45vh]')) {
      findings.push('Slides panel scroller missing max-lg:max-h-[45vh] mobile containment');
    }
    if (!scrollerClasses.includes('lg:max-h-[36rem]')) {
      findings.push('Slides panel scroller missing lg:max-h-[36rem] desktop containment');
    }
  }

  // 2. Run-Sheet section
  const runSheetMatch = source.match(
    /<section[\s\S]*?min-h-\[14rem\][\s\S]*?<h2[^>]*>\s*Run-Sheet\s*<\/h2>[\s\S]*?<ul[^>]*className="([^"]*)"/
  );
  if (!runSheetMatch) {
    findings.push('Run-Sheet section with min-h-[14rem] floor not found');
  } else {
    const scrollerClasses = runSheetMatch[1];
    if (!scrollerClasses.includes('overflow-y-auto')) {
      findings.push('Run-Sheet panel scroller missing overflow-y-auto');
    }
    if (!scrollerClasses.includes('max-lg:max-h-[45vh]')) {
      findings.push('Run-Sheet panel scroller missing max-lg:max-h-[45vh] mobile containment');
    }
    if (!scrollerClasses.includes('lg:max-h-[30rem]')) {
      findings.push('Run-Sheet panel scroller missing lg:max-h-[30rem] desktop containment');
    }
  }

  return findings;
}

test('SPEC-43-02: 10. Presenter root container eliminates lg:h-dvh and lg:overflow-hidden with overflow-y-auto', () => {
  const currentPresenterSource = fs.readFileSync(presenterPath, 'utf8');
  const findings = scanPresenterHeightClamping(currentPresenterSource);
  assert.deepEqual(
    findings,
    [],
    'Presenter root container must not clamp height with lg:h-dvh or lg:overflow-hidden'
  );
});

test('SPEC-43-02: 11. Defect injection proof for presenter height clamping absence guard', () => {
  const currentPresenterSource = fs.readFileSync(presenterPath, 'utf8');
  const rootClass =
    'className="dark flex min-h-dvh flex-col overflow-y-auto bg-background text-foreground"';

  // Form 1: lg:h-dvh and lg:overflow-hidden re-introduced
  const defective1 = currentPresenterSource.replace(
    rootClass,
    'className="dark flex min-h-dvh flex-col bg-background text-foreground lg:h-dvh lg:overflow-hidden"'
  );
  assert.notEqual(defective1, currentPresenterSource, 'Defect 1 must modify source');
  const findings1 = scanPresenterHeightClamping(defective1);
  assert.ok(findings1.some((f) => f.includes('lg:h-dvh')), 'Must report lg:h-dvh defect');
  assert.ok(findings1.some((f) => f.includes('lg:overflow-hidden')), 'Must report lg:overflow-hidden defect');

  // Form 2: removal of min-h-dvh
  const defective2 = currentPresenterSource.replace(
    rootClass,
    rootClass.replace('min-h-dvh', 'h-auto')
  );
  assert.notEqual(defective2, currentPresenterSource, 'Defect 2 must modify source');
  const findings2 = scanPresenterHeightClamping(defective2);
  assert.ok(findings2.some((f) => f.includes('missing min-h-dvh')), 'Must report missing min-h-dvh');

  // Form 3: removal of flex-col
  const defective3 = currentPresenterSource.replace(
    rootClass,
    rootClass.replace('flex-col', 'flex-row')
  );
  assert.notEqual(defective3, currentPresenterSource, 'Defect 3 must modify source');
  const findings3 = scanPresenterHeightClamping(defective3);
  assert.ok(findings3.some((f) => f.includes('missing flex-col')), 'Must report missing flex-col');

  // Form 4: removal of overflow-y-auto
  const defective4 = currentPresenterSource.replace(
    rootClass,
    rootClass.replace('overflow-y-auto', 'overflow-y-visible')
  );
  assert.notEqual(defective4, currentPresenterSource, 'Defect 4 must modify source');
  const findings4 = scanPresenterHeightClamping(defective4);
  assert.ok(findings4.some((f) => f.includes('missing overflow-y-auto')), 'Must report missing overflow-y-auto');
});

test('SPEC-43-02: 12. Presenter stage vars formula preserved and panels have structural min-height & scroll containment', () => {
  const currentPresenterSource = fs.readFileSync(presenterPath, 'utf8');
  assert.ok(
    currentPresenterSource.includes(
      "'--presenter-stage': 'max(24rem, min(64rem, calc((100dvh - 30rem) * 16 / 9)))'"
    ),
    'STAGE_VARS must preserve formula with 24rem floor and 64rem cap'
  );

  const panelFindings = scanPresenterPanelContainment(currentPresenterSource);
  assert.deepEqual(
    panelFindings,
    [],
    'Slides and Run-Sheet panels must maintain floors and scroll containment'
  );
});

test('SPEC-43-02: 13. Defect injection proof for panel scroll containment guard across all forms', () => {
  const currentPresenterSource = fs.readFileSync(presenterPath, 'utf8');

  const cases = [
    {
      name: 'Slides floor removed',
      mutate: (src) => src.replace('min-h-[16rem]', 'min-h-0'),
      expectedSnippet: 'Slides section with min-h-[16rem]',
    },
    {
      name: 'Slides overflow-y-auto removed',
      mutate: (src) =>
        src.replace('overflow-y-auto p-1.5', 'overflow-y-visible p-1.5'),
      expectedSnippet: 'Slides panel scroller missing overflow-y-auto',
    },
    {
      name: 'Slides desktop cap removed',
      mutate: (src) => src.replace('lg:max-h-[36rem]', 'lg:max-h-none'),
      expectedSnippet: 'Slides panel scroller missing lg:max-h-[36rem]',
    },
    {
      name: 'Slides mobile cap removed',
      mutate: (src) =>
        src.replace(
          'overflow-y-auto p-1.5 max-lg:max-h-[45vh]',
          'overflow-y-auto p-1.5 max-lg:max-h-none'
        ),
      expectedSnippet: 'Slides panel scroller missing max-lg:max-h-[45vh]',
    },
    {
      name: 'Run-Sheet floor removed',
      mutate: (src) => src.replace('min-h-[14rem]', 'min-h-0'),
      expectedSnippet: 'Run-Sheet section with min-h-[14rem]',
    },
    {
      name: 'Run-Sheet overflow-y-auto removed',
      mutate: (src) =>
        src.replace('overflow-y-auto p-3', 'overflow-y-visible p-3'),
      expectedSnippet: 'Run-Sheet panel scroller missing overflow-y-auto',
    },
    {
      name: 'Run-Sheet desktop cap removed',
      mutate: (src) => src.replace('lg:max-h-[30rem]', 'lg:max-h-none'),
      expectedSnippet: 'Run-Sheet panel scroller missing lg:max-h-[30rem]',
    },
    {
      name: 'Run-Sheet mobile cap removed',
      mutate: (src) =>
        src.replace(
          'max-lg:max-h-[45vh] lg:max-h-[30rem]',
          'max-lg:max-h-none lg:max-h-[30rem]'
        ),
      expectedSnippet: 'Run-Sheet panel scroller missing max-lg:max-h-[45vh]',
    },
  ];

  for (const tc of cases) {
    const mutated = tc.mutate(currentPresenterSource);
    assert.notEqual(mutated, currentPresenterSource, `Mutation for ${tc.name} must modify source`);
    const findings = scanPresenterPanelContainment(mutated);
    assert.ok(
      findings.some((f) => f.includes(tc.expectedSnippet)),
      `scanPresenterPanelContainment must report defect for ${tc.name} (looking for ${tc.expectedSnippet}, got: ${findings.join(', ')})`
    );
  }
});

test('SPEC-43-03: 14. getScriptureScaling dynamically scales font size across exact length boundaries', async () => {
  const { getScriptureScaling } = await import(
    pathToFileURL(path.join(root, 'src', 'lib', 'scripture-scaling.ts')).href
  );

  // Exact boundary 59 chars (< 60)
  const b59 = getScriptureScaling('A'.repeat(59));
  assert.equal(b59.fontSizeStyle, 'clamp(2.5rem, 8.5cqh, 6rem)');
  assert.equal(b59.minHeightStyle, '38cqh');
  assert.ok(b59.tailwindClass.includes('text-8xl'));

  // Exact boundary 60 chars (60-120)
  const b60 = getScriptureScaling('A'.repeat(60));
  assert.equal(b60.fontSizeStyle, 'clamp(2rem, 6.5cqh, 4.5rem)');
  assert.equal(b60.minHeightStyle, '28cqh');
  assert.ok(b60.tailwindClass.includes('text-7xl'));

  // Exact boundary 119 chars (60-120)
  const b119 = getScriptureScaling('A'.repeat(119));
  assert.equal(b119.fontSizeStyle, 'clamp(2rem, 6.5cqh, 4.5rem)');
  assert.equal(b119.minHeightStyle, '28cqh');

  // Exact boundary 120 chars (120-200)
  const b120 = getScriptureScaling('A'.repeat(120));
  assert.equal(b120.fontSizeStyle, 'clamp(1.5rem, 4.8cqh, 3.5rem)');
  assert.equal(b120.minHeightStyle, '20cqh');
  assert.ok(b120.tailwindClass.includes('text-5xl'));

  // Exact boundary 199 chars (120-200)
  const b199 = getScriptureScaling('A'.repeat(199));
  assert.equal(b199.fontSizeStyle, 'clamp(1.5rem, 4.8cqh, 3.5rem)');
  assert.equal(b199.minHeightStyle, '20cqh');

  // Exact boundary 200 chars (> 200)
  const b200 = getScriptureScaling('A'.repeat(200));
  assert.equal(b200.fontSizeStyle, 'clamp(1.25rem, 3.5cqh, 2.5rem)');
  assert.equal(b200.minHeightStyle, 'auto');
  assert.ok(b200.tailwindClass.includes('text-4xl'));
});

function scanScriptureMirroring(source) {
  const findings = [];

  // 1. Current stage contains ScriptureOverlayView conditionally
  const stageMatch = source.match(
    /<section>[\s\S]*?Current[\s\S]*?<div[^>]*aspect-video[\s\S]*?\{scriptureOverlay \? \(\s*<ScriptureOverlayView/
  );
  if (!stageMatch) {
    findings.push('Current stage missing conditional <ScriptureOverlayView');
  }

  // 2. Current stage header contains Scripture live badge
  const badgeMatch = source.match(
    /Current[\s\S]*?\{scriptureOverlay \? \([\s\S]*?Scripture live/
  );
  if (!badgeMatch) {
    findings.push('Current stage header missing "Scripture live" status badge');
  }

  // 3. setIndexAndSync clears scriptureOverlay
  const setIndexMatch = source.match(
    /const setIndexAndSync = useCallback\(\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\},\s*\[/
  );
  if (!setIndexMatch || !setIndexMatch[1].includes('setScriptureOverlay(null)')) {
    findings.push('setIndexAndSync missing setScriptureOverlay(null) reset');
  }

  // 4. currentState includes scriptureOverlayRef
  const currentStateMatch = source.match(
    /const currentState = \(\): PresentMessage => \(\{[\s\S]*?scripture:\s*scriptureOverlayRef\.current/
  );
  if (!currentStateMatch) {
    findings.push('currentState missing scripture: scriptureOverlayRef.current');
  }

  return findings;
}

test('SPEC-43-03: 15. PresenterOperator mirrors scripture on Current stage with status badge and parity with ProjectorClient', () => {
  const currentPresenterSource = fs.readFileSync(presenterPath, 'utf8');
  const projectorPath = path.join(root, 'src', 'projected', 'ProjectorClient.tsx');
  const projectorSource = fs.readFileSync(projectorPath, 'utf8');

  // Parity check: both render ScriptureOverlayView
  assert.ok(
    projectorSource.includes('<ScriptureOverlayView'),
    'ProjectorClient must render ScriptureOverlayView'
  );

  const findings = scanScriptureMirroring(currentPresenterSource);
  assert.deepEqual(
    findings,
    [],
    'PresenterOperator must structurally mirror scripture overlay on Current stage'
  );
});

test('SPEC-43-03: 16. Defect injection proof for scripture stage mirroring guards across all structural forms', () => {
  const currentPresenterSource = fs.readFileSync(presenterPath, 'utf8');

  // Form 1: ScriptureOverlayView omitted from Current stage
  const defective1 = currentPresenterSource.replace(
    '<ScriptureOverlayView',
    '<!-- omitted -->'
  );
  assert.notEqual(defective1, currentPresenterSource);
  const findings1 = scanScriptureMirroring(defective1);
  assert.ok(
    findings1.some((f) => f.includes('missing conditional <ScriptureOverlayView')),
    'Must report missing conditional <ScriptureOverlayView defect'
  );

  // Form 2: Scripture live badge omitted
  const defective2 = currentPresenterSource.replace('Scripture live', 'Slide live');
  assert.notEqual(defective2, currentPresenterSource);
  const findings2 = scanScriptureMirroring(defective2);
  assert.ok(
    findings2.some((f) => f.includes('"Scripture live" status badge')),
    'Must report missing "Scripture live" status badge defect'
  );

  // Form 3: setScriptureOverlay(null) in setIndexAndSync omitted
  const defective3 = currentPresenterSource.replace(
    /indexRef\.current = clamped;\s*setIndex\(clamped\);\s*setScriptureOverlay\(null\);/,
    'indexRef.current = clamped;\n      setIndex(clamped);'
  );
  assert.notEqual(defective3, currentPresenterSource);
  const findings3 = scanScriptureMirroring(defective3);
  assert.ok(
    findings3.some((f) => f.includes('setIndexAndSync missing setScriptureOverlay(null)')),
    'Must report missing setIndexAndSync reset defect'
  );

  // Form 4: currentState missing scriptureOverlayRef
  const defective4 = currentPresenterSource.replace(
    'scripture: scriptureOverlayRef.current,',
    ''
  );
  assert.notEqual(defective4, currentPresenterSource);
  const findings4 = scanScriptureMirroring(defective4);
  assert.ok(
    findings4.some((f) => f.includes('currentState missing scripture')),
    'Must report currentState missing scripture defect'
  );
});

test('SPEC-43-03: 17. ProjectorClient preserves active scripture overlay on sync reload', () => {
  const projectorPath = path.join(root, 'src', 'projected', 'ProjectorClient.tsx');
  const projectorSource = fs.readFileSync(projectorPath, 'utf8');

  // Verify ProjectorClient message handler adopts msg.scripture on sync
  assert.ok(
    projectorSource.includes('setOverlay(msg.scripture ?? null);'),
    'ProjectorClient must adopt msg.scripture on sync to survive projector reconnect/reload'
  );
});

// Absence guard helper for song set row layout in EditForm and CreateForm
function scanSongSetRowLayout(fileOrSource, filename) {
  let source;
  let label;
  if (typeof fileOrSource === 'string' && fs.existsSync(fileOrSource)) {
    source = fs.readFileSync(fileOrSource, 'utf8');
    label = filename || path.basename(fileOrSource);
  } else {
    source = String(fileOrSource);
    label = filename || 'source';
  }

  const findings = [];
  // Match the container of songSetEntries
  const containerMatch = source.match(
    /\{songSetEntries\.length === 0 \? \([\s\S]*?\)\s*:\s*\(\s*<div\s+className="([^"]*)"/
  );
  if (!containerMatch) {
    findings.push(`${label}: songSetEntries container not found`);
  } else {
    const classes = containerMatch[1];
    if (classes.includes('sm:grid-cols-2')) {
      findings.push(
        `${label}: song set list contains obsolete 2-column grid "sm:grid-cols-2"`
      );
    }
    if (classes.includes('grid')) {
      findings.push(
        `${label}: song set list root container should be a vertical stack, not a grid`
      );
    }
  }

  // Verify data-slot="song-set-row"
  const rowMatch = source.match(/data-slot="song-set-row"[\s\S]*?className="([^"]*)"/);
  if (!rowMatch) {
    findings.push(`${label}: missing data-slot="song-set-row" element`);
  }

  // Verify row controls container uses flex flex-wrap items-center gap-2.5 and does NOT use sm:grid-cols-2
  const innerControlsMatch = source.match(
    /data-slot="song-set-row"[\s\S]*?<div\s+className="([^"]*)"[\s\S]*?<Select\b/
  );
  if (!innerControlsMatch) {
    findings.push(`${label}: missing row controls container before Select`);
  } else {
    const innerClasses = innerControlsMatch[1];
    if (innerClasses.includes('sm:grid-cols-2')) {
      findings.push(`${label}: inner controls container contains obsolete sm:grid-cols-2`);
    }
    if (!innerClasses.includes('flex') || !innerClasses.includes('flex-wrap') || !innerClasses.includes('items-center')) {
      findings.push(`${label}: inner controls container missing flex flex-wrap items-center`);
    }
  }

  return findings;
}

test('SPEC-43-04: 18. EditForm and CreateForm organize song set inputs as 1 row per song instead of 2-column grid', () => {
  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');

  const editFindings = scanSongSetRowLayout(editFormPath, 'EditForm.tsx');
  assert.deepEqual(editFindings, [], 'EditForm.tsx must satisfy song set single-row layout');

  const createFindings = scanSongSetRowLayout(createFormPath, 'CreateForm.tsx');
  assert.deepEqual(createFindings, [], 'CreateForm.tsx must satisfy song set single-row layout');
});

test('SPEC-43-04: 19. Real-file defect injection proof for song set single-row layout guard in EditForm and CreateForm', () => {
  const targets = [
    { path: path.join(root, 'src', 'operator', 'EditForm.tsx'), name: 'EditForm.tsx' },
    { path: path.join(root, 'src', 'operator', 'CreateForm.tsx'), name: 'CreateForm.tsx' },
  ];

  for (const { path: filePath, name } of targets) {
    const pristine = fs.readFileSync(filePath, 'utf8');
    try {
      // 1. Pristine must pass
      assert.deepEqual(scanSongSetRowLayout(filePath, name), [], `${name} pristine must pass`);

      // 2. Form 1: outer 2-column grid defect injected into real file
      const defective1 = pristine.replace(
        /className="space-y-3">\s*\{songSetEntries\.map/,
        'className="grid gap-4 sm:grid-cols-2">\n                  {songSetEntries.map'
      );
      assert.notEqual(defective1, pristine);
      fs.writeFileSync(filePath, defective1, 'utf8');
      const findings1 = scanSongSetRowLayout(filePath, name);
      assert.ok(
        findings1.some((f) => f.includes('obsolete 2-column grid')),
        `Real-file injection on ${name} must detect obsolete 2-column grid`
      );

      // Restore and verify clean
      fs.writeFileSync(filePath, pristine, 'utf8');
      assert.deepEqual(scanSongSetRowLayout(filePath, name), []);

      // 3. Form 2: data-slot="song-set-row" defect injected into real file
      const defective2 = pristine.replace(
        'data-slot="song-set-row"',
        'data-slot="card"'
      );
      assert.notEqual(defective2, pristine);
      fs.writeFileSync(filePath, defective2, 'utf8');
      const findings2 = scanSongSetRowLayout(filePath, name);
      assert.ok(
        findings2.some((f) => f.includes('missing data-slot="song-set-row"')),
        `Real-file injection on ${name} must detect missing data-slot="song-set-row"`
      );

      // Restore and verify clean
      fs.writeFileSync(filePath, pristine, 'utf8');
      assert.deepEqual(scanSongSetRowLayout(filePath, name), []);

      // 4. Form 3: inner controls sm:grid-cols-2 defect injected into real file
      const defective3 = pristine.replace(
        'flex flex-wrap items-center gap-2.5',
        'grid grid-cols-1 sm:grid-cols-2 gap-2.5'
      );
      assert.notEqual(defective3, pristine);
      fs.writeFileSync(filePath, defective3, 'utf8');
      const findings3 = scanSongSetRowLayout(filePath, name);
      assert.ok(
        findings3.some((f) => f.includes('inner controls container contains obsolete sm:grid-cols-2')),
        `Real-file injection on ${name} must detect inner sm:grid-cols-2`
      );
    } finally {
      fs.writeFileSync(filePath, pristine, 'utf8');
    }
  }
});

test('SPEC-43-04: 20. Song set row layout aligns book selector, hymn autocomplete, background dropdown, and lyrics action in both forms', () => {
  const editFormPath = path.join(root, 'src', 'operator', 'EditForm.tsx');
  const createFormPath = path.join(root, 'src', 'operator', 'CreateForm.tsx');
  const editFormSource = fs.readFileSync(editFormPath, 'utf8');
  const createFormSource = fs.readFileSync(createFormPath, 'utf8');

  for (const [name, src] of [['EditForm.tsx', editFormSource], ['CreateForm.tsx', createFormSource]]) {
    // Verify structural row contains all 4 controls + lyrics action
    const rowSnippetMatch = src.match(
      /data-slot="song-set-row"[\s\S]*?<div\s+className="flex flex-wrap items-center gap-2\.5">([\s\S]*?)<\/div>\s*\{isLyricOpen/
    );
    assert.ok(rowSnippetMatch, `${name} must contain flex-wrap items-center row container`);
    const rowSnippet = rowSnippetMatch[1];

    assert.ok(
      rowSnippet.includes('value={current.songBookCode'),
      `${name} row must include Song Book select dropdown`
    );
    assert.ok(
      rowSnippet.includes('<HymnNumberAutocomplete'),
      `${name} row must include HymnNumberAutocomplete`
    );
    assert.ok(
      rowSnippet.includes("current.background || 'default'"),
      `${name} row must include Background selector`
    );
    assert.ok(
      rowSnippet.includes('toggleLyricEditor(entry.variableName)'),
      `${name} row must include lyrics toggle`
    );
  }
});
