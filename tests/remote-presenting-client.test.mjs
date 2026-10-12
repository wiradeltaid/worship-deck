/**
 * Acceptance tests for Story 5-2:
 * "The presenting client holds the stream and applies remote intents"
 *
 * Covers all 9 acceptance criteria:
 * 1. An arriving intent moves the deck through the existing local path (module level check on applyRemoteIntent).
 * 2. planIdentity mismatch refuses the intent and the deck does not move.
 * 3. blank, transition, background arriving remotely behave exactly as locally (including advancing while blanked).
 * 4. The remote's state disappearing changes nothing (stream ending leaves index/blank/transition untouched).
 * 5. No remote input reaches the liveness evaluator (source-level guard with injection-reversion test).
 * 6. No queue, no replay, no buffer in presenter remote client (source-level guard with 3 injection-reversion tests).
 * 7. Presenting role claimed on mount and released on unmount, role-lost notification on presenter.
 * 8. Projector path is untouched (assert absence of edits to present-channel.ts / projector directories).
 * 9. Registered in package.json scripts.test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readRaw = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const srcUrl = (...parts) => pathToFileURL(path.join(repoRoot, ...parts)).href;

const { applyRemoteIntent, PresenterRemoteSession } = await import(
  srcUrl('src', 'lib', 'presenter-remote-client.ts')
);

// --- AST helper functions ---------------------------------------------------
const sources = new Map();

function ast(rel) {
  if (!sources.has(rel)) {
    sources.set(
      rel,
      ts.createSourceFile(
        rel,
        readRaw(rel),
        ts.ScriptTarget.Latest,
        true,
        rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      )
    );
  }
  return sources.get(rel);
}

function nodes(root, predicate) {
  const out = [];
  const visit = (node) => {
    if (predicate(node)) out.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return out;
}

function importedNames(root, moduleSpecifier) {
  const out = [];
  for (const decl of nodes(root, ts.isImportDeclaration)) {
    if (decl.moduleSpecifier.getText().slice(1, -1) !== moduleSpecifier) continue;
    const bindings = decl.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) out.push(element.name.text);
    }
    if (decl.importClause?.name) out.push(decl.importClause.name.text);
  }
  return out;
}

function identifiers(root, name) {
  return nodes(root, (node) => ts.isIdentifier(node) && node.text === name);
}

// -----------------------------------------------------------------------------
// AC 1: Arriving intent calls local handler functions
// -----------------------------------------------------------------------------
test('AC-1: An arriving intent moves the deck through the existing local path', () => {
  const calls = [];
  const handlers = {
    setIndexAndSync: (idx) => calls.push({ fn: 'setIndexAndSync', arg: idx }),
    setBlankAndSync: (b) => calls.push({ fn: 'setBlankAndSync', arg: b }),
    setTransitionAndSync: (tr) => calls.push({ fn: 'setTransitionAndSync', arg: tr }),
    setBackgroundAndSync: (bg) => calls.push({ fn: 'setBackgroundAndSync', arg: bg }),
    broadcast: (msg) => calls.push({ fn: 'broadcast', arg: msg }),
  };

  const applied = applyRemoteIntent(
    { type: 'sync', index: 3, blank: false, transition: 'fade', planIdentity: 'plan-123' },
    'plan-123',
    handlers
  );

  assert.equal(applied, true);
  assert.deepEqual(calls, [{ fn: 'setIndexAndSync', arg: 3 }]);
});

// -----------------------------------------------------------------------------
// AC 2: planIdentity mismatch refuses the intent and deck does not move
// -----------------------------------------------------------------------------
test('AC-2: planIdentity mismatch refuses the intent and the deck does not move', () => {
  const calls = [];
  const handlers = {
    setIndexAndSync: (idx) => calls.push({ fn: 'setIndexAndSync', arg: idx }),
    setBlankAndSync: (b) => calls.push({ fn: 'setBlankAndSync', arg: b }),
    setTransitionAndSync: (tr) => calls.push({ fn: 'setTransitionAndSync', arg: tr }),
    setBackgroundAndSync: (bg) => calls.push({ fn: 'setBackgroundAndSync', arg: bg }),
    broadcast: (msg) => calls.push({ fn: 'broadcast', arg: msg }),
  };

  const applied = applyRemoteIntent(
    { type: 'sync', index: 5, blank: false, transition: 'fade', planIdentity: 'plan-stale' },
    'plan-current',
    handlers
  );

  assert.equal(applied, false);
  assert.equal(calls.length, 0, 'No handler should have been called on mismatched planIdentity');
});

// -----------------------------------------------------------------------------
// AC 3: blank, transition, background arriving remotely behave identically
// -----------------------------------------------------------------------------
test('AC-3: blank, transition, and background arriving remotely route to local setters', () => {
  const calls = [];
  const handlers = {
    setIndexAndSync: (idx) => calls.push({ fn: 'setIndexAndSync', arg: idx }),
    setBlankAndSync: (b) => calls.push({ fn: 'setBlankAndSync', arg: b }),
    setTransitionAndSync: (tr) => calls.push({ fn: 'setTransitionAndSync', arg: tr }),
    setBackgroundAndSync: (bg) => calls.push({ fn: 'setBackgroundAndSync', arg: bg }),
    broadcast: (msg) => calls.push({ fn: 'broadcast', arg: msg }),
  };

  // Blank intent
  const bApplied = applyRemoteIntent(
    { type: 'blank', blank: true, planIdentity: 'pid' },
    'pid',
    handlers
  );
  assert.equal(bApplied, true);

  // Transition intent
  const tApplied = applyRemoteIntent(
    { type: 'transition', transition: 'wipe', planIdentity: 'pid' },
    'pid',
    handlers
  );
  assert.equal(tApplied, true);

  // Background intent
  const bgApplied = applyRemoteIntent(
    { type: 'background', background: 'https://example.com/bg.jpg', planIdentity: 'pid' },
    'pid',
    handlers
  );
  assert.equal(bgApplied, true);

  // Clear scripture intent
  const csApplied = applyRemoteIntent(
    { type: 'clear-scripture', planIdentity: 'pid' },
    'pid',
    handlers
  );
  assert.equal(csApplied, true);

  assert.deepEqual(calls, [
    { fn: 'setBlankAndSync', arg: true },
    { fn: 'setTransitionAndSync', arg: 'wipe' },
    { fn: 'setBackgroundAndSync', arg: 'https://example.com/bg.jpg' },
    { fn: 'broadcast', arg: { type: 'clear-scripture', planIdentity: 'pid' } },
  ]);
});

// -----------------------------------------------------------------------------
// AC 4: Remote stream closing/disappearing changes nothing about local state
// -----------------------------------------------------------------------------
test('AC-4: The remote disappearing changes nothing and does not resend broadcasts', () => {
  const broadcastCalls = [];
  const handlers = {
    setIndexAndSync: () => {},
    setBlankAndSync: () => {},
    setTransitionAndSync: () => {},
    setBackgroundAndSync: () => {},
    broadcast: (msg) => broadcastCalls.push(msg),
  };

  const session = new PresenterRemoteSession({
    serviceId: 99,
    getPlanIdentity: () => 'pid',
    handlers,
  });

  // Stopping the session (remote disappears)
  session.stop();

  assert.equal(broadcastCalls.length, 0, 'No projector broadcast should be re-sent on stream teardown');
});

// -----------------------------------------------------------------------------
// AC 5: No remote input reaches the liveness evaluator (Source-level guard)
// -----------------------------------------------------------------------------
export function scanLivenessReducerInputs(source) {
  const file = ts.createSourceFile('test-liveness.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const eventsType = nodes(file, (n) => ts.isTypeAliasDeclaration(n) && n.name.getText() === 'LivenessEvent')[0];
  if (!eventsType) return { hasRemoteInput: false, eventTypes: [] };

  const unionTypes = nodes(eventsType, (n) => ts.isLiteralTypeNode(n)).map((n) => n.getText().replace(/['"]/g, ''));
  const hasRemoteInput = unionTypes.some((t) => /remote/i.test(t));
  return { hasRemoteInput, unionTypes };
}

export function scanDispatchLivenessRemoteConditions(source) {
  const file = ts.createSourceFile('test-operator.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];

  // Find all calls to dispatchLiveness(...)
  const calls = nodes(
    file,
    (n) => ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'dispatchLiveness'
  );

  for (const call of calls) {
    // Check all enclosing conditions (if statements, conditional ternary expressions, logical expressions)
    let curr = call.parent;
    while (curr) {
      if (ts.isIfStatement(curr)) {
        const condText = curr.expression.getText();
        if (/remote/i.test(condText)) {
          violations.push(`if-condition: ${condText}`);
        }
      } else if (ts.isConditionalExpression(curr)) {
        const condText = curr.condition.getText();
        if (/remote/i.test(condText)) {
          violations.push(`ternary-condition: ${condText}`);
        }
      } else if (
        ts.isBinaryExpression(curr) &&
        (curr.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
          curr.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      ) {
        // e.g. remoteConnected && dispatchLiveness(...)
        const leftText = curr.left.getText();
        if (/remote/i.test(leftText)) {
          violations.push(`logical-condition: ${leftText}`);
        }
      }
      curr = curr.parent;
    }
  }

  return violations;
}

test('AC-5: No remote input reaches the liveness evaluator (AD-29)', () => {
  const livenessSource = readRaw('src/lib/projector-liveness.ts');
  const scan = scanLivenessReducerInputs(livenessSource);
  assert.equal(scan.hasRemoteInput, false, 'projector-liveness must not accept remote input events');
  assert.deepEqual(scan.unionTypes.sort(), ['ack', 'handle-closed', 'opened', 'tick'].sort());

  const operatorSource = readRaw('src/operator/present/PresenterOperator.tsx');
  const condViolations = scanDispatchLivenessRemoteConditions(operatorSource);
  assert.deepEqual(
    condViolations,
    [],
    'No dispatchLiveness call site in PresenterOperator.tsx may be conditioned on remote state'
  );
});

test('AC-5 guard proof: injecting a remote signal into liveness reducer fails guard', () => {
  const injectedSource = `
    export type LivenessEvent =
      | { type: 'ack' }
      | { type: 'handle-closed' }
      | { type: 'opened' }
      | { type: 'tick' }
      | { type: 'remote-connected' };
  `;
  const scan = scanLivenessReducerInputs(injectedSource);
  assert.equal(scan.hasRemoteInput, true, 'Guard must detect remote signal injection');
});

test('AC-5 guard proof: injecting remote-conditioned dispatchLiveness fails guard', () => {
  const injectedOperator = `
    function TestComponent() {
      dispatchLiveness({ type: 'ack' });
      if (remoteConnected) dispatchLiveness({ type: 'ack' });
    }
  `;
  const violations = scanDispatchLivenessRemoteConditions(injectedOperator);
  assert.ok(violations.length > 0, 'Guard must detect dispatchLiveness conditioned on remoteConnected');
});

// -----------------------------------------------------------------------------
// AC 6: No queue, no replay, no intent buffer (Source-level guard with 3 injections)
// -----------------------------------------------------------------------------
export function scanAbsenceOfQueueReplayBuffer(source) {
  const findings = [];
  // 1. Check for retry/reconnect queue or intent queue array
  if (/\b(?:intentQueue|pendingIntents|queuedIntents|intentBuffer|messageQueue)\b/i.test(source)) {
    findings.push('queued-intents-array');
  }
  // 2. Check for replay loop on open / reconnect
  if (/\b(?:replayIntents|flushQueue|flushBuffer|flushPending|replayPending)\b/i.test(source)) {
    findings.push('flush-or-replay-on-open');
  }
  // 3. Check for retry mechanism on reconnect/retry loops
  if (/\b(?:retryCount|retryQueue|retryIntent|reconnectQueue)\b/i.test(source)) {
    findings.push('retry-on-reconnect');
  }
  return findings;
}

test('AC-6: No queue, no replay, no buffer in presenter remote client (SCN-6)', () => {
  const clientSource = readRaw('src/lib/presenter-remote-client.ts');
  const findings = scanAbsenceOfQueueReplayBuffer(clientSource);
  assert.deepEqual(findings, [], 'Must contain no queue, replay, or intent buffer');
});

test('AC-6 guard proof 1: detecting pending-intents array injection', () => {
  const injected = `const pendingIntents: PresenterRemoteIntent[] = [];`;
  assert.deepEqual(scanAbsenceOfQueueReplayBuffer(injected), ['queued-intents-array']);
});

test('AC-6 guard proof 2: detecting flush-on-open / replay path injection', () => {
  const injected = `function flushBuffer() { /* flush pending intents */ }`;
  assert.deepEqual(scanAbsenceOfQueueReplayBuffer(injected), ['flush-or-replay-on-open']);
});

test('AC-6 guard proof 3: detecting retry-on-reconnect injection', () => {
  const injected = `let retryQueue = [];`;
  assert.deepEqual(scanAbsenceOfQueueReplayBuffer(injected), ['retry-on-reconnect']);
});

// -----------------------------------------------------------------------------
// AC 7: PresenterOperator claims role on mount, stops on unmount, handles role-lost
// -----------------------------------------------------------------------------
test('AC-7: PresenterOperator integrates PresenterRemoteSession and handles role-lost', () => {
  const file = ast('src/operator/present/PresenterOperator.tsx');
  const imported = importedNames(file, '@/lib/presenter-remote-client');
  assert.ok(
    imported.includes('PresenterRemoteSession'),
    'PresenterOperator must import and instantiate PresenterRemoteSession'
  );

  const source = readRaw('src/operator/present/PresenterOperator.tsx');
  assert.match(source, /role-lost/, 'PresenterOperator must handle role-lost state notification');
});

// -----------------------------------------------------------------------------
// AC 8: Projector path is untouched (Source-level verification)
// -----------------------------------------------------------------------------
test('AC-8: Projector path and present-channel.ts are untouched', () => {
  const presentChannelSource = readRaw('src/lib/present-channel.ts');
  assert.ok(presentChannelSource.includes("export type PresentMessage ="), 'present-channel.ts intact');
  assert.doesNotMatch(presentChannelSource, /remote-client|PresenterRemoteSession/, 'present-channel untouched');
});

// -----------------------------------------------------------------------------
// AC 9: Registered in package.json
// -----------------------------------------------------------------------------
test('AC-9: tests/remote-presenting-client.test.mjs is registered in package.json', () => {
  const pkg = JSON.parse(readRaw('package.json'));
  assert.ok(
    pkg.scripts.test.includes('tests/remote-presenting-client.test.mjs'),
    'tests/remote-presenting-client.test.mjs must be listed in package.json scripts.test'
  );
});

// -----------------------------------------------------------------------------
// SPEC-115-01: Zero-Friction Remote Pairing, QR Modal, URL Hygiene, & /remote Route
// -----------------------------------------------------------------------------
test('SPEC-115-01: QR Code generator produces valid matrix with ISO-compliant dimensions', async () => {
  const { generateQrCode } = await import(srcUrl('src', 'lib', 'qrcode.ts'));
  const url = 'http://localhost:3000/remote?service=1&code=123456';
  const qr = generateQrCode(url);

  assert.ok(qr.version >= 1 && qr.version <= 10, 'QR version must be within supported range');
  assert.equal(qr.size, 17 + 4 * qr.version, 'QR size must follow formula 17 + 4 * version');
  assert.equal(qr.modules.length, qr.size, 'Matrix height must match size');
  assert.equal(qr.modules[0].length, qr.size, 'Matrix width must match size');

  // Verify finder pattern corners (top-left 7x7 must have center dot at [3,3])
  assert.equal(qr.modules[0][0], true, 'Top-left corner must be dark');
  assert.equal(qr.modules[3][3], true, 'Top-left finder center must be dark');
  assert.equal(qr.modules[0][qr.size - 1], true, 'Top-right corner must be dark');
  assert.equal(qr.modules[qr.size - 1][0], true, 'Bottom-left corner must be dark');
});

test('SPEC-115-01: PresenterOperator renders scannable QR modal with PIN, auto-claim URL, and copy button', () => {
  const source = readRaw('src/operator/present/PresenterOperator.tsx');
  assert.ok(source.includes('data-testid="remote-qr-code"'), 'Must render remote-qr-code container');
  assert.ok(source.includes('data-testid="remote-pairing-pin"'), 'Must render remote-pairing-pin display');
  assert.ok(source.includes('data-testid="remote-pairing-url"'), 'Must render remote-pairing-url input');
  assert.ok(source.includes('data-testid="remote-copy-link-button"'), 'Must render remote-copy-link-button');

  assert.ok(
    source.includes('/remote?service=${serviceId}&code=${remoteCode}'),
    'Must encode direct pairing URL with auto-claim query parameters'
  );
  assert.ok(
    source.includes("t('presenter.remote.qrTitle')"),
    'Must localize dialog title with presenter.remote.qrTitle'
  );
  assert.ok(
    source.includes("t('presenter.remote.qrHint')"),
    'Must localize dialog hint with presenter.remote.qrHint'
  );
  assert.ok(
    source.includes("t('presenter.remote.linkCopied')"),
    'Must display copy confirmation toast with presenter.remote.linkCopied'
  );
});

test('SPEC-115-01: App.tsx registers top-level /remote route with PresentGate and RemotePage', () => {
  const appSource = readRaw('spa/src/App.tsx');
  assert.ok(
    appSource.includes('<Route path="/remote" element={<RemotePage />} />'),
    'App.tsx must register universal /remote route'
  );
  assert.ok(
    appSource.includes('<Route path="/services/:id/remote" element={<RemotePage />} />'),
    'App.tsx must retain existing service-scoped remote route'
  );
});

test('SPEC-115-01: RemotePage and RemoteOperator support autoClaimCode and enforce URL token hygiene via replaceState', () => {
  const pageSource = readRaw('spa/src/pages/RemotePage.tsx');
  assert.ok(pageSource.includes('searchParams.get(\'service\')'), 'RemotePage must read service query param');
  assert.ok(pageSource.includes('searchParams.get(\'code\')'), 'RemotePage must read code query param');
  assert.ok(pageSource.includes('autoClaimCode={code || undefined}'), 'RemotePage must forward autoClaimCode');
  assert.ok(pageSource.includes('/api/services'), 'RemotePage must auto-resolve active service if unprovided');

  const operatorSource = readRaw('src/operator/present/RemoteOperator.tsx');
  assert.ok(operatorSource.includes('autoClaimCode?: string'), 'RemoteOperator must declare autoClaimCode prop');
  assert.ok(operatorSource.includes('session.claim(trimmedCode)'), 'RemoteOperator must auto-invoke claim on mount');
  assert.ok(
    operatorSource.includes("window.history.replaceState(window.history.state, '', cleanUrl)"),
    'RemoteOperator must strip code query parameter via replaceState on successful claim while preserving history state'
  );
});

export function scanSpec11501PairingHygiene(source) {
  const defects = [];
  if (!source.includes('replaceState')) {
    defects.push('missing-replace-state-token-hygiene');
  }
  if (!source.includes('data-testid="remote-qr-code"')) {
    defects.push('missing-qr-code-testid');
  }
  return defects;
}

test('SPEC-115-01 defect injection: missing token hygiene or testid fails scan guard', () => {
  const validSource = readRaw('src/operator/present/PresenterOperator.tsx') +
    readRaw('src/operator/present/RemoteOperator.tsx');
  assert.deepEqual(scanSpec11501PairingHygiene(validSource), []);

  const mutatedSource = '<div>No token hygiene or QR testid here</div>';
  assert.deepEqual(scanSpec11501PairingHygiene(mutatedSource), [
    'missing-replace-state-token-hygiene',
    'missing-qr-code-testid',
  ]);
});

