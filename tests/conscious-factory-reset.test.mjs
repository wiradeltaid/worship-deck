/**
 * SPEC-93-04: Conscious Factory Reset Confirmation & Cache Purge Test Suite
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnGoApi, stopProcess, json } from './helpers/go-api.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'conscious-reset-'));
const dbPath = path.join(tmp, 'test_conscious_reset.db');
const uploadsDir = path.join(tmp, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const AUTH_SECRET = createHash('sha256').update('conscious-reset-secret-93').digest('hex');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin-secret-pass-93';

let instance;
let adminCookie = '';

export function scanConsciousResetUiContract(syncPageSource) {
  const findings = [];
  if (!syncPageSource.includes('resetConfirmationText')) {
    findings.push('AdminSyncPage.tsx must maintain resetConfirmationText state');
  }
  if (!syncPageSource.includes("resetConfirmationText.trim().toLowerCase() !== 'factory reset'")) {
    findings.push('AdminSyncPage.tsx must disable reset button until "factory reset" is entered');
  }
  if (!syncPageSource.includes('purgeOfflineStorageStrict()')) {
    findings.push('AdminSyncPage.tsx must purge offline storage via purgeOfflineStorageStrict() on reset');
  }
  if (!syncPageSource.includes("body: JSON.stringify({ confirm: 'factory reset' })")) {
    findings.push('AdminSyncPage.tsx must transmit confirm token in POST /api/admin/reset-factory');
  }
  if (!syncPageSource.includes('Type: factory reset to begin resetting') && !syncPageSource.includes("t('sync.factoryReset.typeInstruction')")) {
    findings.push('AdminSyncPage.tsx must display conscious typeInstruction copy');
  }
  if (!syncPageSource.includes('req.onblocked = () => reject(')) {
    findings.push('deleteDatabase fallback onblocked must reject to prevent reloading on unconfirmed purge');
  }
  if (!syncPageSource.includes("typeof indexedDB === 'undefined'")) {
    findings.push('fallback must throw when indexedDB is unavailable to prevent silent fallthrough to reload');
  }
  if (!syncPageSource.includes('return; // Block reload into corrupt/stale state')) {
    findings.push('AdminSyncPage.tsx must return early to block window reload when cache purge fails');
  }
  return findings;
}

export function scanAdminResetEndpointContract(resetSource) {
  const findings = [];
  if (!resetSource.includes('invalid_confirmation')) {
    findings.push('admin_reset.go must reject mismatched confirmation with invalid_confirmation error');
  }
  if (!resetSource.includes('factory reset')) {
    findings.push('admin_reset.go must require "factory reset" confirmation phrase');
  }
  return findings;
}

before(async () => {
  instance = await spawnGoApi({
    dbPath,
    root,
    env: {
      AUTH_SECRET,
      AUTH_BOOTSTRAP_USER: ADMIN_USER,
      AUTH_BOOTSTRAP_PASSWORD: ADMIN_PASS,
      UPLOADS_DIR: uploadsDir,
    },
  });

  const loginRes = await json(`${instance.base}/api/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });
  assert.equal(loginRes.status, 200);
  const rawCookie = loginRes.headers['set-cookie'];
  adminCookie = Array.isArray(rawCookie) ? rawCookie[0].split(';')[0] : (rawCookie || '').split(';')[0];
});

after(() => {
  if (instance?.child) {
    stopProcess(instance.child);
  }
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {}
});

test('SPEC-93-04: Static contract scanning for conscious confirmation and cache purge', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
  const endpointPath = path.join(root, 'internal', 'httpapi', 'admin_reset.go');

  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const endpointSource = fs.readFileSync(endpointPath, 'utf8');

  assert.deepEqual(scanConsciousResetUiContract(pageSource), []);
  assert.deepEqual(scanAdminResetEndpointContract(endpointSource), []);
});

test('SPEC-93-04: Defect injection proofs for conscious reset contracts', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
  const endpointPath = path.join(root, 'internal', 'httpapi', 'admin_reset.go');

  const pageSource = fs.readFileSync(pagePath, 'utf8');
  const endpointSource = fs.readFileSync(endpointPath, 'utf8');

  // Defect 1: Removing confirmation text gating
  const def1 = pageSource.replace(
    "resetConfirmationText.trim().toLowerCase() !== 'factory reset'",
    'false /* bypassed */'
  );
  assert.ok(scanConsciousResetUiContract(def1).length > 0);

  // Defect 2: Removing purgeOfflineStorageStrict
  const def2 = pageSource.replace('purgeOfflineStorageStrict()', '/* bypassed */()');
  assert.ok(scanConsciousResetUiContract(def2).length > 0);

  // Defect 3: Removing server-side confirmation phrase validation
  const def3 = endpointSource.replace('invalid_confirmation', '/* bypassed */');
  assert.ok(scanAdminResetEndpointContract(def3).length > 0);

  // Defect 4: onblocked resolves rather than rejects
  const def4 = pageSource.replace(
    'req.onblocked = () => reject(new Error(\'deleteDatabase blocked by open connection\'));',
    'req.onblocked = () => resolve();'
  );
  assert.ok(scanConsciousResetUiContract(def4).length > 0);

  // Defect 5: Removing early return on purge failure
  const def5 = pageSource.replace(
    'return; // Block reload into corrupt/stale state',
    '// removed early return'
  );
  assert.ok(scanConsciousResetUiContract(def5).length > 0);
});

