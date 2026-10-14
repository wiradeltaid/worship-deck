import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PAIRING_MODAL_PATH = path.join(ROOT, 'src', 'operator', 'pairing', 'CloudPairingModal.tsx');
const SYNC_INDICATOR_PATH = path.join(ROOT, 'src', 'operator', 'sync', 'FohSyncIndicator.tsx');
const HEADER_PATH = path.join(ROOT, 'src', 'components', 'Header.tsx');

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?<!https?:)\/\/.*$/gm, '');
}

export function scanPairingModalSource(source) {
  const clean = stripComments(source);
  return {
    hasTestIdSetupDialog: clean.includes('data-testid="cloud-pairing-setup-dialog"'),
    hasTestIdConnectedDialog: clean.includes('data-testid="cloud-pairing-connected-dialog"'),
    hasTestIdUrlInput: clean.includes('data-testid="pairing-url-input"'),
    hasTestIdTokenInput: clean.includes('data-testid="pairing-token-input"'),
    hasTestIdTestBtn: clean.includes('data-testid="pairing-test-btn"'),
    hasTestIdConnectBtn: clean.includes('data-testid="pairing-connect-btn"'),
    hasTestIdDisconnectBtn: clean.includes('data-testid="disconnect-pairing-btn"'),
    hasTestIdConfirmDisconnectBtn: clean.includes('data-testid="confirm-disconnect-btn"'),
    // Invariant: Connect button MUST be disabled until testSuccess is set (Opus K1.5 gate)
    hasConnectGate: clean.includes('disabled={!testSuccess'),
    // Invariant: Disconnect button MUST be disabled when stage is live (Opus K1.8)
    hasDisconnectLiveGuard: clean.includes('disabled={isStageLive}'),
    // Invariant: Synthetic congregation placeholder (Opus K0.1)
    hasSyntheticPlaceholder: clean.includes('https://gereja-anda.worshipdeck.org'),
    // Absence: Real congregation name bic.worshipdeck.org must NOT appear
    hasBicLeak: clean.includes('bic.worshipdeck.org'),
  };
}

export function scanSyncIndicatorSource(source) {
  const clean = stripComments(source);
  return {
    hasTestIdBadge: clean.includes('data-testid="foh-sync-status-badge"'),
    hasTestIdPopover: clean.includes('data-testid="foh-sync-popover"'),
    hasTestIdSyncBtn: clean.includes('data-testid="sync-from-cloud-btn"'),
    hasRoleStatus: clean.includes('role="status"'),
    // Invariant: Sync button disabled during presentation (K-FREEZE-01)
    hasLiveDisabled: clean.includes('disabled={isSyncing || isStageLive}'),
    // Copywriting: "Siap ibadah" (not locked to Sunday) and "Panggung tayang" (not confusing "beku")
    hasSiapIbadah: clean.includes('Siap ibadah'),
    hasPanggungTayang: clean.includes('Panggung tayang'),
  };
}

test('CloudPairingModal provides complete two-stage gate and accessibility contracts', () => {
  const source = readFileSync(PAIRING_MODAL_PATH, 'utf8');
  const scan = scanPairingModalSource(source);

  assert.ok(scan.hasTestIdSetupDialog, 'CloudPairingModal must render setup dialog testid');
  assert.ok(scan.hasTestIdConnectedDialog, 'CloudPairingModal must render connected dialog testid');
  assert.ok(scan.hasTestIdUrlInput, 'CloudPairingModal must provide pairing-url-input testid');
  assert.ok(scan.hasTestIdTokenInput, 'CloudPairingModal must provide pairing-token-input testid');
  assert.ok(scan.hasTestIdTestBtn, 'CloudPairingModal must provide pairing-test-btn testid');
  assert.ok(scan.hasTestIdConnectBtn, 'CloudPairingModal must provide pairing-connect-btn testid');
  assert.ok(scan.hasTestIdDisconnectBtn, 'CloudPairingModal must provide disconnect-pairing-btn testid');
  assert.ok(scan.hasTestIdConfirmDisconnectBtn, 'CloudPairingModal must provide confirm-disconnect-btn testid');

  // Invariant validation
  assert.ok(scan.hasConnectGate, 'Connect button must be gated behind test connection success');
  assert.ok(scan.hasDisconnectLiveGuard, 'Disconnect button must be disabled when stage is live');
  assert.ok(scan.hasSyntheticPlaceholder, 'Placeholder must use synthetic congregation gereja-anda.worshipdeck.org');
  assert.equal(scan.hasBicLeak, false, 'Real congregation name bic.worshipdeck.org must never be committed');
});

test('FohSyncIndicator provides stage readiness states, accessible status, and freeze guard', () => {
  const source = readFileSync(SYNC_INDICATOR_PATH, 'utf8');
  const scan = scanSyncIndicatorSource(source);

  assert.ok(scan.hasTestIdBadge, 'FohSyncIndicator must provide foh-sync-status-badge testid');
  assert.ok(scan.hasTestIdPopover, 'FohSyncIndicator must provide foh-sync-popover testid');
  assert.ok(scan.hasTestIdSyncBtn, 'FohSyncIndicator must provide sync-from-cloud-btn testid');
  assert.ok(scan.hasRoleStatus, 'Badge must carry role="status" for screen reader accessibility');
  assert.ok(scan.hasLiveDisabled, 'Sync button must be disabled during active presentation');
  assert.ok(scan.hasSiapIbadah, 'Readiness label must be "Siap ibadah"');
  assert.ok(scan.hasPanggungTayang, 'Live presentation state must be labeled "Panggung tayang"');
});

test('Header mounts FohSyncIndicator alongside operator navigation chrome', () => {
  const headerSource = readFileSync(HEADER_PATH, 'utf8');
  assert.ok(
    headerSource.includes("import FohSyncIndicator from '@/operator/sync/FohSyncIndicator';"),
    'Header must import FohSyncIndicator'
  );
  assert.ok(
    headerSource.includes('<FohSyncIndicator />'),
    'Header must render <FohSyncIndicator />'
  );
});

// Defect injection tests (red-to-green proofs)
test('Defect Injection: Connect gate bypass is caught', () => {
  const mutated = 'disabled={connecting}'; // Missing !testSuccess
  const scan = scanPairingModalSource(mutated);
  assert.equal(scan.hasConnectGate, false, 'Mutated source without !testSuccess must fail gate check');
});

test('Defect Injection: Live freeze bypass on sync button is caught', () => {
  const mutated = 'disabled={isSyncing}'; // Missing isStageLive
  const scan = scanSyncIndicatorSource(mutated);
  assert.equal(scan.hasLiveDisabled, false, 'Mutated source without isStageLive must fail freeze check');
});

test('Defect Injection: Missing role="status" is caught', () => {
  const mutated = '<button type="button" aria-label="Status">'; // Missing role="status"
  const scan = scanSyncIndicatorSource(mutated);
  assert.equal(scan.hasRoleStatus, false, 'Mutated source without role="status" must fail accessibility check');
});
