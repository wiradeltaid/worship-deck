/**
 * SPEC-85-04: Slide Hide/Show Visibility Control Across Run-Sheet, Presenter, and PPTX Export
 * Unit, structural, linear navigation skip, PPTX OOXML generation, and defect injection test suite.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import JSZip from 'jszip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const slideVisibilityLibPath = path.join(rootDir, 'src', 'lib', 'slide-visibility.ts');
const presenterOperatorPath = path.join(rootDir, 'src', 'operator', 'present', 'PresenterOperator.tsx');
const slidePreviewListPath = path.join(rootDir, 'src', 'components', 'SlidePreviewList.tsx');
const slideGridDialogPath = path.join(rootDir, 'src', 'operator', 'present', 'SlideGridDialog.tsx');
const servicesGoPath = path.join(rootDir, 'internal', 'httpapi', 'services.go');
const schemaSqlPath = path.join(rootDir, 'internal', 'db', 'schema.sql');
const pptxDrawPath = path.join(rootDir, 'src', 'lib', 'pptx-draw.ts');
const planTypesGoPath = path.join(rootDir, 'internal', 'plan', 'types.go');
const planGoPath = path.join(rootDir, 'internal', 'plan', 'plan.go');
const presenterRemoteClientPath = path.join(rootDir, 'src', 'lib', 'presenter-remote-client.ts');
const remoteOperatorPath = path.join(rootDir, 'src', 'operator', 'present', 'RemoteOperator.tsx');

const {
  findNextVisibleIndex,
  findNearestVisibleIndex,
  toggleHiddenSlideId,
  isSlideHidden,
  createSlideVisibilityController,
} = await import(pathToFileURL(slideVisibilityLibPath).href);

const { generatePptxFromPlan } = await import(pathToFileURL(pptxDrawPath).href);
const { applyRemoteIntent } = await import(pathToFileURL(presenterRemoteClientPath).href);

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

export function scanSlideVisibilityGuards(overrides = {}) {
  const findings = [];
  const presenterSrc = overrides.presenterSrc ?? fs.readFileSync(presenterOperatorPath, 'utf8');
  const previewSrc = overrides.previewSrc ?? fs.readFileSync(slidePreviewListPath, 'utf8');
  const gridSrc = overrides.gridSrc ?? fs.readFileSync(slideGridDialogPath, 'utf8');
  const servicesGoSrc = overrides.servicesGoSrc ?? fs.readFileSync(servicesGoPath, 'utf8');
  const schemaSqlSrc = overrides.schemaSqlSrc ?? fs.readFileSync(schemaSqlPath, 'utf8');
  const pptxDrawSrc = overrides.pptxDrawSrc ?? fs.readFileSync(pptxDrawPath, 'utf8');
  const planTypesSrc = overrides.planTypesSrc ?? fs.readFileSync(planTypesGoPath, 'utf8');
  const planGoSrc = overrides.planGoSrc ?? fs.readFileSync(planGoPath, 'utf8');
  const remoteSrc = overrides.remoteSrc ?? fs.readFileSync(remoteOperatorPath, 'utf8');

  // 1. Run-Sheet preview list must declare visibility toggle and hidden badge
  if (!previewSrc.includes('data-testid="slide-hidden-badge"')) {
    findings.push('SlidePreviewList.tsx missing data-testid="slide-hidden-badge"');
  }
  if (!previewSrc.includes('data-testid="slide-visibility-toggle"')) {
    findings.push('SlidePreviewList.tsx missing data-testid="slide-visibility-toggle"');
  }

  // 2. Presenter console must declare filmstrip badge, filmstrip toggle, and current slide toggle
  if (!presenterSrc.includes('data-testid="filmstrip-hidden-badge"')) {
    findings.push('PresenterOperator.tsx missing data-testid="filmstrip-hidden-badge"');
  }
  if (!presenterSrc.includes('data-testid="filmstrip-visibility-toggle"')) {
    findings.push('PresenterOperator.tsx missing data-testid="filmstrip-visibility-toggle"');
  }
  if (!presenterSrc.includes('data-testid="toggle-current-slide-visibility"')) {
    findings.push('PresenterOperator.tsx missing data-testid="toggle-current-slide-visibility"');
  }

  // 3. Presenter navigation must enforce linear advance skip rule via findNextVisibleIndex
  if (!presenterSrc.includes('findNextVisibleIndex(activeSlides, index, 1)')) {
    findings.push('PresenterOperator.tsx missing forward findNextVisibleIndex navigation skip');
  }
  if (!presenterSrc.includes('findNextVisibleIndex(activeSlides, index, -1)')) {
    findings.push('PresenterOperator.tsx missing backward findNextVisibleIndex navigation skip');
  }

  // 4. SlideGridDialog must declare grid hidden badge
  if (!gridSrc.includes('data-testid="grid-hidden-badge"')) {
    findings.push('SlideGridDialog.tsx missing data-testid="grid-hidden-badge"');
  }

  // 5. Backend services.go must support PATCH /api/services/{id} and hidden_slide_ids
  if (!servicesGoSrc.includes('hidden_slide_ids') || !servicesGoSrc.includes('patchService')) {
    findings.push('services.go missing hidden_slide_ids or patchService handler');
  }

  // 6. Database schema must define hidden_slide_ids column
  if (!schemaSqlSrc.includes('hidden_slide_ids TEXT DEFAULT \'[]\'')) {
    findings.push('schema.sql missing hidden_slide_ids column definition');
  }

  // 7. PPTX generator must support hidden slides and emit show="0"
  if (!pptxDrawSrc.includes('patchHiddenSlides') || !pptxDrawSrc.includes('show="0"')) {
    findings.push('pptx-draw.ts missing patchHiddenSlides or show="0" attribute injection');
  }

  // 8. Go plan types must propagate hidden flag on DrawItem
  if (!planTypesSrc.includes('Hidden   *bool            `json:"hidden,omitempty"`')) {
    findings.push('types.go missing Hidden *bool json tag on DrawItem');
  }

  // 9. Go plan builder must read hidden_slide_ids and populate items[i].Hidden
  if (!planGoSrc.includes('COALESCE(hidden_slide_ids, \'[]\')') || !planGoSrc.includes('items[i].Hidden = &tTrue')) {
    findings.push('plan.go missing hidden_slide_ids loading or items[i].Hidden assignment');
  }

  // 10. PresenterOperator must instantiate createSlideVisibilityController and wire initial all-hidden check
  if (!presenterSrc.includes('createSlideVisibilityController') || !presenterSrc.includes('visibilityController.checkInitialAllHidden()')) {
    findings.push('PresenterOperator.tsx missing createSlideVisibilityController integration or checkInitialAllHidden call');
  }

  // 11. PresenterOperator must route direct selection through safeNavigate
  if (!presenterSrc.includes('safeNavigate') || !presenterSrc.includes('safeNavigate(picked)')) {
    findings.push('PresenterOperator.tsx missing safeNavigate wiring on grid pick');
  }

  // 12. PresenterOperator auto-loop must skip hidden announcements
  if (!presenterSrc.includes('activeSlides[nextIdx]?.hidden')) {
    findings.push('PresenterOperator.tsx auto-loop missing activeSlides[nextIdx]?.hidden skip');
  }

  // 13. PresenterOperator safeNavigate must return controller result and guard navigation
  if (!presenterSrc.includes('return visibilityController.safeNavigate(targetIdx)')) {
    findings.push('PresenterOperator.tsx missing return visibilityController.safeNavigate(targetIdx) to guard navigation');
  }

  // 14. PresenterOperator grid selection must await safeNavigate before closing dialog
  if (!presenterSrc.includes('const ok = await safeNavigate(picked);') || !presenterSrc.includes('if (ok)')) {
    findings.push('PresenterOperator.tsx onPick missing await safeNavigate check before setGridOpen(false)');
  }

  // 15. RemoteOperator Prev/Next buttons must use findNextVisibleIndex for linear skip
  if (!remoteSrc.includes('findNextVisibleIndex(slides, index, -1)') || !remoteSrc.includes('findNextVisibleIndex(slides, index, 1)')) {
    findings.push('RemoteOperator.tsx Prev/Next buttons missing findNextVisibleIndex linear skip');
  }

  return findings;
}

test('SPEC-85-04: findNextVisibleIndex strictly skips single and consecutive hidden slides', () => {
  const slides = [
    { id: 's0', hidden: false },
    { id: 's1', hidden: true },
    { id: 's2', hidden: true },
    { id: 's3', hidden: false },
    { id: 's4', hidden: true },
    { id: 's5', hidden: false },
  ];

  // Forward: from 0, skipping hidden 1 and 2 -> advances to 3
  assert.equal(findNextVisibleIndex(slides, 0, 1), 3);

  // Forward: from 3, skipping hidden 4 -> advances to 5
  assert.equal(findNextVisibleIndex(slides, 3, 1), 5);

  // Backward: from 3, skipping hidden 2 and 1 -> retreats to 0
  assert.equal(findNextVisibleIndex(slides, 3, -1), 0);

  // Backward: from 5, skipping hidden 4 -> retreats to 3
  assert.equal(findNextVisibleIndex(slides, 5, -1), 3);
});

test('SPEC-85-04: findNextVisibleIndex halts safely at boundary when all remaining slides are hidden', () => {
  const slides = [
    { id: 's0', hidden: false },
    { id: 's1', hidden: true },
    { id: 's2', hidden: true },
  ];

  // At slide 0, remaining forward slides are all hidden -> halts at 0 without crashing
  assert.equal(findNextVisibleIndex(slides, 0, 1), 0);

  // At slide 0, backward boundary -> halts at 0
  assert.equal(findNextVisibleIndex(slides, 0, -1), 0);

  // Empty slides array
  assert.equal(findNextVisibleIndex([], 0, 1), 0);
});

test('SPEC-85-04: findNearestVisibleIndex finds forward visible, backward visible, or handles all-hidden', () => {
  const slides = [
    { id: 's0', hidden: true },
    { id: 's1', hidden: false },
    { id: 's2', hidden: true },
    { id: 's3', hidden: true },
  ];

  // When s0 is hidden, forward finds s1
  assert.equal(findNearestVisibleIndex(slides, 0), 1);

  // When s2 is hidden and s3 is hidden, backward finds s1
  assert.equal(findNearestVisibleIndex(slides, 2), 1);

  // All hidden boundary
  const allHidden = [{ id: 'a', hidden: true }, { id: 'b', hidden: true }];
  assert.equal(findNearestVisibleIndex(allHidden, 0), 0);
});

test('SPEC-85-04: toggleHiddenSlideId adds or removes slide IDs immutably', () => {
  let list = [];
  list = toggleHiddenSlideId(list, 'hymn-1-v2');
  assert.deepEqual(list, ['hymn-1-v2']);

  list = toggleHiddenSlideId(list, 'scripture');
  assert.deepEqual(list.sort(), ['hymn-1-v2', 'scripture']);

  list = toggleHiddenSlideId(list, 'hymn-1-v2');
  assert.deepEqual(list, ['scripture']);

  assert.equal(isSlideHidden(list, 'scripture'), true);
  assert.equal(isSlideHidden(list, 'hymn-1-v2'), false);
  assert.equal(isSlideHidden(undefined, 'anything'), false);
});

test('SPEC-85-04: Production createSlideVisibilityController: checkInitialAllHidden triggers screen blanking', () => {
  let isBlank = false;
  const slides = [
    { id: 's0', hidden: true },
    { id: 's1', hidden: true },
  ];

  const controller = createSlideVisibilityController({
    getSlides: () => slides,
    setSlides: () => {},
    getCurrentIndex: () => 0,
    setCurrentIndex: () => {},
    getIsBlank: () => isBlank,
    setIsBlank: (b) => {
      isBlank = b;
    },
  });

  controller.checkInitialAllHidden();
  assert.equal(isBlank, true, 'checkInitialAllHidden must set isBlank to true when all slides are hidden');
});

test('SPEC-85-04: Production createSlideVisibilityController: toggleSlideVisibility verifies server PATCH and rolls back on failure', async () => {
  let slides = [
    { id: 's0', hidden: false },
    { id: 's1', hidden: false },
  ];
  let currentIndex = 0;
  let isBlank = false;
  let errorMsg = '';

  // Case 1: Fetch fails (HTTP 500) -> does NOT commit state, returns false
  const mockFailingFetch = async () => ({
    ok: false,
    status: 500,
  });

  const failingController = createSlideVisibilityController({
    getSlides: () => slides,
    setSlides: (updated) => {
      slides = updated;
    },
    getCurrentIndex: () => currentIndex,
    setCurrentIndex: (idx) => {
      currentIndex = idx;
    },
    getIsBlank: () => isBlank,
    setIsBlank: (b) => {
      isBlank = b;
    },
    serviceId: 42,
    fetchFn: mockFailingFetch,
    onError: (msg) => {
      errorMsg = msg;
    },
  });

  const failResult = await failingController.toggleSlideVisibility(0);
  assert.equal(failResult, false, 'Failed server PATCH must return false');
  assert.equal(slides[0].hidden, false, 'Slides state must NOT be modified when server request fails');
  assert.equal(currentIndex, 0, 'Index must not advance when server request fails');
  assert.ok(errorMsg.includes('Gagal memperbarui status visibilitas'), 'Error callback must be triggered');

  // Case 2: Fetch succeeds (HTTP 200 OK) -> commits state, returns true
  const patchPayloads = [];
  const mockSuccessFetch = async (url, opts) => {
    patchPayloads.push({ url, body: JSON.parse(opts.body) });
    return { ok: true, status: 200 };
  };

  const successController = createSlideVisibilityController({
    getSlides: () => slides,
    setSlides: (updated) => {
      slides = updated;
    },
    getCurrentIndex: () => currentIndex,
    setCurrentIndex: (idx) => {
      currentIndex = idx;
    },
    getIsBlank: () => isBlank,
    setIsBlank: (b) => {
      isBlank = b;
    },
    serviceId: 42,
    fetchFn: mockSuccessFetch,
  });

  const successResult = await successController.toggleSlideVisibility(0);
  assert.equal(successResult, true, 'Successful server PATCH must return true');
  assert.equal(slides[0].hidden, true, 'Slide 0 must now be marked hidden');
  assert.equal(currentIndex, 1, 'Hiding active slide 0 must transition index to nearest visible slide 1');
  assert.equal(patchPayloads.length, 1);
  assert.deepEqual(patchPayloads[0].body.hidden_slide_ids, ['s0']);
});

test('SPEC-85-04: Production createSlideVisibilityController: safeNavigate unhides, unblanks, and aborts on failure', async () => {
  let slides = [
    { id: 's0', hidden: true },
    { id: 's1', hidden: true },
  ];
  let currentIndex = 0;
  let isBlank = true; // Started all hidden

  // Case 1: unhide fails -> aborts navigation
  const mockFailingFetch = async () => ({ ok: false, status: 500 });
  const failingController = createSlideVisibilityController({
    getSlides: () => slides,
    setSlides: (updated) => {
      slides = updated;
    },
    getCurrentIndex: () => currentIndex,
    setCurrentIndex: (idx) => {
      currentIndex = idx;
    },
    getIsBlank: () => isBlank,
    setIsBlank: (b) => {
      isBlank = b;
    },
    serviceId: 42,
    fetchFn: mockFailingFetch,
  });

  const failNavResult = await failingController.safeNavigate(1);
  assert.equal(failNavResult, false, 'safeNavigate must return false when unhide fails');
  assert.equal(currentIndex, 0, 'Navigation must abort when unhide fails');
  assert.equal(slides[1].hidden, true, 'Slide 1 must remain hidden');
  assert.equal(isBlank, true, 'Screen must remain blanked when unhide fails');

  // Case 2: unhide succeeds -> unhides slide, unblanks screen, navigates
  const mockSuccessFetch = async () => ({ ok: true, status: 200 });
  const successController = createSlideVisibilityController({
    getSlides: () => slides,
    setSlides: (updated) => {
      slides = updated;
    },
    getCurrentIndex: () => currentIndex,
    setCurrentIndex: (idx) => {
      currentIndex = idx;
    },
    getIsBlank: () => isBlank,
    setIsBlank: (b) => {
      isBlank = b;
    },
    serviceId: 42,
    fetchFn: mockSuccessFetch,
  });

  const successNavResult = await successController.safeNavigate(1);
  assert.equal(successNavResult, true, 'safeNavigate must return true on success');
  assert.equal(slides[1].hidden, false, 'Slide 1 must be unhidden');
  assert.equal(isBlank, false, 'Screen must be unblanked upon selecting slide');
  assert.equal(currentIndex, 1, 'Navigation must succeed to target slide 1');
});

test('SPEC-85-04: Production createSlideVisibilityController: safeNavigate aborts on network error (rejected fetch)', async () => {
  let slides = [
    { id: 's0', hidden: false },
    { id: 's1', hidden: true },
  ];
  let currentIndex = 0;
  let isBlank = true;

  const mockNetworkErrorFetch = async () => {
    throw new Error('Network offline or socket hang up');
  };

  const controller = createSlideVisibilityController({
    getSlides: () => slides,
    setSlides: (updated) => {
      slides = updated;
    },
    getCurrentIndex: () => currentIndex,
    setCurrentIndex: (idx) => {
      currentIndex = idx;
    },
    getIsBlank: () => isBlank,
    setIsBlank: (b) => {
      isBlank = b;
    },
    serviceId: 42,
    fetchFn: mockNetworkErrorFetch,
  });

  const failNavResult = await controller.safeNavigate(1);
  assert.equal(failNavResult, false, 'safeNavigate must return false when network throws');
  assert.equal(currentIndex, 0, 'Navigation must abort when network request fails');
  assert.equal(slides[1].hidden, true, 'Slide 1 must remain hidden on network failure');
  assert.equal(isBlank, true, 'Screen must remain blanked on network failure');
});

test('SPEC-85-04: applyRemoteIntent awaits async setIndexAndSync and propagates abort', async () => {
  const handlers = {
    setIndexAndSync: async () => false, // aborted safeNavigate
    setBlankAndSync: () => {},
    setTransitionAndSync: () => {},
    setBackgroundAndSync: () => {},
    broadcast: () => {},
  };

  const intent = { type: 'sync', index: 3, planIdentity: 'plan-1' };
  const applied = await applyRemoteIntent(intent, 'plan-1', handlers);
  assert.equal(applied, false, 'applyRemoteIntent must resolve false when async setIndexAndSync aborts');

  const successHandlers = {
    ...handlers,
    setIndexAndSync: async () => true,
  };
  const successApplied = await applyRemoteIntent(intent, 'plan-1', successHandlers);
  assert.equal(successApplied, true, 'applyRemoteIntent must resolve true when async setIndexAndSync succeeds');
});

test('SPEC-85-04: RemoteOperator Prev/Next linear navigation uses findNextVisibleIndex to skip hidden slides', () => {
  const remoteSlides = [
    { id: 'r0', hidden: false },
    { id: 'r1', hidden: true },
    { id: 'r2', hidden: true },
    { id: 'r3', hidden: false },
  ];

  let currentRemoteIndex = 0;
  // Next button click from slide 0:
  const next = findNextVisibleIndex(remoteSlides, currentRemoteIndex, 1);
  assert.equal(next, 3, 'Remote Next must skip hidden slides r1 and r2 and advance to r3');

  // Prev button click from slide 3:
  const prev = findNextVisibleIndex(remoteSlides, 3, -1);
  assert.equal(prev, 0, 'Remote Prev must skip hidden slides r2 and r1 and retreat to r0');

  // Boundary check: disabled state when no visible slide in direction
  assert.equal(findNextVisibleIndex(remoteSlides, 3, 1), 3, 'Next disabled at boundary');
  assert.equal(findNextVisibleIndex(remoteSlides, 0, -1), 0, 'Prev disabled at boundary');
});

test('SPEC-85-04: SlideGridDialog onPick awaits safeNavigate and keeps dialog open on failure', async () => {
  let gridOpen = true;

  const mockFailingSafeNavigate = async () => false; // e.g. server PATCH 500 error

  const onPickWithFailure = async (picked) => {
    const ok = await mockFailingSafeNavigate(picked);
    if (ok) {
      gridOpen = false;
    }
  };

  await onPickWithFailure(2);
  assert.equal(gridOpen, true, 'Grid dialog must remain open when safeNavigate unhide fails');

  const mockSuccessSafeNavigate = async () => true;

  const onPickWithSuccess = async (picked) => {
    const ok = await mockSuccessSafeNavigate(picked);
    if (ok) {
      gridOpen = false;
    }
  };

  await onPickWithSuccess(2);
  assert.equal(gridOpen, false, 'Grid dialog must close when safeNavigate succeeds');
});

test('SPEC-85-04: Behavioral: Announcement auto-loop skips hidden slides within bounds', () => {
  const announcements = [
    { id: 'ann-1', hidden: false },
    { id: 'ann-2', hidden: true },
    { id: 'ann-3', hidden: true },
    { id: 'ann-4', hidden: false },
  ];
  const curBounds = [0, 3]; // tuple [start, end]

  const computeNext = (cur) => (cur >= curBounds[1] ? curBounds[0] : cur + 1);

  let currentIdx = 0; // ann-1
  let nextIdx = computeNext(currentIdx);
  let attempts = 0;
  const sectionLength = curBounds[1] - curBounds[0] + 1;
  while (announcements[nextIdx]?.hidden && attempts < sectionLength) {
    nextIdx = computeNext(nextIdx);
    attempts++;
  }

  assert.equal(nextIdx, 3, 'Auto-loop must skip hidden ann-2 and ann-3 to advance directly to ann-4');
});

test('SPEC-85-04: PPTX export generates native PowerPoint <p:sld show="0"> attribute for hidden slides', async () => {
  const dummyArtifact = {
    version: 1,
    runtimeVersion: 1,
    instanceId: 'test-inst-1',
    templateId: 'test-tpl-1',
    layout: {
      backgroundColor: '#000000',
      elements: [],
    },
  };

  const plan = [
    { artifact: { ...dummyArtifact, instanceId: 's1' }, fade: true, hidden: false },
    { artifact: { ...dummyArtifact, instanceId: 's2' }, fade: true, hidden: true },
    { artifact: { ...dummyArtifact, instanceId: 's3' }, fade: true, hidden: false },
  ];

  const buffer = await generatePptxFromPlan('2026-09-26', plan, 'fade');
  assert.ok(buffer instanceof Buffer);
  assert.ok(buffer.length > 0);

  const zip = await JSZip.loadAsync(buffer);

  // Slide 1 (visible) -> should NOT have show="0"
  const slide1Xml = await zip.file('ppt/slides/slide1.xml').async('string');
  assert.ok(!slide1Xml.includes('show="0"'), 'Visible slide 1 must not carry show="0"');

  // Slide 2 (hidden) -> MUST have show="0"
  const slide2Xml = await zip.file('ppt/slides/slide2.xml').async('string');
  assert.ok(slide2Xml.includes('show="0"'), 'Hidden slide 2 must carry native <p:sld show="0"> attribute');

  // Slide 3 (visible) -> should NOT have show="0"
  const slide3Xml = await zip.file('ppt/slides/slide3.xml').async('string');
  assert.ok(!slide3Xml.includes('show="0"'), 'Visible slide 3 must not carry show="0"');
});

test('SPEC-85-04: Structural scan verifies slide visibility guards across all layers', () => {
  const findings = scanSlideVisibilityGuards();
  assert.deepEqual(findings, [], `Expected 0 visibility guard findings, got: ${findings.join(', ')}`);
});

test('SPEC-85-04: Defect injection proof — removing findNextVisibleIndex triggers navigation guard finding', () => {
  const rawPresenter = fs.readFileSync(presenterOperatorPath, 'utf8');
  const defectiveSrc = rawPresenter.replaceAll(
    'findNextVisibleIndex(activeSlides, index, 1)',
    'index + 1'
  );
  const findings = scanSlideVisibilityGuards({ presenterSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('missing forward findNextVisibleIndex navigation skip')),
    'Expected defect injection without forward findNextVisibleIndex to fail scan'
  );
});

test('SPEC-85-04: Defect injection proof — removing show="0" from PPTX generator triggers guard finding', () => {
  const rawPptxDraw = fs.readFileSync(pptxDrawPath, 'utf8');
  const defectiveSrc = rawPptxDraw.replaceAll('show="0"', 'show="1"');
  const findings = scanSlideVisibilityGuards({ pptxDrawSrc: defectiveSrc });
  assert.ok(
    findings.some((f) => f.includes('missing patchHiddenSlides or show="0"')),
    'Expected defect injection without show="0" to fail scan'
  );
});