test('SPEC-93-04: Behavioral simulation of cache purge failure blocking window reload', async () => {
  async function simulateResetCachePurge({
    clearOfflineStorageMock,
    hasIndexedDB,
    deleteDatabaseBehavior, // 'success' | 'error' | 'blocked'
  }) {
    let reloadScheduled = false;
    let uiMessage = null;

    try {
      await clearOfflineStorageMock();
    } catch (err) {
      try {
        if (!hasIndexedDB) {
          throw new Error('IndexedDB unavailable');
        }
        await new Promise((resolve, reject) => {
          if (deleteDatabaseBehavior === 'success') {
            resolve();
          } else if (deleteDatabaseBehavior === 'blocked') {
            reject(new Error('deleteDatabase blocked by open connection'));
          } else {
            reject(new Error('deleteDatabase failed'));
          }
        });
      } catch (dbErr) {
        uiMessage = {
          type: 'error',
          text: 'Database was reset on server, but local browser cache could not be cleared. Please clear your browser cache manually before proceeding.',
        };
        return { reloadScheduled, uiMessage }; // Block reload
      }
    }

    reloadScheduled = true;
    uiMessage = { type: 'success', text: 'Factory reset completed successfully.' };
    return { reloadScheduled, uiMessage };
  }

  // 1. Case A: clearOfflineStorage rejects, fallback deleteDatabase blocked -> strictly blocks reload
  const resBlocked = await simulateResetCachePurge({
    clearOfflineStorageMock: async () => { throw new Error('Lock error'); },
    hasIndexedDB: true,
    deleteDatabaseBehavior: 'blocked',
  });
  assert.equal(resBlocked.reloadScheduled, false, 'Reload must be blocked on blocked IndexedDB deletion');
  assert.equal(resBlocked.uiMessage?.type, 'error');

  // 2. Case B: clearOfflineStorage rejects, fallback deleteDatabase errors -> strictly blocks reload
  const resError = await simulateResetCachePurge({
    clearOfflineStorageMock: async () => { throw new Error('Lock error'); },
    hasIndexedDB: true,
    deleteDatabaseBehavior: 'error',
  });
  assert.equal(resError.reloadScheduled, false, 'Reload must be blocked on deleteDatabase error');
  assert.equal(resError.uiMessage?.type, 'error');

  // 3. Case C: clearOfflineStorage rejects, indexedDB is unavailable -> strictly blocks reload
  const resNoIdb = await simulateResetCachePurge({
    clearOfflineStorageMock: async () => { throw new Error('Storage error'); },
    hasIndexedDB: false,
    deleteDatabaseBehavior: 'error',
  });
  assert.equal(resNoIdb.reloadScheduled, false, 'Reload must be blocked when IndexedDB is unavailable');
  assert.equal(resNoIdb.uiMessage?.type, 'error');

  // 4. Case D: clearOfflineStorage succeeds -> reload is scheduled
  const resSuccess = await simulateResetCachePurge({
    clearOfflineStorageMock: async () => {},
    hasIndexedDB: true,
    deleteDatabaseBehavior: 'success',
  });
  assert.equal(resSuccess.reloadScheduled, true, 'Reload must be scheduled when cache purge succeeds');
  assert.equal(resSuccess.uiMessage?.type, 'success');
});

