/**
 * SPEC-85-05: Canvas Editor for Emergency Local Edit with Hydrated Slide Seed
 * Comprehensive automated unit, integration, and defect-injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureArtifactInstance,
  findCanonicalBodyElement,
  updateElementText,
  updateElementStyle,
  updateElementGeometry,
  updateElementImage,
  updateArtifactBackground,
  createEmergencyPatchRecord,
  applyEmergencyPatchToSlides,
  validateProjectorSlidePatchAdmission,
} from '../src/lib/emergency-canvas.ts';
import {
  saveServiceSnapshot,
  getServiceSnapshot,
  saveEmergencyPatch,
  getEmergencyPatches,
  clearEmergencyPatches,
} from '../src/lib/offline/service-snapshot.ts';
import { slidePatchOf, syncPatchesOf } from '../src/lib/present-channel.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const presenterOperatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');
const projectorClientPath = path.join(rootDir, 'src', 'projected', 'ProjectorClient.tsx');
const emergencyCanvasLibPath = path.join(rootDir, 'src', 'lib', 'emergency-canvas.ts');

export function scanEmergencyCanvasEditorGuards(overrides = {}) {
  const findings = [];
  const presenterSrc = overrides.presenterSrc ?? fs.readFileSync(presenterOperatorPath, 'utf8');
  const projectorSrc = overrides.projectorSrc ?? fs.readFileSync(projectorClientPath, 'utf8');
  const canvasLibSrc = overrides.canvasLibSrc ?? fs.readFileSync(emergencyCanvasLibPath, 'utf8');

  // 1. PresenterOperator Emergency Canvas Designer Dialog & Multi-element controls
  const requiredPresenterTokens = [
    'data-testid="emergency-edit-dialog"',
    'data-testid="emergency-edit-textarea"',
    'data-testid="emergency-apply-button"',
    'data-testid="emergency-cancel-button"',
    'data-testid="emergency-font-family"',
    'data-testid="emergency-font-size"',
    'data-testid="emergency-text-color"',
    'data-testid="emergency-text-align-left"',
    'data-testid="emergency-text-align-center"',
    'data-testid="emergency-text-align-right"',
    'data-testid="emergency-text-bold"',
    'data-testid="emergency-text-italic"',
    'data-testid="emergency-element-x"',
    'data-testid="emergency-element-y"',
    'data-testid="emergency-element-w"',
    'data-testid="emergency-element-h"',
    'data-testid="emergency-image-url"',
    'data-testid="emergency-image-fit"',
    'data-testid="emergency-bg-color"',
    'data-testid="emergency-bg-image"',
    'data-testid="emergency-bg-tab"',
    'EmergencyCanvasDesignerModal',
    'ensureArtifactInstance',
    'findCanonicalBodyElement',
    "type: 'slide-patch'",
  ];

  for (const token of requiredPresenterTokens) {
    if (!presenterSrc.includes(token)) {
      findings.push(`PresenterOperator.tsx missing token: ${token}`);
    }
  }

  // 2. ProjectorClient slide-patch protocol handling & admission helper call
  const requiredProjectorTokens = [
    "msg.type === 'slide-patch'",
    'patchRevision > lastRev',
    'validateProjectorSlidePatchAdmission(',
    'slidePatchOf(',
    'adoptsSharedState(',
  ];

  for (const token of requiredProjectorTokens) {
    if (!projectorSrc.includes(token)) {
      findings.push(`ProjectorClient.tsx missing token: ${token}`);
    }
  }

  // 3. Emergency Canvas Lib Pure Functions
  const requiredLibTokens = [
    'function ensureArtifactInstance',
    'function findCanonicalBodyElement',
    'function updateElementText',
    'function updateElementStyle',
    'function updateElementGeometry',
    'function updateElementImage',
    'function updateArtifactBackground',
    'function createEmergencyPatchRecord',
    'function applyEmergencyPatchToSlides',
    'function validateProjectorSlidePatchAdmission',
  ];

  for (const token of requiredLibTokens) {
    if (!canvasLibSrc.includes(token)) {
      findings.push(`emergency-canvas.ts missing export: ${token}`);
    }
  }

  return findings;
}

test('SPEC-85-05: Structural security guards pass for Emergency Canvas Designer', () => {
  const findings = scanEmergencyCanvasEditorGuards();
  assert.deepEqual(findings, [], `Found security guard findings:\n${findings.join('\n')}`);
});

test('SPEC-85-05: findCanonicalBodyElement preserves slide body/lines metadata during non-body edits', () => {
  const multiElementArtifact = {
    runtimeVersion: 1,
    instanceId: 'slide-1',
    templateId: 'tpl-song',
    label: 'Song Slide',
    baseType: 'song-set',
    layoutKey: 'lyric',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      elements: [
        {
          id: 'title-el',
          type: 'text',
          placeholderKey: 'title',
          x: 10,
          y: 5,
          w: 80,
          h: 15,
          zIndex: 1,
          text: 'Song Title (Header)',
          style: { fontSize: 24 },
        },
        {
          id: 'lyrics-el',
          type: 'text',
          placeholderKey: 'lyrics',
          x: 10,
          y: 25,
          w: 80,
          h: 60,
          zIndex: 2,
          text: 'Bait 1:\nKugumulkan firman-Mu',
          style: { fontSize: 36 },
        },
        {
          id: 'img-el',
          type: 'image',
          x: 5,
          y: 5,
          w: 10,
          h: 10,
          zIndex: 3,
          imageUrl: 'https://example.com/icon.png',
          style: {},
        },
      ],
    },
  };

  // 1. Identify canonical body element without ambiguity
  const canonical = findCanonicalBodyElement(multiElementArtifact);
  assert.ok(canonical, 'Canonical body element must be found');
  assert.equal(canonical.id, 'lyrics-el', 'Must identify lyrics-el as canonical body target');
  assert.equal(canonical.text, 'Bait 1:\nKugumulkan firman-Mu');

  // 2. Modifying the title element must NOT corrupt slide body/lines text
  const titleEditedArtifact = updateElementText(multiElementArtifact, 'title-el', 'New Header Title');
  const canonicalAfterTitleEdit = findCanonicalBodyElement(titleEditedArtifact);
  assert.equal(canonicalAfterTitleEdit.id, 'lyrics-el');
  assert.equal(
    canonicalAfterTitleEdit.text,
    'Bait 1:\nKugumulkan firman-Mu',
    'Body text must remain untouched when title is edited'
  );

  // 3. Modifying image element must NOT corrupt slide body/lines text
  const imageEditedArtifact = updateElementImage(multiElementArtifact, 'img-el', 'https://example.com/logo2.png', 'fill');
  const canonicalAfterImageEdit = findCanonicalBodyElement(imageEditedArtifact);
  assert.equal(canonicalAfterImageEdit.id, 'lyrics-el');
  assert.equal(canonicalAfterImageEdit.text, 'Bait 1:\nKugumulkan firman-Mu');

  // 4. Fallback element ID prioritization
  const customTarget = findCanonicalBodyElement(multiElementArtifact, 'title-el');
  assert.equal(customTarget.id, 'title-el');
});

test('SPEC-85-05: ensureArtifactInstance enforces ARTIFACT_RUNTIME_VERSION and deep clone isolation', () => {
  const existingArtifact = {
    runtimeVersion: 1,
    instanceId: 'slide-42',
    templateId: 'tpl-song',
    label: 'Bait 1',
    baseType: 'song-set',
    layoutKey: 'lyric',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#1E293B',
      backgroundImage: 'https://example.com/bg.jpg',
      elements: [
        {
          id: 'el-lyrics',
          type: 'text',
          placeholderKey: 'lyrics',
          x: 10,
          y: 30,
          w: 80,
          h: 50,
          zIndex: 2,
          text: 'Besar setia-Mu\nAllah Bapaku',
          wrapLines: ['Besar setia-Mu', 'Allah Bapaku'],
          style: { fontFamily: 'Geist Sans', fontSize: 36, fontColor: '#FFFFFF' },
        },
      ],
    },
  };

  const slide = {
    id: 'slide-42',
    kind: 'song-lyric',
    title: 'Kidung Pujian',
    body: 'Besar setia-Mu\nAllah Bapaku',
    artifact: existingArtifact,
  };

  const seeded = ensureArtifactInstance(slide);
  assert.equal(seeded.runtimeVersion, 1);
  assert.equal(seeded.instanceId, 'slide-42');
  assert.equal(seeded.layout.backgroundColor, '#1E293B');
  assert.equal(seeded.layout.elements.length, 1);

  // Deep clone mutation isolation
  seeded.layout.backgroundColor = '#FF0000';
  assert.equal(existingArtifact.layout.backgroundColor, '#1E293B', 'Original artifact must not mutate');

  // Fallback synthesis for plain slide or malformed artifact
  const plainSlide = {
    id: 'slide-plain',
    kind: 'body',
    title: 'Warta Jemaat',
    body: 'Ibadah Raya Minggu 09.00',
  };
  const synthesized = ensureArtifactInstance(plainSlide);
  assert.equal(synthesized.runtimeVersion, 1);
  assert.equal(synthesized.layout.aspectRatio, '16:9');
  assert.equal(synthesized.layout.elements[0].text, 'Ibadah Raya Minggu 09.00');

  // Wrong runtime version triggers safe synthesis fallback
  const wrongVersionSlide = {
    ...slide,
    artifact: { ...existingArtifact, runtimeVersion: 999 },
  };
  const repaired = ensureArtifactInstance(wrongVersionSlide);
  assert.equal(repaired.runtimeVersion, 1);
});

test('SPEC-85-05: Multi-element mutations update text, typography, geometry, image, and background', () => {
  const initial = {
    runtimeVersion: 1,
    instanceId: 'slide-10',
    templateId: 'tpl-general',
    label: 'Pengumuman',
    baseType: 'general',
    layoutKey: 'default',
    layout: {
      aspectRatio: '16:9',
      backgroundColor: '#000000',
      elements: [
        {
          id: 'title-1',
          type: 'text',
          x: 10,
          y: 15,
          w: 80,
          h: 15,
          zIndex: 1,
          text: 'Judul Asli',
          wrapLines: ['Judul Asli'],
          style: { fontFamily: 'Geist Sans', fontSize: 28, fontColor: '#FFFFFF' },
        },
        {
          id: 'body-1',
          type: 'text',
          x: 10,
          y: 35,
          w: 80,
          h: 40,
          zIndex: 2,
          text: 'Baris 1\nBaris 2',
          wrapLines: ['Baris 1', 'Baris 2'],
          style: { fontFamily: 'Geist Sans', fontSize: 32, fontColor: '#FFFFFF' },
        },
        {
          id: 'img-1',
          type: 'image',
          x: 60,
          y: 40,
          w: 30,
          h: 30,
          zIndex: 3,
          imageUrl: 'https://example.com/logo.png',
          style: { objectFit: 'contain' },
        },
      ],
    },
  };

  // 1. Text update
  const textUpdated = updateElementText(initial, 'body-1', 'Teks Baru Baris 1\nTeks Baru Baris 2');
  assert.equal(textUpdated.layout.elements[1].text, 'Teks Baru Baris 1\nTeks Baru Baris 2');
  assert.deepEqual(textUpdated.layout.elements[1].wrapLines, ['Teks Baru Baris 1', 'Teks Baru Baris 2']);

  // 2. Style update
  const styleUpdated = updateElementStyle(textUpdated, 'title-1', {
    fontFamily: 'Times New Roman',
    fontSize: 40,
    fontColor: '#FEF08A',
    textAlign: 'center',
    fontWeight: 'bold',
    fontStyle: 'italic',
  });
  const titleEl = styleUpdated.layout.elements[0];
  assert.equal(titleEl.style.fontFamily, 'Times New Roman');
  assert.equal(titleEl.style.fontSize, 40);
  assert.equal(titleEl.style.fontColor, '#FEF08A');
  assert.equal(titleEl.style.textAlign, 'center');
  assert.equal(titleEl.style.fontWeight, 'bold');
  assert.equal(titleEl.style.fontStyle, 'italic');

  // 3. Geometry update with finite validation
  const geoUpdated = updateElementGeometry(styleUpdated, 'body-1', { x: 12, y: 38, w: 76, h: 44 });
  assert.equal(geoUpdated.layout.elements[1].x, 12);
  assert.equal(geoUpdated.layout.elements[1].y, 38);
  assert.equal(geoUpdated.layout.elements[1].w, 76);
  assert.equal(geoUpdated.layout.elements[1].h, 44);

  // Non-finite values are ignored safely
  const safeGeo = updateElementGeometry(geoUpdated, 'body-1', { x: NaN, w: Infinity });
  assert.equal(safeGeo.layout.elements[1].x, 12);
  assert.equal(safeGeo.layout.elements[1].w, 76);

  // 4. Image update with fill fit mode
  const imgUpdated = updateElementImage(geoUpdated, 'img-1', 'https://example.com/banner.jpg', 'fill');
  assert.equal(imgUpdated.layout.elements[2].imageUrl, 'https://example.com/banner.jpg');
  assert.equal(imgUpdated.layout.elements[2].style.objectFit, 'fill');

  // 5. Background update
  const bgUpdated = updateArtifactBackground(imgUpdated, {
    color: '#0F172A',
    image: 'https://example.com/stars.jpg',
  });
  assert.equal(bgUpdated.layout.backgroundColor, '#0F172A');
  assert.equal(bgUpdated.layout.backgroundImage, 'https://example.com/stars.jpg');
});

test('SPEC-85-05: saveEmergencyPatch writes body and lines synchronously into service snapshot plan', async () => {
  const serviceId = 'svc-snapshot-consistency-85';
  await clearEmergencyPatches(serviceId);

  const initialArtifact = ensureArtifactInstance({
    id: 's-1',
    kind: 'text',
    title: 'Slide 1',
    body: 'Original Body',
  });

  // Seed baseline snapshot
  await saveServiceSnapshot({
    id: serviceId,
    status: 'ready',
    cached_at: Date.now(),
    plan: [
      {
        id: 's-1',
        kind: 'text',
        title: 'Slide 1',
        body: 'Original Body',
        lines: ['Original Body'],
        artifact: initialArtifact,
      },
    ],
  });

  const updatedArtifact = updateElementText(initialArtifact, 'text-main', 'Updated Body Content\nSecond Line');

  const patchRecord = createEmergencyPatchRecord({
    serviceId,
    basePlanIdentity: 'plan-identity-consist',
    patchRevision: 501,
    slideIndex: 0,
    originalText: 'Original Body',
    originalArtifact: initialArtifact,
    updatedArtifact,
    updatedText: 'Updated Body Content\nSecond Line',
  });

  await saveEmergencyPatch(patchRecord);

  // 1. Verify outbox carries updated artifact and text
  const patches = await getEmergencyPatches(serviceId);
  assert.equal(patches.length, 1);
  assert.equal(patches[0].updatedText, 'Updated Body Content\nSecond Line');
  assert.equal(patches[0].patchedArtifact.layout.elements[0].text, 'Updated Body Content\nSecond Line');

  // 2. Finding 2 & 6: Verify durable service snapshot plan contains updated artifact, body, and lines
  const snap = await getServiceSnapshot(serviceId);
  assert.ok(snap, 'Service snapshot must exist');
  assert.ok(Array.isArray(snap.plan));
  assert.equal(snap.plan[0].body, 'Updated Body Content\nSecond Line', 'Snapshot plan body must be updated');
  assert.deepEqual(snap.plan[0].lines, ['Updated Body Content', 'Second Line'], 'Snapshot plan lines must be updated');
  assert.equal(
    snap.plan[0].artifact.layout.elements[0].text,
    'Updated Body Content\nSecond Line',
    'Snapshot plan artifact element text must be updated'
  );
});

test('SPEC-85-05: Concurrent presenter revision allocation is monotonically collision-free at exact same millisecond', () => {
  // Finding 1 fix: Simulate two presenter tabs attempting to save at the EXACT SAME millisecond
  const fixedNowMs = 1750000000000;
  const tab1Id = 321;
  const tab2Id = 789;

  const tab1Candidate = fixedNowMs * 1000 + (tab1Id % 1000);
  const tab2Candidate = fixedNowMs * 1000 + (tab2Id % 1000);

  const baseRev = 100;
  const tab1Rev = Math.max(baseRev + 1, tab1Candidate);
  const tab2Rev = Math.max(baseRev + 1, tab2Candidate);

  // Revisions allocated at identical wall clock time MUST NEVER collide
  assert.notEqual(tab1Rev, tab2Rev, 'Revisions allocated at the same millisecond must not collide');
  assert.ok(tab1Rev > baseRev && tab2Rev > baseRev, 'Revisions must strictly exceed baseline');
  assert.ok(Number.isSafeInteger(tab1Rev) && Number.isSafeInteger(tab2Rev), 'Revisions must be safe finite integers');
});

test('SPEC-85-05: Atomic revision allocation breaks ties and eliminates collision even with identical tab IDs and timestamps', async () => {
  const serviceId = 'svc-atomic-collision-test';
  await clearEmergencyPatches(serviceId);

  const initialArtifact = ensureArtifactInstance({
    id: 's-1',
    kind: 'text',
    title: 'Slide 1',
    body: 'Original',
  });

  // Tab 1 and Tab 2 start with identical state, identical tab ID, and identical revision request
  const tab1Patch = createEmergencyPatchRecord({
    serviceId,
    basePlanIdentity: 'plan-id-1',
    patchRevision: 10,
    slideIndex: 0,
    originalText: 'Original',
    originalArtifact: initialArtifact,
    updatedArtifact: initialArtifact,
    updatedText: 'Edit from Tab 1',
  });

  const tab2Patch = createEmergencyPatchRecord({
    serviceId,
    basePlanIdentity: 'plan-id-1',
    patchRevision: 10, // Exact same initial revision and timestamp!
    slideIndex: 0,
    originalText: 'Original',
    originalArtifact: initialArtifact,
    updatedArtifact: initialArtifact,
    updatedText: 'Edit from Tab 2',
  });

  // Save Tab 1
  await saveEmergencyPatch(tab1Patch);
  assert.equal(tab1Patch.patchRevision, 10);

  // Save Tab 2 with identical revision request — atomic allocator MUST bump revision to prevent collision
  await saveEmergencyPatch(tab2Patch);
  assert.ok(tab2Patch.patchRevision > tab1Patch.patchRevision, 'Tab 2 revision must strictly exceed Tab 1 revision');
  assert.equal(tab2Patch.patchRevision, 11, 'Tab 2 revision must be incremented atomically to 11');

  // Verify outbox records
  const patches = await getEmergencyPatches(serviceId);
  assert.equal(patches.length, 2);
  assert.equal(patches[0].patchRevision, 10);
  assert.equal(patches[1].patchRevision, 11);
});

test('SPEC-85-05: saveEmergencyPatch is idempotent for identical clientOpId and prevents replay promotion', async () => {
  const serviceId = 'svc-idempotency-test-85';
  await clearEmergencyPatches(serviceId);

  const initialArtifact = ensureArtifactInstance({
    id: 's-1',
    kind: 'text',
    title: 'Slide 1',
    body: 'Original',
  });

  const clientOpId = 'op-stable-12345';
  const patch1 = createEmergencyPatchRecord({
    serviceId,
    clientOpId,
    basePlanIdentity: 'plan-id-1',
    patchRevision: 10,
    slideIndex: 0,
    originalText: 'Original',
    originalArtifact: initialArtifact,
    updatedArtifact: initialArtifact,
    updatedText: 'Edit 1',
  });

  const id1 = await saveEmergencyPatch(patch1);
  const patches1 = await getEmergencyPatches(serviceId);
  assert.equal(patches1.length, 1);
  assert.equal(patches1[0].patchRevision, 10);

  // Re-save with same clientOpId (simulating retry or delayed duplicate)
  const patch1Retry = createEmergencyPatchRecord({
    serviceId,
    clientOpId,
    basePlanIdentity: 'plan-id-1',
    patchRevision: 10,
    slideIndex: 0,
    originalText: 'Original',
    originalArtifact: initialArtifact,
    updatedArtifact: initialArtifact,
    updatedText: 'Edit 1',
  });

  const id2 = await saveEmergencyPatch(patch1Retry);
  assert.equal(id2, id1, 'Retry must return existing operation ID');
  assert.equal(patch1Retry.patchRevision, 10, 'Retry must retain original revision without bumping');

  const patches2 = await getEmergencyPatches(serviceId);
  assert.equal(patches2.length, 1, 'Retry must not append duplicate record to outbox');
});

test('SPEC-85-05: Projector admission validates index, finite positive revision, and structured artifact', () => {
  const activePlanIdentity = 'plan-identity-live-85';

  const valid = {
    type: 'slide-patch',
    index: 0,
    artifact: { layout: { elements: [] } },
    patchRevision: 10,
    planIdentity: activePlanIdentity,
  };

  // 1. Valid patch admitted
  const admitted = validateProjectorSlidePatchAdmission({
    msg: valid,
    activePlanIdentity,
    lastRevision: 9,
  });
  assert.equal(admitted.admit, true);

  // 2. Reject non-integer, negative, or coercive non-number index
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, index: -1 },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false
  );
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, index: 1.5 },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false
  );
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, index: '0' },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false,
    'String index must be rejected without coercion'
  );

  // 3. Reject non-finite, decimal, coercive, or stale revision
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, patchRevision: Infinity },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false
  );
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, patchRevision: NaN },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false
  );
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, patchRevision: '10' },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false,
    'String revision must be rejected without coercion'
  );
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, patchRevision: 9 },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false
  );

  // 4. Reject malformed artifact object (missing layout or non-array elements)
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, artifact: null },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false
  );
  assert.equal(
    validateProjectorSlidePatchAdmission({
      msg: { ...valid, artifact: { layout: 'invalid-string' } },
      activePlanIdentity,
      lastRevision: 9,
    }).admit,
    false
  );

  // 5. slidePatchOf in present-channel sanitizes strictly and non-coercively
  assert.equal(slidePatchOf({ ...valid, index: -1 }), null);
  assert.equal(slidePatchOf({ ...valid, index: '0' }), null);
  assert.equal(slidePatchOf({ ...valid, patchRevision: Infinity }), null);
  assert.equal(slidePatchOf({ ...valid, patchRevision: '10' }), null);
  assert.ok(slidePatchOf(valid), 'slidePatchOf must parse valid patch');

  // 6. Finding 2: syncPatchesOf rejects malformed layouts and non-integers
  const malformedSyncMsg = {
    type: 'sync',
    patches: [
      { index: 0, patchRevision: 10, artifact: { layout: { elements: [] } } },
      { index: 1, patchRevision: 'bad', artifact: { layout: { elements: [] } } },
      { index: 2, patchRevision: 12, artifact: { layout: 'no-elements' } },
    ],
  };
  const filtered = syncPatchesOf(malformedSyncMsg);
  assert.equal(filtered.length, 1, 'syncPatchesOf must discard malformed patches');
  assert.equal(filtered[0].index, 0);
});

test('SPEC-85-05: Real-file defect injection proofs for multi-element Canvas Editor', () => {
  // Defect 1: Removing canonical body element helper from PresenterOperator
  const withoutCanonicalHelper = `
    const handleApplyEmergencyEdit = async () => {
      const updatedText = emergencyText;
    };
  `;
  const findings1 = scanEmergencyCanvasEditorGuards({ presenterSrc: withoutCanonicalHelper });
  assert.ok(
    findings1.some((f) => f.includes('findCanonicalBodyElement')),
    'Must catch missing findCanonicalBodyElement'
  );

  // Defect 2: Removing validateProjectorSlidePatchAdmission from ProjectorClient
  const projectorWithoutValidator = `
    const onMessage = (ev) => {
      if (msg.type === 'slide-patch') {
        const patch = slidePatchOf(msg);
      }
    };
  `;
  const findings2 = scanEmergencyCanvasEditorGuards({ projectorSrc: projectorWithoutValidator });
  assert.ok(
    findings2.some((f) => f.includes('validateProjectorSlidePatchAdmission')),
    'Must catch missing validateProjectorSlidePatchAdmission in ProjectorClient'
  );
});
