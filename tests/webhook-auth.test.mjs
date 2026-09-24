/**
 * Webhook secret gate: 401 wrong/missing, 503 unset env.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { assertWebhookSecretValue, readWebhookSecretFromHeaders } = await import(
  pathToFileURL(path.join(root, 'src', 'lib', 'webhook-auth.ts')).href
);

test('WEBHOOK_SECRET missing → 503', () => {
  const r = assertWebhookSecretValue(undefined, 'anything');
  assert.equal(r?.status, 503);
});

test('wrong secret → 401', () => {
  const r = assertWebhookSecretValue('correct', 'wrong');
  assert.equal(r?.status, 401);
});

test('missing provided secret → 401', () => {
  const r = assertWebhookSecretValue('correct', null);
  assert.equal(r?.status, 401);
});

test('matching secret → allow', () => {
  assert.equal(assertWebhookSecretValue('correct', 'correct'), null);
});

test('reads x-webhook-secret and Bearer', () => {
  assert.equal(
    readWebhookSecretFromHeaders({
      get: (n) => (n === 'x-webhook-secret' ? 'abc' : null),
    }),
    'abc'
  );
  assert.equal(
    readWebhookSecretFromHeaders({
      get: (n) => (n === 'authorization' ? 'Bearer xyz' : null),
    }),
    'xyz'
  );
});

test('WSD-H-05: scripts/setup.mjs does not generate or write WEBHOOK_SECRET', () => {
  const setupSource = fs.readFileSync(path.join(root, 'scripts', 'setup.mjs'), 'utf8');
  assert.ok(
    !setupSource.includes('WEBHOOK_SECRET'),
    'scripts/setup.mjs must NOT generate or write WEBHOOK_SECRET'
  );
});

test('WSD-H-05: .env.example does not declare WEBHOOK_SECRET', () => {
  const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  assert.ok(
    !envExample.includes('WEBHOOK_SECRET'),
    '.env.example must NOT declare WEBHOOK_SECRET'
  );
});

test('WSD-H-05: internal/httpapi/webhook.go unconditionally returns 503 Webhook intake is disabled', () => {
  const webhookGo = fs.readFileSync(path.join(root, 'internal', 'httpapi', 'webhook.go'), 'utf8');
  assert.match(
    webhookGo,
    /WebhookDisabledMessage\s*=\s*"Webhook intake is disabled in this release"/,
    'webhook.go must declare WebhookDisabledMessage'
  );
  assert.match(
    webhookGo,
    /writeError\(w,\s*http\.StatusServiceUnavailable,\s*WebhookDisabledMessage\)/,
    'postWebhook must unconditionally return HTTP 503 with WebhookDisabledMessage'
  );
});
