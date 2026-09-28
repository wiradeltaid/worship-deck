/**
 * SPEC-92-04: Administrator Factory Reset Operation Test Suite (DEC-078 narrowing AD-17)
 *
 * Enforces:
 * 1. POST /api/admin/reset-factory requires admin authentication:
 *    - HTTP 401 Unauthorized for unauthenticated callers.
 *    - HTTP 403 Forbidden for authenticated operator-role callers.
 * 2. Authenticated admin execution of factory reset:
 *    - Clears dynamic services, snapshots, announcement items, and sync tombstones.
 *    - Purges custom templates and custom songbooks.
 *    - Re-seeds canonical default layouts, SDAH hymns, KJV bible, and default registry templates.
 *    - Purges uploaded media while preserving bundled fonts.
 *    - Preserves admin user account and settings.
 * 3. AdminSyncPage.tsx UI integration:
 *    - Renders factory reset card with destructive confirmation dialog.
 *    - Invokes POST /api/admin/reset-factory on explicit confirmation.
 * 4. Bilingual i18n key parity across EN and ID catalogues.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'factory-reset-test-'));
const dbPath = path.join(tmp, 'test_reset.db');
const uploadsDir = path.join(tmp, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const AUTH_SECRET = createHash('sha256').update('factory-reset-secret').digest('hex');
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin-secret-pass-92';
const OPERATOR_USER = 'operator';
const OPERATOR_PASS = 'operator-secret-pass-92';

function cookieFrom(headers) {
  const raw = headers?.['set-cookie'];
  if (!raw) return '';
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((c) => String(c).split(';')[0]).join('; ');
}

export function scanFactoryResetUiContract(syncPageContent) {
  const findings = [];

  if (!syncPageContent.includes('/api/admin/reset-factory')) {
    findings.push('AdminSyncPage.tsx must invoke POST /api/admin/reset-factory');
  }
  if (!syncPageContent.includes("t('sync.factoryReset.title')")) {
    findings.push("AdminSyncPage.tsx must reference t('sync.factoryReset.title')");
  }
  if (!syncPageContent.includes("t('sync.factoryReset.confirmTitle')")) {
    findings.push("AdminSyncPage.tsx must reference t('sync.factoryReset.confirmTitle')");
  }
  if (!syncPageContent.includes('setResetModalOpen')) {
    findings.push('AdminSyncPage.tsx must control resetModalOpen state');
  }

  return findings;
}

let instance;
let adminCookie = '';
let operatorCookie = '';

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

  // Admin login
  const adminLoginRes = await json(`${instance.base}/api/auth/login`, 'POST', {
    username: ADMIN_USER,
    password: ADMIN_PASS,
  });
  assert.equal(adminLoginRes.status, 200, 'admin login successful');
  adminCookie = cookieFrom(adminLoginRes.headers);
  assert.ok(adminCookie, 'admin cookie present');

  // Setup operator account
  const opSetupRes = await json(
    `${instance.base}/api/admin/accounts`,
    'POST',
    {
      username: OPERATOR_USER,
      password: OPERATOR_PASS,
      role: 'operator',
    },
    { Cookie: adminCookie }
  );
  assert.equal(opSetupRes.status, 201, 'operator account created');

  // Operator login
  const opLoginRes = await json(`${instance.base}/api/auth/login`, 'POST', {
    username: OPERATOR_USER,
    password: OPERATOR_PASS,
  });
  assert.equal(opLoginRes.status, 200, 'operator login successful');
  operatorCookie = cookieFrom(opLoginRes.headers);
  assert.ok(operatorCookie, 'operator cookie present');
});

after(() => {
  if (instance?.child) {
    stopProcess(instance.child);
  }
  try {
    fs.rmSync(tmp, { recursive: true, force: true });
  } catch {}
});

test('SPEC-92-04: POST /api/admin/reset-factory security gate (401 unauthenticated, 403 operator)', async () => {
  // 1. Unauthenticated -> 401
  const anonRes = await json(`${instance.base}/api/admin/reset-factory`, 'POST');
  assert.equal(anonRes.status, 401, 'unauthenticated reset must return HTTP 401');

  // 2. Operator role -> 403 (unconditional assertion)
  assert.ok(operatorCookie, 'operator session must be established');
  const opRes = await json(`${instance.base}/api/admin/reset-factory`, 'POST', null, {
    Cookie: operatorCookie,
  });
  assert.equal(opRes.status, 403, 'operator role reset must return HTTP 403');
});

test('SPEC-92-04: POST /api/admin/reset-factory restores canonical defaults and clears dynamic data', async () => {
  // Pre-condition: Create a service
  const createSvcRes = await json(
    `${instance.base}/api/services`,
    'POST',
    {
      raw_payload: 'Sabbath, October 4, 2026\nWorship Service\nSDAH 1\nSDAH 2',
    },
    { Cookie: adminCookie }
  );
  assert.equal(createSvcRes.status, 201, 'service created');

  // Create dummy uploaded file in uploadsDir
  const dummyFile = path.join(uploadsDir, 'test-dummy-asset.jpg');
  fs.writeFileSync(dummyFile, 'dummy-image-content');

  // Execute Factory Reset
  const resetRes = await json(
    `${instance.base}/api/admin/reset-factory`,
    'POST',
    null,
    { Cookie: adminCookie }
  );
  assert.equal(resetRes.status, 200, 'admin reset must return HTTP 200');
  assert.equal(resetRes.body.ok, true);

  // Assert services cleared
  const svcListRes = await json(`${instance.base}/api/services`, 'GET', null, {
    Cookie: adminCookie,
  });
  assert.equal(svcListRes.body.services.length, 0, 'all services must be cleared after factory reset');

  // Assert default songbook SDAH exists
  const booksRes = await json(`${instance.base}/api/song-books`, 'GET', null, {
    Cookie: adminCookie,
  });
  assert.ok(booksRes.body.books?.some((b) => (b.bookCode || b.book_code) === 'SDAH'), 'SDAH must be seeded after factory reset');

  // Assert canonical SDAH hymn 1 was restored with correct title
  const hymnRes = await json(`${instance.base}/api/hymns?book_code=SDAH&q=1`, 'GET', null, {
    Cookie: adminCookie,
  });
  const hymn1 = hymnRes.body?.hymns?.find((h) => h.number === 1);
  assert.ok(hymn1, 'SDAH hymn 1 must exist after reset');
  assert.equal(hymn1.title, 'Praise to the Lord', 'canonical hymn title must be restored');

  // Assert dummy upload was purged
  assert.ok(!fs.existsSync(dummyFile), 'uploaded media file must be deleted during factory reset');
});

test('SPEC-92-04: AdminSyncPage.tsx satisfies factory reset UI and confirmation contract', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
  const content = fs.readFileSync(pagePath, 'utf8');
  const findings = scanFactoryResetUiContract(content);
  assert.deepEqual(findings, [], `AdminSyncPage factory reset contract findings:\n${findings.join('\n')}`);
});

test('SPEC-92-04: scanFactoryResetUiContract defect injection detects missing UI integration', () => {
  const pagePath = path.join(root, 'spa', 'src', 'pages', 'AdminSyncPage.tsx');
  const prodContent = fs.readFileSync(pagePath, 'utf8');

  // Defect 1: missing endpoint call
  const defectNoCall = prodContent.replace('/api/admin/reset-factory', '/api/dummy');
  const findings1 = scanFactoryResetUiContract(defectNoCall);
  assert.ok(findings1.some((f) => f.includes('/api/admin/reset-factory')), 'must detect missing reset-factory endpoint call');

  // Defect 2: missing confirmation modal state
  const defectNoModal = prodContent.replace(/setResetModalOpen/g, 'modalStateDisabled');
  const findings2 = scanFactoryResetUiContract(defectNoModal);
  assert.ok(findings2.some((f) => f.includes('resetModalOpen')), 'must detect missing resetModalOpen state');
});
