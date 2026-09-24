/**
 * SPEC-73: First admin setup screen and loopback endpoints (WSD-H-04)
 *
 * Verifies:
 * 1. Loopback setup endpoints in Go HTTP API (/api/setup/status and /api/setup/admin).
 * 2. Session gate exempts /api/setup for desktop loopback access.
 * 3. SPA LoginPage integrates first-run setup screen with password confirmation.
 * 4. i18n keys for setup form are complete across English and Indonesian catalogues.
 * 5. Absence guard & defect injection proof for setup gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

export function scanSetupSecurityGuards() {
  const findings = [];

  // 1. Verify gate.go has /api/setup in exemptPrefixes
  const gatePath = path.join(root, 'internal', 'gate', 'gate.go');
  const gateSource = fs.readFileSync(gatePath, 'utf8');
  if (!gateSource.includes('\t"/api/setup",') && !gateSource.includes('  "/api/setup",')) {
    findings.push('internal/gate/gate.go missing "/api/setup" in exemptPrefixes');
  }

  // 2. Verify server.go routes
  const serverPath = path.join(root, 'internal', 'httpapi', 'server.go');
  const serverSource = fs.readFileSync(serverPath, 'utf8');
  if (!serverSource.includes('GET /api/setup/status')) {
    findings.push('internal/httpapi/server.go missing GET /api/setup/status');
  }
  if (!serverSource.includes('POST /api/setup/admin')) {
    findings.push('internal/httpapi/server.go missing POST /api/setup/admin');
  }

  // 3. Verify LoginPage.tsx checks setup
  const loginPagePath = path.join(root, 'spa', 'src', 'pages', 'LoginPage.tsx');
  const loginSource = fs.readFileSync(loginPagePath, 'utf8');
  if (!loginSource.includes('/api/setup/status')) {
    findings.push('LoginPage.tsx missing /api/setup/status check');
  }
  if (!loginSource.includes('/api/setup/admin')) {
    findings.push('LoginPage.tsx missing /api/setup/admin submission');
  }
  if (!loginSource.includes('setup.confirmPassword')) {
    findings.push('LoginPage.tsx missing confirm password field for setup');
  }

  return findings;
}

test('WSD-H-04: first admin setup endpoint and UI wiring passes security scan', () => {
  const findings = scanSetupSecurityGuards();
  assert.deepEqual(findings, [], `Setup security guard findings:\n${findings.join('\n')}`);
});

test('WSD-H-04: guard proof — injected missing /api/setup in gate.go is caught', () => {
  const gatePath = path.join(root, 'internal', 'gate', 'gate.go');
  const original = fs.readFileSync(gatePath, 'utf8');
  try {
    const mutated = original.replace(/\t"\/api\/setup",\r?\n/, '');
    assert.notEqual(mutated, original);
    fs.writeFileSync(gatePath, mutated);
    const findings = scanSetupSecurityGuards();
    assert.ok(
      findings.some((f) => f.includes('gate.go missing "/api/setup"')),
      'Defect proof: scanner must detect missing /api/setup exemption'
    );
  } finally {
    fs.writeFileSync(gatePath, original);
  }
});

test('WSD-H-04: i18n setup catalogue completeness', () => {
  const keysPath = path.join(root, 'src', 'lib', 'i18n', 'keys.ts');
  const keysSource = fs.readFileSync(keysPath, 'utf8');

  const enPath = path.join(root, 'src', 'lib', 'i18n', 'catalogue-en.ts');
  const enSource = fs.readFileSync(enPath, 'utf8');

  const idPath = path.join(root, 'src', 'lib', 'i18n', 'catalogue-id.ts');
  const idSource = fs.readFileSync(idPath, 'utf8');

  const requiredSetupKeys = [
    'setup.title',
    'setup.subtitle',
    'setup.username',
    'setup.usernamePlaceholder',
    'setup.password',
    'setup.passwordPlaceholder',
    'setup.confirmPassword',
    'setup.confirmPasswordPlaceholder',
    'setup.passwordMismatch',
    'setup.submit',
    'setup.submitting',
    'setup.failed',
  ];

  for (const k of requiredSetupKeys) {
    assert.ok(keysSource.includes(`'${k}'`), `keys.ts missing ${k}`);
    assert.ok(enSource.includes(`'${k}':`), `catalogue-en.ts missing ${k}`);
    assert.ok(idSource.includes(`'${k}':`), `catalogue-id.ts missing ${k}`);
  }
});