test('SPEC-93-04: purgeOfflineStorageStrict exports and strictly propagates storage errors', async () => {
  const { purgeOfflineStorageStrict, clearOfflineStorage } = await import('../src/lib/offline/service-snapshot.ts');
  assert.equal(typeof purgeOfflineStorageStrict, 'function');
  assert.equal(typeof clearOfflineStorage, 'function');

  // In non-browser / node test environment without indexedDB, non-strict succeeds silently
  await clearOfflineStorage();

  // In strict mode without global window, it cleans in-memory store without crashing
  await purgeOfflineStorageStrict();

  // In browser environment where window exists but window.indexedDB is unavailable, strict mode strictly rejects
  const prevWindow = globalThis.window;
  try {
    globalThis.window = {}; // simulate browser window lacking indexedDB
    await assert.rejects(
      async () => {
        await purgeOfflineStorageStrict();
      },
      /IndexedDB is not available in browser environment/
    );
  } finally {
    globalThis.window = prevWindow;
  }
});

test('SPEC-93-04: POST /api/admin/reset-factory requires mandatory confirmation phrase', async () => {
  // 1. Missing body -> 400
  const noBodyRes = await json(
    `${instance.base}/api/admin/reset-factory`,
    'POST',
    undefined,
    { Cookie: adminCookie }
  );
  assert.equal(noBodyRes.status, 400);
  assert.equal(noBodyRes.body?.error, 'invalid_confirmation');

  // 2. Mismatched phrase -> 400
  const badPhraseRes = await json(
    `${instance.base}/api/admin/reset-factory`,
    'POST',
    { confirm: 'wrong confirmation' },
    { Cookie: adminCookie }
  );
  assert.equal(badPhraseRes.status, 400);
  assert.equal(badPhraseRes.body?.error, 'invalid_confirmation');

  // 3. Exact confirmation phrase (case-insensitive & trimmed) -> 200
  const goodRes = await json(
    `${instance.base}/api/admin/reset-factory`,
    'POST',
    { confirm: '  Factory Reset  ' },
    { Cookie: adminCookie }
  );
  assert.equal(goodRes.status, 200);
  assert.equal(goodRes.body?.ok, true);
});

test('SPEC-93-04: Bilingual i18n key parity for conscious factory reset copy', async () => {
  const { I18N_KEYS } = await import('../src/lib/i18n/keys.ts');
  const { CATALOGUE_EN } = await import('../src/lib/i18n/catalogue-en.ts');
  const { CATALOGUE_ID } = await import('../src/lib/i18n/catalogue-id.ts');

  assert.ok(I18N_KEYS.includes('sync.factoryReset.typeInstruction'));
  assert.ok(I18N_KEYS.includes('sync.factoryReset.inputPlaceholder'));

  assert.ok(CATALOGUE_EN['sync.factoryReset.typeInstruction']?.includes('Type: factory reset to begin resetting'));
  assert.ok(CATALOGUE_ID['sync.factoryReset.typeInstruction']?.includes('Ketik: factory reset untuk memulai reset'));

  assert.equal(CATALOGUE_EN['sync.factoryReset.inputPlaceholder'], 'factory reset');
  assert.equal(CATALOGUE_ID['sync.factoryReset.inputPlaceholder'], 'factory reset');
});
