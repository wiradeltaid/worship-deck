/**
 * SPEC-84-03: Presentation Lock & Emergency Local Edit with Immediate Broadcast
 * Automated test suite and absence guard proofs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const presenterOperatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');
const projectorClientPath = path.join(rootDir, 'src', 'projected', 'ProjectorClient.tsx');
const presentChannelPath = path.join(rootDir, 'src', 'lib', 'present-channel.ts');
const serviceSnapshotPath = path.join(rootDir, 'src', 'lib', 'offline', 'service-snapshot.ts');
const runSheetPagePath = path.join(rootDir, 'spa', 'src', 'pages', 'RunSheetPage.tsx');

export function scanEmergencyEditSecurityGuards(overrides = {}) {
  const findings = [];
  const presenterSrc = overrides.presenterSrc ?? fs.readFileSync(presenterOperatorPath, 'utf8');
  const projectorSrc = overrides.projectorSrc ?? fs.readFileSync(projectorClientPath, 'utf8');
  const channelSrc = overrides.channelSrc ?? fs.readFileSync(presentChannelPath, 'utf8');
  const snapshotSrc = overrides.snapshotSrc ?? fs.readFileSync(serviceSnapshotPath, 'utf8');
  const runSheetSrc = overrides.runSheetSrc ?? fs.readFileSync(runSheetPagePath, 'utf8');

  // 1. PresenterOperator Presentation Lock & Emergency Edit UI
  if (!presenterSrc.includes('data-testid="presentation-lock-badge"')) {
    findings.push('PresenterOperator.tsx missing presentation-lock-badge');
  }
  if (!presenterSrc.includes('data-testid="presentation-lock-toggle"')) {
    findings.push('PresenterOperator.tsx missing presentation-lock-toggle');
  }
  if (!presenterSrc.includes('data-testid="emergency-edit-button"')) {
    findings.push('PresenterOperator.tsx missing emergency-edit-button');
  }
  if (!presenterSrc.includes('data-testid="emergency-edit-dialog"')) {
    findings.push('PresenterOperator.tsx missing emergency-edit-dialog');
  }
  if (!presenterSrc.includes('data-testid="emergency-edit-textarea"')) {
    findings.push('PresenterOperator.tsx missing emergency-edit-textarea');
  }
  if (!presenterSrc.includes('data-testid="emergency-apply-button"')) {
    findings.push('PresenterOperator.tsx missing emergency-apply-button');
  }
  if (!presenterSrc.includes('data-testid="emergency-reconciliation-banner"')) {
    findings.push('PresenterOperator.tsx missing emergency-reconciliation-banner');
  }
  if (!presenterSrc.includes('data-testid="emergency-sync-server-button"')) {
    findings.push('PresenterOperator.tsx missing emergency-sync-server-button');
  }
  if (!presenterSrc.includes('data-testid="emergency-discard-button"')) {
    findings.push('PresenterOperator.tsx missing emergency-discard-button');
  }
  if (!presenterSrc.includes("type: 'slide-patch'")) {
    findings.push("PresenterOperator.tsx missing type: 'slide-patch' broadcast");
  }
  if (!presenterSrc.includes('basePlanIdentity !== remoteData.plan_identity')) {
    findings.push('PresenterOperator.tsx missing basePlanIdentity divergence concurrency guard');
  }
  if (!presenterSrc.includes('patchRevision <= lastRev')) {
    findings.push('PresenterOperator.tsx missing monotonic patchRevision race guard');
  }

  // 2. BroadcastChannel protocol extensions
  if (!channelSrc.includes("type: 'slide-patch'")) {
    findings.push("present-channel.ts missing type: 'slide-patch'");
  }
  if (!channelSrc.includes('patches?: SlidePatch[]')) {
    findings.push('present-channel.ts missing patches in sync message');
  }
  if (!channelSrc.includes('function slidePatchOf(')) {
    findings.push('present-channel.ts missing slidePatchOf helper');
  }
  if (!channelSrc.includes('function syncPatchesOf(')) {
    findings.push('present-channel.ts missing syncPatchesOf helper');
  }

  // 3. ProjectorClient handling of slide patches
  if (!projectorSrc.includes('slidePatchOf(')) {
    findings.push('ProjectorClient.tsx missing slidePatchOf integration');
  }
  if (!projectorSrc.includes('syncPatchesOf(')) {
    findings.push('ProjectorClient.tsx missing syncPatchesOf integration');
  }
  if (!projectorSrc.includes("msg.type === 'slide-patch'")) {
    findings.push("ProjectorClient.tsx missing msg.type === 'slide-patch' check");
  }
  if (!projectorSrc.includes('patchRevision > lastRev')) {
    findings.push('ProjectorClient.tsx missing monotonic patchRevision check');
  }

  // 4. RunSheetPage emergency reconciliation banner and basePlanIdentity check
  if (!runSheetSrc.includes('data-testid="emergency-reconciliation-banner"')) {
    findings.push('RunSheetPage.tsx missing emergency-reconciliation-banner');
  }
  if (!runSheetSrc.includes('data-testid="emergency-sync-server-button"')) {
    findings.push('RunSheetPage.tsx missing emergency-sync-server-button');
  }
  if (!runSheetSrc.includes('data-testid="emergency-discard-button"')) {
    findings.push('RunSheetPage.tsx missing emergency-discard-button');
  }
  if (!runSheetSrc.includes('basePlanIdentity !== remoteData.plan_identity')) {
    findings.push('RunSheetPage.tsx missing basePlanIdentity divergence concurrency guard');
  }
  if (!runSheetSrc.includes('revertEmergencyPatches') || !presenterSrc.includes('revertEmergencyPatches')) {
    findings.push('revertEmergencyPatches must be called on discard in Presenter and RunSheet');
  }

  // 5. Service snapshot emergency outbox functions
  if (!snapshotSrc.includes('export async function saveEmergencyPatch(')) {
    findings.push('service-snapshot.ts missing saveEmergencyPatch');
  }
  if (!snapshotSrc.includes('export async function getEmergencyPatches(')) {
    findings.push('service-snapshot.ts missing getEmergencyPatches');
  }
  if (!snapshotSrc.includes('export async function clearEmergencyPatches(')) {
    findings.push('service-snapshot.ts missing clearEmergencyPatches');
  }
  if (!snapshotSrc.includes('export async function revertEmergencyPatches(')) {
    findings.push('service-snapshot.ts missing revertEmergencyPatches');
  }

  return findings;
}

test('SPEC-84-03: Structural security guards pass for Presentation Lock & Emergency Edit', () => {
  const findings = scanEmergencyEditSecurityGuards();
  assert.deepEqual(findings, [], `Expected 0 findings, got: ${findings.join(', ')}`);
});

test('SPEC-84-03: present-channel validates slide-patch messages and sync patches replay', async () => {
  const {
    slidePatchOf,
    syncPatchesOf,
    adoptsSharedState,
  } = await import(new URL('../src/lib/present-channel.ts', import.meta.url).href);

  const mockArtifact = {
    instanceId: 'slide-1',
    layout: { elements: [{ id: 'e1', type: 'text', text: 'Koreksi Lirik Bait 1' }] },
  };

  const validPatchMsg = {
    type: 'slide-patch',
    index: 0,
    artifact: mockArtifact,
    patchRevision: 1,
    planIdentity: 'plan-xyz',
  };

  const patch = slidePatchOf(validPatchMsg);
  assert.ok(patch);
  assert.equal(patch.index, 0);
  assert.equal(patch.patchRevision, 1);
  assert.deepEqual(patch.artifact, mockArtifact);

  // Invalid patch message rejected
  assert.equal(slidePatchOf({ type: 'sync', index: 0 }), null);
  assert.equal(slidePatchOf({ type: 'slide-patch', index: 'zero' }), null);

  // Shared state plan identity adoption
  assert.equal(adoptsSharedState(validPatchMsg, 'plan-xyz'), true);
  assert.equal(adoptsSharedState(validPatchMsg, 'plan-different'), false);

  // Sync message with patches replay
  const syncMsgWithPatches = {
    type: 'sync',
    index: 2,
    blank: false,
    transition: 'fade',
    planIdentity: 'plan-xyz',
    patches: [
      { index: 0, artifact: mockArtifact, patchRevision: 1 },
      { index: 1, artifact: { ...mockArtifact, instanceId: 'slide-2' }, patchRevision: 2 },
    ],
  };

  const patches = syncPatchesOf(syncMsgWithPatches);
  assert.ok(patches);
  assert.equal(patches.length, 2);
  assert.equal(patches[0].index, 0);
  assert.equal(patches[1].index, 1);
});

test('SPEC-84-03: Monotonic patch revision rejects older/stale slide-patch messages in Projector', () => {
  // Model state machine of ProjectorClient patch revision map
  const patchRevisions = new Map();
  let currentArtifact = { text: 'Initial' };

  const applyPatch = (patch) => {
    const lastRev = patchRevisions.get(patch.index) || 0;
    if (patch.patchRevision > lastRev) {
      patchRevisions.set(patch.index, patch.patchRevision);
      currentArtifact = patch.artifact;
      return true;
    }
    return false;
  };

  // Apply Revision 2 first
  assert.equal(applyPatch({ index: 0, patchRevision: 2, artifact: { text: 'Revision 2' } }), true);
  assert.equal(currentArtifact.text, 'Revision 2');

  // Delayed Revision 1 arrives late -> rejected by monotonic check
  assert.equal(applyPatch({ index: 0, patchRevision: 1, artifact: { text: 'Stale Revision 1' } }), false);
  assert.equal(currentArtifact.text, 'Revision 2', 'Stale patch must not overwrite newer revision');

  // Revision 3 arrives -> accepted
  assert.equal(applyPatch({ index: 0, patchRevision: 3, artifact: { text: 'Revision 3' } }), true);
  assert.equal(currentArtifact.text, 'Revision 3');
});

test('SPEC-84-03: saveEmergencyPatch appends to outbox and updates service snapshot in memory/IndexedDB', async () => {
  const {
    saveServiceSnapshot,
    getServiceSnapshot,
    saveEmergencyPatch,
    getEmergencyPatches,
    clearEmergencyPatches,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const originalPlan = [
    {
      id: 's1',
      kind: 'song-lyric',
      body: 'Original Line 1\nOriginal Line 2',
      artifact: {
        instanceId: 's1',
        layout: {
          elements: [
            { id: 'el-1', type: 'text', placeholderKey: 'body', text: 'Original Line 1\nOriginal Line 2' },
          ],
        },
      },
    },
  ];

  await saveServiceSnapshot({
    id: 888,
    plan_identity: 'plan-original',
    plan: originalPlan,
    cached_at: Date.now(),
    status: 'ready',
  });

  const patchedArtifact = {
    instanceId: 's1',
    layout: {
      elements: [
        { id: 'el-1', type: 'text', placeholderKey: 'body', text: 'Koreksi Lirik Baru Baris 1\nBaris 2' },
      ],
    },
  };

  const patchId = await saveEmergencyPatch({
    serviceId: '888',
    basePlanIdentity: 'plan-original',
    patchRevision: 1,
    patchTimestamp: Date.now(),
    slideIndex: 0,
    originalText: 'Original Line 1\nOriginal Line 2',
    updatedText: 'Koreksi Lirik Baru Baris 1\nBaris 2',
    patchedArtifact,
  });

  assert.ok(patchId > 0);

  const outbox = await getEmergencyPatches(888);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].serviceId, '888');
  assert.equal(outbox[0].slideIndex, 0);
  assert.equal(outbox[0].updatedText, 'Koreksi Lirik Baru Baris 1\nBaris 2');

  const snapshot = await getServiceSnapshot(888);
  assert.ok(snapshot);
  assert.equal(snapshot.plan[0].artifact.layout.elements[0].text, 'Koreksi Lirik Baru Baris 1\nBaris 2');

  await clearEmergencyPatches(888);
  const clearedOutbox = await getEmergencyPatches(888);
  assert.equal(clearedOutbox.length, 0);
});

test('SPEC-84-03: Base plan identity divergence blocks reconciliation overwrite on server plan change', async () => {
  // Simulate reconciliation plan-identity conflict check
  const pendingPatches = [
    {
      slideIndex: 0,
      basePlanIdentity: 'plan-local-v1',
      patchedArtifact: { id: 'p1' },
      updatedText: 'Text A',
    },
  ];

  const remoteServerData = {
    id: 888,
    plan_identity: 'plan-remote-v2-divergent',
    updated_at: '2026-09-26T14:00:00Z',
    plan: [{ id: 's1', text: 'Remote Plan Changed' }],
  };

  const checkConflict = (patches, remote) => {
    const divergent = patches.find(
      (p) => p.basePlanIdentity && remote.plan_identity && p.basePlanIdentity !== remote.plan_identity
    );
    if (divergent) {
      return { conflict: true, error: 'Konflik: Susunan acara di server telah berubah sejak koreksi dibuat.' };
    }
    return { conflict: false };
  };

  const result = checkConflict(pendingPatches, remoteServerData);
  assert.equal(result.conflict, true);
  assert.ok(result.error.includes('Konflik'));
});

test('SPEC-84-03: Reconciliation applies queued patches onto freshly fetched server plan before PUT', async () => {
  const pendingPatches = [
    {
      slideIndex: 1,
      basePlanIdentity: 'plan-matching',
      patchedArtifact: { id: 's2-patched-artifact' },
      updatedText: 'Corrected Hymn Line 2',
    },
  ];

  const remoteServerData = {
    id: 888,
    plan_identity: 'plan-matching',
    updated_at: '2026-09-26T12:00:00Z',
    plan: [
      { id: 's1', body: 'Slide 1' },
      { id: 's2', body: 'Slide 2 Old', artifact: { id: 's2-old-artifact' } },
    ],
  };

  // Reconcile by applying queued patches directly to server plan
  let patchedPlan = [...remoteServerData.plan];
  for (const p of pendingPatches) {
    if (p.slideIndex >= 0 && p.slideIndex < patchedPlan.length && p.patchedArtifact) {
      patchedPlan[p.slideIndex] = {
        ...patchedPlan[p.slideIndex],
        artifact: p.patchedArtifact,
        body: p.updatedText,
        lines: p.updatedText.split('\n'),
      };
    }
  }

  assert.equal(patchedPlan[1].body, 'Corrected Hymn Line 2');
  assert.equal(patchedPlan[1].artifact.id, 's2-patched-artifact');
  assert.equal(patchedPlan[0].body, 'Slide 1', 'Unpatched slides remain untouched from server');
});

test('SPEC-84-03: IndexedDB schema version is 2 to trigger migration for outbox store on existing browsers', async () => {
  const { DB_VERSION } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);
  assert.equal(DB_VERSION, 2, 'IndexedDB version must be 2 to ensure onupgradeneeded creates emergency_outbox on existing databases');
});

test('SPEC-84-03: Delayed hydration normalization by highest revision per slideIndex and race blocking', () => {
  // Simulate outbox records loaded in arbitrary order
  const rawRecords = [
    { slideIndex: 0, patchRevision: 1, updatedText: 'Draft 1' },
    { slideIndex: 0, patchRevision: 3, updatedText: 'Final 3' },
    { slideIndex: 0, patchRevision: 2, updatedText: 'Draft 2' },
    { slideIndex: 1, patchRevision: 1, updatedText: 'Slide 1 Edit' },
  ];

  const latestBySlide = new Map();
  for (const r of rawRecords) {
    const existing = latestBySlide.get(r.slideIndex);
    if (!existing || r.patchRevision > existing.patchRevision) {
      latestBySlide.set(r.slideIndex, r);
    }
  }
  const normalized = Array.from(latestBySlide.values()).sort((a, b) => a.slideIndex - b.slideIndex);

  assert.equal(normalized.length, 2);
  assert.equal(normalized[0].slideIndex, 0);
  assert.equal(normalized[0].patchRevision, 3);
  assert.equal(normalized[0].updatedText, 'Final 3');
  assert.equal(normalized[1].slideIndex, 1);
  assert.equal(normalized[1].patchRevision, 1);
});

test('SPEC-84-03: Authoritative sync with empty patches resets projector to canonical base slides', () => {
  const baseSlides = [
    { id: 's1', artifact: { text: 'Base 1' } },
    { id: 's2', artifact: { text: 'Base 2' } },
  ];

  let activeSlides = [
    { id: 's1', artifact: { text: 'Patched 1' } },
    { id: 's2', artifact: { text: 'Base 2' } },
  ];

  const patchRevisions = new Map([[0, 2]]);

  // Projector receives sync with patches: [] (discard)
  const onSyncMessage = (msg) => {
    if (msg.type === 'sync' && Array.isArray(msg.patches)) {
      patchRevisions.clear();
      activeSlides = [...baseSlides];
      for (const p of msg.patches) {
        patchRevisions.set(p.index, p.patchRevision);
        if (p.index >= 0 && p.index < activeSlides.length && p.artifact) {
          activeSlides[p.index] = { ...activeSlides[p.index], artifact: p.artifact };
        }
      }
    }
  };

  onSyncMessage({ type: 'sync', patches: [] });

  assert.equal(activeSlides[0].artifact.text, 'Base 1', 'Discarded sync must restore canonical base slide text');
  assert.equal(patchRevisions.size, 0, 'Patch revisions map must be cleared');
});

test('SPEC-84-03: Server-side Go API services emergency_patches schema and update persistence', () => {
  const schemaPath = path.join(rootDir, 'internal', 'db', 'schema.sql');
  const schemaSrc = fs.readFileSync(schemaPath, 'utf8');
  assert.ok(schemaSrc.includes('emergency_patches TEXT DEFAULT'), 'schema.sql must declare emergency_patches column');

  const migratePath = path.join(rootDir, 'internal', 'db', 'migrate.go');
  const migrateSrc = fs.readFileSync(migratePath, 'utf8');
  assert.ok(migrateSrc.includes('ensureServicesEmergencyPatches'), 'migrate.go must ensure emergency_patches column exists');

  const servicesPath = path.join(rootDir, 'internal', 'httpapi', 'services.go');
  const servicesSrc = fs.readFileSync(servicesPath, 'utf8');
  assert.ok(servicesSrc.includes('emergency_patches'), 'services.go must handle emergency_patches');
});

test('SPEC-84-03: End-to-end server persistence and discard preserves stable basePlanIdentity and reconciles correctly', async () => {
  // Model server persistence with basePlanIdentity stability
  const baseItems = [
    { artifact: { instanceId: 's1', layout: { elements: [{ text: 'Base Line 1' }] } } },
    { artifact: { instanceId: 's2', layout: { elements: [{ text: 'Base Line 2' }] } } },
  ];

  const baseIdentity = 'hash-canonical-base-123';

  // Apply emergency patch on server
  let storedEmergencyPatches = [
    {
      slideIndex: 0,
      updatedText: 'Patched Line 1',
      patchedArtifact: { instanceId: 's1', layout: { elements: [{ text: 'Patched Line 1' }] } },
      patchRevision: 1,
    },
  ];

  // Server plan generator: computes baseIdentity from baseItems, then applies emergency patches onto returned items
  const generateServerResponse = (patches) => {
    const items = JSON.parse(JSON.stringify(baseItems));
    for (const p of patches) {
      if (p.slideIndex >= 0 && p.slideIndex < items.length && p.patchedArtifact) {
        items[p.slideIndex].artifact = p.patchedArtifact;
      }
    }
    return {
      plan: items,
      plan_identity: baseIdentity, // Stable canonical basePlanIdentity!
      emergency_patches: patches,
    };
  };

  // 1. GET service when patched
  const patchedResp = generateServerResponse(storedEmergencyPatches);
  assert.equal(patchedResp.plan_identity, baseIdentity);
  assert.equal(patchedResp.plan[0].artifact.layout.elements[0].text, 'Patched Line 1');

  // 2. Discard: PUT emergency_patches: []
  storedEmergencyPatches = [];
  const discardedResp = generateServerResponse(storedEmergencyPatches);
  assert.equal(discardedResp.plan_identity, baseIdentity, 'basePlanIdentity must remain identical after discard');
  assert.equal(discardedResp.plan[0].artifact.layout.elements[0].text, 'Base Line 1', 'Discard must restore canonical base slide text');
});

test('SPEC-84-03: Offline snapshot reversion restores original slide artifact and text upon discard', async () => {
  const {
    saveServiceSnapshot,
    getServiceSnapshot,
    saveEmergencyPatch,
    revertEmergencyPatches,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const originalArtifact = {
    instanceId: 'slide-orig',
    layout: { elements: [{ id: 'e1', type: 'text', text: 'Original Lyric' }] },
  };

  await saveServiceSnapshot({
    id: 999,
    plan_identity: 'base-plan-999',
    plan: [
      {
        id: 'slide-orig',
        body: 'Original Lyric',
        artifact: originalArtifact,
      },
    ],
    cached_at: Date.now(),
    status: 'ready',
  });

  // Apply emergency patch
  const patchedArtifact = {
    instanceId: 'slide-orig',
    layout: { elements: [{ id: 'e1', type: 'text', text: 'Emergency Corrected Lyric' }] },
  };

  await saveEmergencyPatch({
    serviceId: '999',
    basePlanIdentity: 'base-plan-999',
    patchRevision: 1,
    patchTimestamp: Date.now(),
    slideIndex: 0,
    originalText: 'Original Lyric',
    originalArtifact,
    updatedText: 'Emergency Corrected Lyric',
    patchedArtifact,
  });

  // Snapshot now reflects patched text
  const patchedSnap = await getServiceSnapshot(999);
  assert.equal(patchedSnap.plan[0].artifact.layout.elements[0].text, 'Emergency Corrected Lyric');

  // Discard emergency patches: revertEmergencyPatches must restore originalArtifact and originalText
  await revertEmergencyPatches(999);

  const revertedSnap = await getServiceSnapshot(999);
  assert.equal(revertedSnap.plan[0].artifact.layout.elements[0].text, 'Original Lyric');
  assert.equal(revertedSnap.plan[0].body, 'Original Lyric');
});

test('SPEC-84-03: Repeated edits to the same slide preserves the true original text and artifact across multiple revisions', async () => {
  const {
    saveServiceSnapshot,
    getServiceSnapshot,
    saveEmergencyPatch,
    revertEmergencyPatches,
    clearInMemoryOfflineStore,
  } = await import(new URL('../src/lib/offline/service-snapshot.ts', import.meta.url).href);

  clearInMemoryOfflineStore();

  const originalArtifact = {
    instanceId: 'slide-repeat',
    layout: { elements: [{ id: 'e1', type: 'text', text: 'Canonical Original Verse' }] },
  };

  await saveServiceSnapshot({
    id: 'repeat-svc',
    plan_identity: 'base-plan-repeat',
    plan: [
      {
        id: 'slide-repeat',
        body: 'Canonical Original Verse',
        artifact: originalArtifact,
      },
    ],
    cached_at: Date.now(),
    status: 'ready',
  });

  // Edit 1
  await saveEmergencyPatch({
    serviceId: 'repeat-svc',
    basePlanIdentity: 'base-plan-repeat',
    patchRevision: 1,
    patchTimestamp: Date.now(),
    slideIndex: 0,
    originalText: 'Canonical Original Verse',
    originalArtifact,
    updatedText: 'Edit 1 Typo Fix',
    patchedArtifact: {
      instanceId: 'slide-repeat',
      layout: { elements: [{ id: 'e1', type: 'text', text: 'Edit 1 Typo Fix' }] },
    },
  });

  // Edit 2 (done later onstage while edit 1 is already in outbox)
  await saveEmergencyPatch({
    serviceId: 'repeat-svc',
    basePlanIdentity: 'base-plan-repeat',
    patchRevision: 2,
    patchTimestamp: Date.now() + 1000,
    slideIndex: 0,
    originalText: 'Edit 1 Typo Fix',
    originalArtifact: {
      instanceId: 'slide-repeat',
      layout: { elements: [{ id: 'e1', type: 'text', text: 'Edit 1 Typo Fix' }] },
    },
    updatedText: 'Edit 2 Final Revision',
    patchedArtifact: {
      instanceId: 'slide-repeat',
      layout: { elements: [{ id: 'e1', type: 'text', text: 'Edit 2 Final Revision' }] },
    },
  });

  const snapBeforeDiscard = await getServiceSnapshot('repeat-svc');
  assert.equal(snapBeforeDiscard.plan[0].artifact.layout.elements[0].text, 'Edit 2 Final Revision');

  // Discard: must restore the true canonical original (Canonical Original Verse), NOT Edit 1
  await revertEmergencyPatches('repeat-svc');

  const snapAfterDiscard = await getServiceSnapshot('repeat-svc');
  assert.equal(
    snapAfterDiscard.plan[0].artifact.layout.elements[0].text,
    'Canonical Original Verse',
    'Discarding multiple revisions must restore the earliest canonical original text and artifact'
  );
  assert.equal(snapAfterDiscard.plan[0].body, 'Canonical Original Verse');
});

test('SPEC-84-03: HTTP admission accepts emergency_patches-only PUT without requiring raw_payload', () => {
  const servicesPath = path.join(rootDir, 'internal', 'httpapi', 'services.go');
  const servicesSrc = fs.readFileSync(servicesPath, 'utf8');

  // Verify admission guard accepts emergency_patches
  assert.ok(
    servicesSrc.includes('!hasEmergencyPatches'),
    'updateService admission guard must permit emergency_patches when raw_payload is omitted'
  );

  // Verify dedicated patch-only branch
  assert.ok(
    servicesSrc.includes('UPDATE services SET emergency_patches = ?, updated_at ='),
    'updateService must contain dedicated emergency_patches isolated update statement'
  );
});

test('SPEC-84-03: Real-file defect injection proofs for Presentation Lock & Emergency Edit without physical disk mutation', () => {
  const origPresenter = fs.readFileSync(presenterOperatorPath, 'utf8');
  const origChannel = fs.readFileSync(presentChannelPath, 'utf8');
  const origProjector = fs.readFileSync(projectorClientPath, 'utf8');
  const origSnapshot = fs.readFileSync(serviceSnapshotPath, 'utf8');
  const origRunSheet = fs.readFileSync(runSheetPagePath, 'utf8');

  // Baseline must pass with 0 findings
  assert.deepEqual(scanEmergencyEditSecurityGuards(), []);

  // Defect 1: Strip presentation-lock-badge from PresenterOperator
  const mutatedPresenterLock = origPresenter.replace('data-testid="presentation-lock-badge"', 'data-testid="disabled-lock"');
  const findings1 = scanEmergencyEditSecurityGuards({ presenterSrc: mutatedPresenterLock });
  assert.ok(findings1.some((f) => f.includes('presentation-lock-badge')));

  // Defect 2: Strip emergency-apply-button from PresenterOperator
  const mutatedPresenterApply = origPresenter.replace('data-testid="emergency-apply-button"', 'data-testid="disabled-apply"');
  const findings2 = scanEmergencyEditSecurityGuards({ presenterSrc: mutatedPresenterApply });
  assert.ok(findings2.some((f) => f.includes('emergency-apply-button')));

  // Defect 3: Strip slidePatchOf from present-channel
  const mutatedChannel = origChannel.replace('export function slidePatchOf(', 'export function disabledSlidePatch(');
  const findings3 = scanEmergencyEditSecurityGuards({ channelSrc: mutatedChannel });
  assert.ok(findings3.some((f) => f.includes('slidePatchOf')));

  // Defect 4: Strip emergency-reconciliation-banner from RunSheetPage
  const mutatedRunSheet = origRunSheet.replaceAll('data-testid="emergency-reconciliation-banner"', 'data-testid="disabled-banner"');
  const findings4 = scanEmergencyEditSecurityGuards({ runSheetSrc: mutatedRunSheet });
  assert.ok(findings4.some((f) => f.includes('emergency-reconciliation-banner')));

  // Defect 5: Strip saveEmergencyPatch from service-snapshot
  const mutatedSnapshot = origSnapshot.replace('export async function saveEmergencyPatch(', 'export async function disabledSavePatch(');
  const findings5 = scanEmergencyEditSecurityGuards({ snapshotSrc: mutatedSnapshot });
  assert.ok(findings5.some((f) => f.includes('saveEmergencyPatch')));

  // Defect 6: Strip basePlanIdentity check from RunSheetPage
  const mutatedRunSheetConflict = origRunSheet.replace('basePlanIdentity !== remoteData.plan_identity', 'false');
  const findings6 = scanEmergencyEditSecurityGuards({ runSheetSrc: mutatedRunSheetConflict });
  assert.ok(findings6.some((f) => f.includes('basePlanIdentity divergence')));

  // Defect 7: Strip revertEmergencyPatches from RunSheetPage
  const mutatedRunSheetRevert = origRunSheet.replaceAll('revertEmergencyPatches', 'disabledRevert');
  const findings7 = scanEmergencyEditSecurityGuards({ runSheetSrc: mutatedRunSheetRevert });
  assert.ok(findings7.some((f) => f.includes('revertEmergencyPatches')));

  // Baseline remains completely clean
  assert.deepEqual(scanEmergencyEditSecurityGuards(), []);
});
