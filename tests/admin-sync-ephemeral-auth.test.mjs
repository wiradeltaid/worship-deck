/**
 * SPEC-88: React Admin Sync Ephemeral Remote Authentication & Storage Absence Guards
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const adminSyncPagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
const clientPath = path.join(root, 'src', 'lib', 'sync', 'client.ts');

const {
  SyncHttpError,
  loginRemote,
  getSyncStatus,
  pullSync,
  pushSync,
} = await import(pathToFileURL(clientPath).href);

test('SPEC-88-02: SyncHttpError class exports with status and name properties', () => {
  const err = new SyncHttpError('Forbidden access', 403);
  assert.equal(err.name, 'SyncHttpError');
  assert.equal(err.status, 403);
  assert.equal(err.message, 'Forbidden access');
  assert.ok(err instanceof Error);
});

test('SPEC-88-03: Absence Guard 1 — Legacy pairing code token placeholder is absent from AdminSyncPage', () => {
  const content = fs.readFileSync(adminSyncPagePath, 'utf8');
  assert.equal(
    content.includes('Bearer token or 6-digit pairing code'),
    false,
    'Legacy pairing code placeholder must be removed from AdminSyncPage'
  );
  assert.equal(
    content.includes('Device Authorization Token (Optional)'),
    false,
    'Legacy Device Authorization Token field must be removed'
  );
});

test('SPEC-88-03: Absence Guard 2 — Remote token is never saved to localStorage or sessionStorage', () => {
  const content = fs.readFileSync(adminSyncPagePath, 'utf8');
  assert.equal(
    content.includes("localStorage.setItem('wpw_sync_device_token'"),
    false,
    'wpw_sync_device_token must never be written to localStorage'
  );
  assert.equal(
    content.includes("sessionStorage.setItem('wpw_sync_device_token'"),
    false,
    'wpw_sync_device_token must never be written to sessionStorage'
  );
  assert.equal(
    content.includes("localStorage.setItem('wpw_sync_remote_token'"),
    false,
    'wpw_sync_remote_token must never be written to localStorage'
  );
  assert.equal(
    content.includes("sessionStorage.setItem('wpw_sync_remote_token'"),
    false,
    'wpw_sync_remote_token must never be written to sessionStorage'
  );
});

test('SPEC-88-03: Presence Guard — Ephemeral RemoteAuthDialog is wired in AdminSyncPage', () => {
  const content = fs.readFileSync(adminSyncPagePath, 'utf8');
  assert.ok(content.includes('Connect to Remote WorshipDeck Server'), 'Modal title must exist');
  assert.ok(content.includes('inMemoryRemoteToken'), 'inMemoryRemoteToken state must exist');
  assert.ok(content.includes('boundRemoteOrigin'), 'boundRemoteOrigin state must exist');
  assert.ok(content.includes('handleDisconnectRemote'), 'handleDisconnectRemote action must exist');
  assert.ok(content.includes('Local Workstation (Active Session)'), 'Local workstation chip must exist');
  assert.ok(content.includes('Remote Session Active (In-Memory)'), 'Remote active chip must exist');
  assert.ok(content.includes('Remote Cloud (Authentication Required)'), 'Auth required chip must exist');
});

test('SPEC-88-03: Defect Injection Proof — Injected legacy token placeholder fails Absence Guard', () => {
  const guard = (text) => {
    if (text.includes('Bearer token or 6-digit pairing code')) {
      throw new Error('Detected prohibited legacy token placeholder');
    }
    if (text.includes("localStorage.setItem('wpw_sync_device_token'")) {
      throw new Error('Detected prohibited device token persistence in localStorage');
    }
    return true;
  };

  // Proof 1: Clean file passes
  const clean = fs.readFileSync(adminSyncPagePath, 'utf8');
  assert.equal(guard(clean), true);

  // Proof 2: Injected legacy placeholder throws
  const defective1 = clean + '\n// placeholder="Bearer token or 6-digit pairing code"';
  assert.throws(() => guard(defective1), /Detected prohibited legacy token placeholder/);

  // Proof 3: Injected localStorage write throws
  const defective2 = clean + "\nlocalStorage.setItem('wpw_sync_device_token', token);";
  assert.throws(() => guard(defective2), /Detected prohibited device token persistence in localStorage/);
});

test('SPEC-88-02: loginRemote helper sends JSON credentials and returns token', async () => {
  // Unit test mock fetch for loginRemote
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url, opts) => {
      assert.equal(opts.method, 'POST');
      assert.equal(url, 'http://127.0.0.1:9999/api/auth/login');
      const body = JSON.parse(opts.body);
      if (body.username === 'admin' && body.password === 'valid-pass') {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ok: true, token: 'mock-valid-token-12345', role: 'admin' }),
        };
      }
      return {
        ok: false,
        status: 401,
        json: async () => ({ error: 'Invalid username or password' }),
      };
    };

    const res = await loginRemote('http://127.0.0.1:9999', 'admin', 'valid-pass');
    assert.equal(res.ok, true);
    assert.equal(res.token, 'mock-valid-token-12345');
    assert.equal(res.role, 'admin');

    await assert.rejects(
      async () => {
        await loginRemote('http://127.0.0.1:9999', 'admin', 'wrong-pass');
      },
      (err) => {
        assert.ok(err instanceof SyncHttpError);
        assert.equal(err.status, 401);
        assert.match(err.message, /Invalid username or password/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('SPEC-88-03: Security Guard — In-flight URL origin change discards stale token and boundRemoteOrigin guards token dispatch', () => {
  const content = fs.readFileSync(adminSyncPagePath, 'utf8');
  assert.ok(
    content.includes('currentOrigin !== submissionOrigin'),
    'handleAuthSubmit must discard login if remote URL was modified in flight'
  );
  assert.ok(
    content.includes('boundRemoteOrigin === targetOrigin'),
    'executePush/executePull must verify target origin matches bound origin before transmitting Authorization header'
  );
});

test('SPEC-88-03: Security Guard — Asset upload/check 401 errors are propagated to re-authentication flow', () => {
  const content = fs.readFileSync(adminSyncPagePath, 'utf8');
  assert.ok(
    content.includes('assetErr?.status === 401') && content.includes('throw assetErr'),
    'asset upload 401 error must be rethrown'
  );
  assert.ok(
    content.includes('checkErr?.status === 401') && content.includes('throw checkErr'),
    'asset check 401 error must be rethrown'
  );
});

test('SPEC-88-03: Security Guard — Conflict resolution handleResolveKeepLocal enforces bound origin and 401 recovery', () => {
  const content = fs.readFileSync(adminSyncPagePath, 'utf8');
  const keepLocalFn = content.slice(content.indexOf('const handleResolveKeepLocal ='), content.indexOf('const handleResolveUseCloud ='));
  assert.ok(
    keepLocalFn.includes('boundRemoteOrigin === targetOrigin'),
    'handleResolveKeepLocal must verify target origin matches boundRemoteOrigin before attaching token'
  );
  assert.ok(
    keepLocalFn.includes('err.status === 401') && keepLocalFn.includes('setInMemoryRemoteToken(null)'),
    'handleResolveKeepLocal must reset token and prompt re-auth on 401'
  );
});

